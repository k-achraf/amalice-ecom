import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { BadGatewayException, BadRequestException, HttpException, Logger } from '@nestjs/common'
import { z } from 'zod'
import { AiService, retryAfterSeconds, type AiTool } from './ai.service'

// AiService talks to Google over fetch and keeps counters in Redis: both are
// replaced by fakes here, so these tests need no network, key, or Redis.

// Keep the test output readable: AiService logs every model call.
Logger.overrideLogger(false)

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

function makeService(env: Record<string, unknown> = {}, redis: Record<string, unknown> = fakeRedis()) {
  const config = { get: (key: string) => ({ GEMINI_API_KEY: 'test-key', AI_DAILY_CALL_LIMIT: 0, ...env })[key] }
  return new AiService(config as never, redis as never)
}

function fakeRedis() {
  const hashes = new Map<string, Record<string, number>>()
  return {
    hashes,
    async hincrby(key: string, field: string, by: number) {
      const h = hashes.get(key) ?? {}
      h[field] = (h[field] ?? 0) + by
      hashes.set(key, h)
      return h[field]
    },
    async expire() {
      return 1
    },
    async hgetall(key: string) {
      return Object.fromEntries(Object.entries(hashes.get(key) ?? {}).map(([k, v]) => [k, String(v)]))
    }
  }
}

const textBody = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { totalTokenCount: 10 } })
const callBody = (name: string, args: Record<string, unknown>) => ({ candidates: [{ content: { role: 'model', parts: [{ functionCall: { name, args } }] } }] })
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Replaces fetch with a queue of canned responses and records each request body.
function mockFetch(...responses: Response[]) {
  const requests: Record<string, any>[] = []
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body)))
    const next = responses.shift()
    if (!next) throw new Error('unexpected extra fetch call')
    return next
  }) as typeof fetch
  return requests
}

const promptOf = (request: Record<string, any>): string => request.contents[0].parts[0].text

const Pick = z.object({ id: z.string(), score: z.number() })

test('generateObject returns the validated object', async () => {
  const requests = mockFetch(json(textBody('{"id":"a","score":3}')))
  const out = await makeService().generateObject({ task: 't', prompt: 'p', schema: Pick })
  assert.deepEqual(out, { id: 'a', score: 3 })
  assert.equal(requests.length, 1)
  assert.match(promptOf(requests[0]!), /JSON Schema/)
})

test('generateObject retries once, feeding the validation error back', async () => {
  const requests = mockFetch(json(textBody('{"id":"a","score":"high"}')), json(textBody('{"id":"a","score":7}')))
  const out = await makeService().generateObject({ task: 't', prompt: 'p', schema: Pick })
  assert.deepEqual(out, { id: 'a', score: 7 })
  assert.equal(requests.length, 2)
  assert.match(promptOf(requests[1]!), /rejected by validation/)
})

test('generateObject retries once on invalid JSON', async () => {
  const requests = mockFetch(json(textBody('not json at all')), json(textBody('{"id":"b","score":1}')))
  const out = await makeService().generateObject({ task: 't', prompt: 'p', schema: Pick })
  assert.equal(out.id, 'b')
  assert.match(promptOf(requests[1]!), /not valid JSON/)
})

test('generateObject gives up after two unusable answers', async () => {
  const requests = mockFetch(json(textBody('{"id":1}')), json(textBody('{"id":2}')))
  await assert.rejects(makeService().generateObject({ task: 't', prompt: 'p', schema: Pick }), BadGatewayException)
  assert.equal(requests.length, 2)
})

test('generateObject refuses to run without an API key', async () => {
  mockFetch()
  await assert.rejects(makeService({ GEMINI_API_KEY: undefined }).generateObject({ task: 't', prompt: 'p', schema: Pick }), BadRequestException)
})

test('retryAfterSeconds reads Google\'s "retry in" hints', () => {
  assert.equal(retryAfterSeconds('Please retry in 1h27m33.527053896s.'), 1 * 3600 + 27 * 60 + 33.527053896)
  assert.equal(retryAfterSeconds('Please retry in 12m5s'), 12 * 60 + 5)
  assert.equal(retryAfterSeconds('Please retry in 42.3s.'), 42.3)
  assert.equal(retryAfterSeconds('quota exceeded'), null)
  assert.equal(retryAfterSeconds(undefined), null)
})

test('a quota error that resets in an hour fails fast with a clear 429 and no retries', async () => {
  const requests = mockFetch(json({ error: { message: 'You exceeded your current quota. Please retry in 1h27m33.5s.' } }, 429))
  await assert.rejects(makeService().generateObject({ task: 't', prompt: 'p', schema: Pick }), (error: unknown) => {
    return error instanceof HttpException && error.getStatus() === 429 && /quota for model/.test(error.message) && /1h 28m/.test(error.message)
  })
  assert.equal(requests.length, 1)
})

test('a short rate limit is still retried', async () => {
  const requests = mockFetch(json({ error: { message: 'Slow down. Please retry in 1s.' } }, 429), json(textBody('{"id":"a","score":1}')))
  const out = await makeService().generateObject({ task: 't', prompt: 'p', schema: Pick })
  assert.equal(out.id, 'a')
  assert.equal(requests.length, 2)
})

