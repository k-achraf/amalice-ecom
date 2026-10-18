import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common'
import { AiSettingsService } from './ai-settings.service'
import { ADAPTERS } from './providers'

Logger.overrideLogger(false)

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const SECRET = 'x'.repeat(32)
const actor = { id: 'admin-1', email: 'admin@example.com' }

// In-memory stand-ins for the two tables and the audit log.
function makeService(env: Record<string, unknown> = {}) {
  const store = { settings: null as Record<string, any> | null, creds: new Map<string, Record<string, any>>(), audits: [] as any[] }
  const prisma = {
    aiSettings: {
      async findUnique() {
        return store.settings
      },
      async upsert({ update, create }: any) {
        store.settings = store.settings ? { ...store.settings, ...update } : { id: 'singleton', fastProvider: null, fastModel: null, smartProvider: null, smartModel: null, fallbackProvider: null, fallbackModel: null, dailyCallLimit: null, ...create }
        return store.settings
      }
    },
    aiProviderCredential: {
      async findMany() {
        return [...store.creds.values()]
      },
      async upsert({ where, update, create }: any) {
        store.creds.set(where.provider, { ...(store.creds.get(where.provider) ?? create), ...update })
      },
      async deleteMany({ where }: any) {
        store.creds.delete(where.provider)
      }
    }
  }
  const config = { get: (key: string) => ({ JWT_SECRET: SECRET, AI_DAILY_CALL_LIMIT: 500, ...env })[key] }
  const audit = { log: async (entry: unknown) => void store.audits.push(entry) }
  const service = new AiSettingsService(prisma as never, config as never, audit as never)
  return { service, store }
}

test('a saved key is stored encrypted, with only its last 4 characters as a hint', async () => {
  const { service, store } = makeService()
  await service.setKey('groq', 'gsk_supersecretvalue1234', actor)
  const row = store.creds.get('groq')!
  assert.equal(row.keyHint, '1234')
  assert.doesNotMatch(row.apiKeyEncrypted, /supersecret/)
  assert.match(row.apiKeyEncrypted, /^v1\./)
})

test('the view never contains a key, and reports where each provider key comes from', async () => {
  const { service } = makeService({ GEMINI_API_KEY: 'env-gemini-key-aaaa' })
  await service.setKey('groq', 'gsk_supersecretvalue1234', actor)
  const view = await service.view()
  const text = JSON.stringify(view)
  assert.doesNotMatch(text, /supersecret/)
  assert.doesNotMatch(text, /env-gemini-key/)
  const byId = Object.fromEntries(view.providers.map((p) => [p.id, p]))
  assert.deepEqual([byId.groq!.hasKey, byId.groq!.keySource, byId.groq!.keyHint], [true, 'settings', '1234'])
  assert.deepEqual([byId.gemini!.hasKey, byId.gemini!.keySource, byId.gemini!.keyHint], [true, 'env', null])
  assert.deepEqual([byId.mistral!.hasKey, byId.mistral!.keySource], [false, null])
})

test('saving a key writes an audit row that never contains the key', async () => {
  const { service, store } = makeService()
  await service.setKey('groq', 'gsk_supersecretvalue1234', actor)
  assert.equal(store.audits.length, 1)
  assert.doesNotMatch(JSON.stringify(store.audits), /supersecret/)
  assert.equal(store.audits[0].entity, 'AiProviderCredential')
})

test('with nothing chosen, both tiers default to Gemini using the env key and model overrides', async () => {
  const { service } = makeService({ GEMINI_API_KEY: 'env-key', AI_SMART_MODEL: 'my-smart' })
  const fast = await service.targets('fast')
  const smart = await service.targets('smart')
  assert.deepEqual(fast, [{ provider: 'gemini', model: 'gemini-flash-lite-latest', apiKey: 'env-key' }])
  assert.deepEqual(smart, [{ provider: 'gemini', model: 'my-smart', apiKey: 'env-key' }])
})

test('with no key anywhere there is nothing to run', async () => {
  const { service } = makeService()
  assert.deepEqual(await service.targets('fast'), [])
  assert.equal((await service.view()).effective.smart, null)
})

test('a chosen provider and model are used, with the fallback second', async () => {
  const { service } = makeService({ GEMINI_API_KEY: 'env-key' })
  await service.setKey('groq', 'groq-key-0001', actor)
  await service.update({ smart: { provider: 'groq', model: 'big-model' }, fallback: { provider: 'gemini', model: 'gem-fallback' } }, actor)
  assert.deepEqual(await service.targets('smart'), [
    { provider: 'groq', model: 'big-model', apiKey: 'groq-key-0001' },
    { provider: 'gemini', model: 'gem-fallback', apiKey: 'env-key' }
  ])
  // The untouched fast tier still defaults to Gemini, then the same fallback.
  assert.deepEqual((await service.targets('fast')).map((t) => `${t.provider}/${t.model}`), ['gemini/gemini-flash-lite-latest', 'gemini/gem-fallback'])
  assert.deepEqual((await service.view()).effective, { fast: { provider: 'gemini', model: 'gemini-flash-lite-latest' }, smart: { provider: 'groq', model: 'big-model' } })
})

