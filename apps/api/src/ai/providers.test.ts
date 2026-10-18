import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { AI_PROVIDER_IDS, AI_PROVIDERS, normalizeAiBaseUrl } from '@amalice/shared'
import { ADAPTERS, adapterFor } from './providers'
import { errorMessage } from './providers/http'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

// ---- the catalog ------------------------------------------------------------

test('every provider id has a complete catalog entry', () => {
  for (const id of AI_PROVIDER_IDS) {
    const info = AI_PROVIDERS[id]
    assert.equal(info.id, id)
    assert.ok(info.label && info.note && /^https:\/\//.test(info.keyUrl), `${id} needs a label, a note and an https key link`)
    assert.ok(info.note.length < 400, `${id}'s note should stay short`)
  }
})

test('every fixed provider has an adapter, suggested models and the same id', () => {
  for (const id of AI_PROVIDER_IDS.filter((p) => p !== 'custom')) {
    assert.equal(ADAPTERS[id as Exclude<typeof id, 'custom'>].id, id)
    assert.ok(AI_PROVIDERS[id].suggested.fast && AI_PROVIDERS[id].suggested.smart, `${id} should suggest a fast and a smart model`)
    assert.equal(AI_PROVIDERS[id].custom, undefined)
  }
})

test('the custom endpoint is the only one flagged custom, and suggests no model', () => {
  assert.deepEqual(AI_PROVIDER_IDS.filter((id) => AI_PROVIDERS[id].custom), ['custom'])
  assert.deepEqual(AI_PROVIDERS.custom.suggested, { fast: '', smart: '' })
})

test('there are plenty of services to choose from', () => {
  assert.ok(AI_PROVIDER_IDS.length >= 10)
})

test('no catalog note quotes exact free-tier numbers that would go stale, except hedged ones', () => {
  // Limits change; the only figure allowed is NVIDIA's, which is explicitly marked unofficial.
  for (const id of AI_PROVIDER_IDS) {
    const note = AI_PROVIDERS[id].note
    if (/\d+\s*(requests|rpm|tokens)/i.test(note)) assert.match(note, /(reported|not an official|about)/i, `${id}'s note states a number without hedging`)
  }
})

// ---- the custom endpoint address -------------------------------------------

test('normalizeAiBaseUrl accepts https and local http, and strips trailing slashes', () => {
  assert.equal(normalizeAiBaseUrl('https://api.example.com/v1/'), 'https://api.example.com/v1')
  assert.equal(normalizeAiBaseUrl('  https://api.example.com/v1  '), 'https://api.example.com/v1')
  assert.equal(normalizeAiBaseUrl('http://localhost:11434/v1'), 'http://localhost:11434/v1')
  assert.equal(normalizeAiBaseUrl('http://127.0.0.1:8080/v1//'), 'http://127.0.0.1:8080/v1')
})

test('normalizeAiBaseUrl rejects anything else', () => {
  for (const bad of ['', 'nope', 'http://example.com/v1', 'ftp://example.com', 'javascript:alert(1)', 'https://u:p@example.com', 'https://example.com/v1?x=1', 'https://example.com/v1#frag', 'http://192.168.1.5/v1']) {
    assert.equal(normalizeAiBaseUrl(bad), null, bad)
  }
})

// ---- adapters ---------------------------------------------------------------

test('adapterFor(custom) needs a base URL and is built from the saved one', () => {
  assert.throws(() => adapterFor('custom'), /no base URL/)
  assert.equal(adapterFor('custom', 'https://api.example.com/v1').id, 'custom')
  assert.equal(adapterFor('groq'), ADAPTERS.groq)
})

test('the custom adapter talks to <baseUrl>/chat/completions with the saved key', async () => {
  let seen: { url: string; auth: string } | null = null
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    seen = { url: String(url), auth: (init?.headers as Record<string, string>).Authorization! }
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }], usage: { total_tokens: 3 } }), { status: 200 })
  }) as typeof fetch
  const res = await adapterFor('custom', 'https://api.example.com/v1').chat({ apiKey: 'k-123', model: 'm', messages: [{ role: 'user', text: 'hi' }], temperature: 0 })
  assert.equal(res.text, 'ok')
  assert.deepEqual(seen, { url: 'https://api.example.com/v1/chat/completions', auth: 'Bearer k-123' })
})