test('an upstream 402 (no credits) fails immediately without retrying', async () => {
  const requests = mockFetch(json({ error: { message: 'credits depleted' } }, 402))
  await assert.rejects(makeService().generateObject({ task: 't', prompt: 'p', schema: Pick }), /credits depleted/)
  assert.equal(requests.length, 1)
})

const echoTool = (seen: Record<string, unknown>[]): AiTool => ({
  name: 'echo',
  description: 'echo',
  parameters: { type: 'OBJECT', properties: {} },
  handler: async (args) => {
    seen.push(args)
    return { echoed: args }
  }
})

test('runWithTools runs the requested tool and returns the final text', async () => {
  const seen: Record<string, unknown>[] = []
  const requests = mockFetch(json(callBody('echo', { days: 7 })), json(textBody('final answer')))
  const out = await makeService().runWithTools({ task: 't', system: 's', history: [], question: 'q', tools: [echoTool(seen)] })
  assert.deepEqual(out, { text: 'final answer', toolsUsed: ['echo'] })
  assert.deepEqual(seen, [{ days: 7 }])
  // The tool result goes back to the model as a functionResponse.
  const last = requests[1]!.contents.at(-1)
  assert.equal(last.parts[0].functionResponse.name, 'echo')
  assert.deepEqual(last.parts[0].functionResponse.response.result, { echoed: { days: 7 } })
})

test('runWithTools tells the model when it asks for an unknown tool', async () => {
  const requests = mockFetch(json(callBody('nope', {})), json(textBody('done')))
  const out = await makeService().runWithTools({ task: 't', system: 's', history: [], question: 'q', tools: [echoTool([])] })
  assert.deepEqual(out, { text: 'done', toolsUsed: [] })
  assert.match(JSON.stringify(requests[1]!.contents.at(-1)), /Unknown tool/)
})

test('runWithTools survives a throwing tool and hides its error details', async () => {
  const boom: AiTool = { name: 'boom', description: 'x', parameters: { type: 'OBJECT', properties: {} }, handler: async () => Promise.reject(new Error('secret db detail')) }
  const requests = mockFetch(json(callBody('boom', {})), json(textBody('ok')))
  const out = await makeService().runWithTools({ task: 't', system: 's', history: [], question: 'q', tools: [boom] })
  assert.equal(out.text, 'ok')
  const sent = JSON.stringify(requests[1]!.contents.at(-1))
  assert.match(sent, /failed to run/)
  assert.doesNotMatch(sent, /secret db detail/)
})

test('runWithTools stops after maxSteps', async () => {
  const requests = mockFetch(json(callBody('echo', {})), json(callBody('echo', {})), json(callBody('echo', {})))
  await assert.rejects(makeService().runWithTools({ task: 't', system: 's', history: [], question: 'q', tools: [echoTool([])], maxSteps: 2 }), /too many steps/)
  assert.equal(requests.length, 2)
})

test('runWithTools sends earlier turns as history', async () => {
  const requests = mockFetch(json(textBody('hi')))
  await makeService().runWithTools({
    task: 't',
    system: 's',
    history: [
      { role: 'user', text: 'first' },
      { role: 'assistant', text: 'reply' }
    ],
    question: 'second',
    tools: []
  })
  assert.deepEqual(
    requests[0]!.contents.map((c: any) => [c.role, c.parts[0].text]),
    [
      ['user', 'first'],
      ['model', 'reply'],
      ['user', 'second']
    ]
  )
})

test('the daily cap blocks calls beyond the limit with a 429', async () => {
  const requests = mockFetch(json(textBody('{"id":"a","score":1}')), json(textBody('{"id":"a","score":1}')))
  const ai = makeService({ AI_DAILY_CALL_LIMIT: 2 })
  await ai.generateObject({ task: 't', prompt: 'p', schema: Pick })
  await ai.generateObject({ task: 't', prompt: 'p', schema: Pick })
  await assert.rejects(ai.generateObject({ task: 't', prompt: 'p', schema: Pick }), (error: unknown) => error instanceof HttpException && error.getStatus() === 429)
  assert.equal(requests.length, 2)
})

test('usage records calls, tokens and calls per task', async () => {
  mockFetch(json(textBody('{"id":"a","score":1}')), json(textBody('{"id":"a","score":1}')))
  const ai = makeService()
  await ai.generateObject({ task: 'alpha', prompt: 'p', schema: Pick })
  await ai.generateObject({ task: 'beta', prompt: 'p', schema: Pick })
  const [today] = await ai.usage(1)
  assert.equal(today!.calls, 2)
  assert.equal(today!.tokens, 20)
  assert.deepEqual(today!.byTask, { alpha: 1, beta: 1 })
})

test('a Redis failure never blocks an AI call', async () => {
  mockFetch(json(textBody('{"id":"a","score":1}')))
  const broken = {
    hincrby: async () => Promise.reject(new Error('redis down')),
    expire: async () => 1,
    hgetall: async () => ({})
  }
  const out = await makeService({ AI_DAILY_CALL_LIMIT: 1 }, broken).generateObject({ task: 't', prompt: 'p', schema: Pick })
  assert.equal(out.id, 'a')
})