test('the fallback is dropped when it duplicates the primary, or has no key', async () => {
  const { service } = makeService({ GEMINI_API_KEY: 'env-key' })
  await service.update({ fast: { provider: 'gemini', model: 'same' }, fallback: { provider: 'gemini', model: 'same' } }, actor)
  assert.equal((await service.targets('fast')).length, 1)
})

test('choosing a provider without a key is rejected', async () => {
  const { service } = makeService()
  await assert.rejects(service.update({ smart: { provider: 'mistral', model: 'm' } }, actor), (e: unknown) => e instanceof BadRequestException && /Mistral/.test((e as Error).message))
})

test('null clears a tier back to the default; omitted leaves it alone', async () => {
  const { service } = makeService({ GEMINI_API_KEY: 'env-key' })
  await service.setKey('groq', 'groq-key-0001', actor)
  await service.update({ fast: { provider: 'groq', model: 'a' }, smart: { provider: 'groq', model: 'b' } }, actor)
  await service.update({ fast: null }, actor)
  const view = await service.view()
  assert.equal(view.fast, null)
  assert.deepEqual(view.smart, { provider: 'groq', model: 'b' })
})

test('removing a key makes that provider unusable again', async () => {
  const { service } = makeService()
  await service.setKey('groq', 'groq-key-0001', actor)
  await service.update({ smart: { provider: 'groq', model: 'b' } }, actor)
  assert.equal((await service.targets('smart')).length, 1)
  await service.clearKey('groq', actor)
  assert.equal((await service.targets('smart')).length, 0)
})

test('a key that can no longer be decrypted (secret changed) is treated as missing', async () => {
  const { service, store } = makeService()
  await service.setKey('groq', 'groq-key-0001', actor)
  // Same stored rows, but the server now has a different secret.
  const other = new AiSettingsService(
    { aiSettings: { findUnique: async () => store.settings }, aiProviderCredential: { findMany: async () => [...store.creds.values()] } } as never,
    { get: (key: string) => ({ JWT_SECRET: 'y'.repeat(32) })[key] } as never,
    { log: async () => undefined } as never
  )
  const view = await other.view()
  assert.equal(view.providers.find((p) => p.id === 'groq')!.hasKey, false)
})

test('the daily limit comes from settings, else the server default', async () => {
  const { service } = makeService({ AI_DAILY_CALL_LIMIT: 500 })
  assert.equal(await service.dailyLimit(), 500)
  await service.update({ dailyCallLimit: 40 }, actor)
  assert.equal(await service.dailyLimit(), 40)
  await service.update({ dailyCallLimit: 0 }, actor)
  assert.equal(await service.dailyLimit(), 0)
  await service.update({ dailyCallLimit: null }, actor)
  assert.equal(await service.dailyLimit(), 500)
})

test('cachedKey serves the saved key synchronously (for the legacy Gemini service)', async () => {
  const { service } = makeService()
  assert.equal(service.cachedKey('gemini'), undefined)
  await service.setKey('gemini', 'AIza-saved-key-9999', actor)
  await service.view() // refreshes the snapshot
  assert.equal(service.cachedKey('gemini'), 'AIza-saved-key-9999')
})

test('an unknown provider id is a 404', () => {
  assert.throws(() => makeService().service.assertProvider('openai'), NotFoundException)
  assert.equal(makeService().service.assertProvider('groq'), 'groq')
})

test('listModels reports a missing key, and the provider error when the key is bad', async () => {
  const { service } = makeService()
  assert.deepEqual(await service.listModels('groq'), { ok: false, models: [], error: 'No API key saved for Groq.' })

  await service.setKey('groq', 'bad-key-value-0000', actor)
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: 'Invalid API Key' } }), { status: 401 })) as typeof fetch
  const result = await service.listModels('groq')
  assert.equal(result.ok, false)
  assert.match(result.error!, /Invalid API Key/)
})

// ---- model lists per provider ------------------------------------------------

test('listModels per provider keeps only usable chat models', async () => {
  const reply = (body: unknown) => (globalThis.fetch = (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch)

  reply({ data: [{ id: 'llama-3.1-8b-instant' }, { id: 'openai/gpt-oss-120b' }, { id: 'whisper-large-v3' }, { id: 'meta-llama/llama-guard-4' }] })
  assert.deepEqual(await ADAPTERS.groq.listModels('k'), ['llama-3.1-8b-instant', 'openai/gpt-oss-120b'])

  reply({ data: [{ id: 'openrouter/free' }, { id: 'some/model:free' }, { id: 'paid/model' }] })
  assert.deepEqual(await ADAPTERS.openrouter.listModels('k'), ['openrouter/free', 'some/model:free'])

  reply({ data: [{ id: 'mistral-small-latest' }, { id: 'mistral-embed' }, { id: 'mistral-ocr-latest' }] })
  assert.deepEqual(await ADAPTERS.mistral.listModels('k'), ['mistral-small-latest'])

  reply({
    models: [
      { name: 'models/gemini-3.5-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
      { name: 'models/gemini-3.1-flash-image', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.1-flash-lite', supportedGenerationMethods: ['generateContent'] }
    ]
  })
  assert.deepEqual(await ADAPTERS.gemini.listModels('k'), ['gemini-3.1-flash-lite', 'gemini-3.5-flash'])
})