const reply = (body: unknown) => (globalThis.fetch = (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch)

test('GitHub Models: the model list is a bare array from the catalog endpoint', async () => {
  let url = ''
  globalThis.fetch = (async (u: unknown) => {
    url = String(u)
    return new Response(JSON.stringify([{ id: 'openai/gpt-4.1' }, { id: 'meta/llama-3.3-70b-instruct' }, { id: 'openai/text-embedding-3-small' }]), { status: 200 })
  }) as typeof fetch
  assert.deepEqual(await ADAPTERS.github.listModels('k'), ['meta/llama-3.3-70b-instruct', 'openai/gpt-4.1'])
  assert.equal(url, 'https://models.github.ai/catalog/models')
})

test('model lists also accept { models: [...] } and ignore malformed entries', async () => {
  reply({ models: [{ id: 'a-model' }, { name: 'no-id' }, null, { id: 5 }] })
  assert.deepEqual(await ADAPTERS.zai.listModels('k'), ['a-model'])
  reply({ unexpected: true })
  assert.deepEqual(await ADAPTERS.zai.listModels('k'), [])
})

test('NVIDIA and SambaNova model lists drop embedding / reranking / speech models', async () => {
  reply({ data: [{ id: 'meta/llama-3.1-8b-instruct' }, { id: 'nvidia/nv-embedqa-e5-v5' }, { id: 'nvidia/llama-3.2-nv-rerankqa-1b-v2' }, { id: 'meta/llama-guard-4-12b' }] })
  assert.deepEqual(await ADAPTERS.nvidia.listModels('k'), ['meta/llama-3.1-8b-instruct'])
  reply({ data: [{ id: 'DeepSeek-V3.1' }, { id: 'Whisper-Large-v3' }, { id: 'E5-Mistral-7B-Instruct-embed' }] })
  assert.deepEqual(await ADAPTERS.sambanova.listModels('k'), ['DeepSeek-V3.1'])
})

test('every OpenAI-style provider posts to its own chat-completions address', async () => {
  const expected: Record<string, string> = {
    groq: 'https://api.groq.com/openai/v1/chat/completions',
    cerebras: 'https://api.cerebras.ai/v1/chat/completions',
    github: 'https://models.github.ai/inference/chat/completions',
    nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
    sambanova: 'https://api.sambanova.ai/v1/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    mistral: 'https://api.mistral.ai/v1/chat/completions',
    huggingface: 'https://router.huggingface.co/v1/chat/completions',
    zai: 'https://api.z.ai/api/paas/v4/chat/completions'
  }
  for (const [id, url] of Object.entries(expected)) {
    let seen = ''
    globalThis.fetch = (async (u: unknown) => {
      seen = String(u)
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 })
    }) as typeof fetch
    await ADAPTERS[id as keyof typeof ADAPTERS].chat({ apiKey: 'k', model: 'm', messages: [{ role: 'user', text: 'x' }], temperature: 0 })
    assert.equal(seen, url, id)
  }
})

test('errorMessage reads every error body shape providers use, including an array-wrapped one', () => {
  assert.equal(errorMessage({ error: { message: 'nested' } }, 400), 'nested')
  assert.equal(errorMessage({ error: 'plain string' }, 400), 'plain string')
  assert.equal(errorMessage({ message: 'top-level' }, 400), 'top-level')
  assert.equal(errorMessage([{ error: { code: 503, message: 'high demand' } }], 503), 'high demand')
  assert.equal(errorMessage({}, 502), 'HTTP 502')
  assert.equal(errorMessage(null, 500), 'HTTP 500')
  assert.equal(errorMessage([], 500), 'HTTP 500')
})

test('tool calls are echoed back verbatim, keeping provider-specific fields (Google\'s thought signature)', async () => {
  const bodies: any[] = []
  let call = 0
  globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)))
    call++
    return new Response(
      JSON.stringify(
        call === 1
          ? { choices: [{ message: { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'echo', arguments: '{}' }, extra_content: { google: { thought_signature: 'SIG123' } } }] } }] }
          : { choices: [{ message: { content: 'done' } }] }
      ),
      { status: 200 }
    )
  }) as typeof fetch

  const adapter = adapterFor('custom', 'https://api.example.com/v1')
  const first = await adapter.chat({ apiKey: 'k', model: 'm', messages: [{ role: 'user', text: 'x' }], tools: [{ name: 'echo', description: 'e', parameters: { type: 'OBJECT', properties: {} } }], temperature: 0 })
  assert.equal(first.toolCalls[0]!.id, 'c1')
  await adapter.chat({
    apiKey: 'k',
    model: 'm',
    messages: [
      { role: 'user', text: 'x' },
      { role: 'assistant', toolCalls: first.toolCalls, raw: first.rawAssistant },
      { role: 'tool', results: [{ id: 'c1', name: 'echo', result: {} }] }
    ],
    temperature: 0
  })
  const assistant = bodies[1].messages.find((m: any) => m.role === 'assistant')
  assert.equal(assistant.tool_calls[0].extra_content.google.thought_signature, 'SIG123')
  assert.equal(bodies[1].messages.find((m: any) => m.role === 'tool').tool_call_id, 'c1')
})

test('tool calls without ids are rebuilt (not echoed) so ids stay consistent', async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ function: { name: 'echo', arguments: '{}' } }] } }] }), { status: 200 })) as typeof fetch
  const res = await adapterFor('custom', 'https://api.example.com/v1').chat({ apiKey: 'k', model: 'm', messages: [{ role: 'user', text: 'x' }], temperature: 0 })
  assert.equal(res.toolCalls[0]!.id, 'call_0')
  assert.equal(res.rawAssistant, undefined)
})
