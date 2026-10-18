import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { BadGatewayException, BadRequestException, HttpException, Logger } from '@nestjs/common'
import { z } from 'zod'
import { AiService, type AiTool } from './ai.service'
import type { AiResolvedTarget } from './ai-settings.service'
import { retryAfterSeconds } from './providers/http'

// AiService talks to providers over fetch, keeps counters in Redis and reads
// its settings from AiSettingsService: all three are replaced by fakes here, so
// these tests need no network, key, Redis or database.

// Keep the test output readable: AiService logs every model call.
Logger.overrideLogger(false)

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const gemini: AiResolvedTarget = { provider: 'gemini', model: 'gem-model', apiKey: 'gem-key' }
const groq: AiResolvedTarget = { provider: 'groq', model: 'groq-model', apiKey: 'groq-key' }
const cerebras: AiResolvedTarget = { provider: 'cerebras', model: 'cb-model', apiKey: 'cb-key' }

function fakeSettings(targets: AiResolvedTarget[], dailyLimit = 0) {
  const calls = { targets: 0 }
  return {
    calls,
    async targets() {
      calls.targets++
      return targets
    },
    async targetFor() {
      return targets[0] ?? null
    },
    async dailyLimit() {
      return dailyLimit
    }
  }
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

function makeService(targets: AiResolvedTarget[] = [gemini], redis: Record<string, unknown> = fakeRedis(), dailyLimit = 0) {
  const settings = fakeSettings(targets, dailyLimit)
  return { ai: new AiService(redis as never, settings as never), settings }
}

// ---- Gemini wire format -----------------------------------------------------
const textBody = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { totalTokenCount: 10 } })
const callBody = (name: string, args: Record<string, unknown>) => ({ candidates: [{ content: { role: 'model', parts: [{ functionCall: { name, args } }] } }] })
// ---- OpenAI-compatible wire format ------------------------------------------
const chatBody = (content: string | null, toolCalls?: { id: string; name: string; args: unknown }[]) => ({
  choices: [{ message: { content, ...(toolCalls && { tool_calls: toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: typeof c.args === 'string' ? c.args : JSON.stringify(c.args) } })) }) } }],
  usage: { total_tokens: 7 }
})
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

interface Call {
  url: string
  headers: Record<string, string>
  body: Record<string, any> | null
}

// Replaces fetch with a queue of canned responses; records every request.
function mockFetch(...responses: Response[]) {
  const calls: Call[] = []
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body ? JSON.parse(String(init.body)) : null })
    const next = responses.shift()
    if (!next) throw new Error('unexpected extra fetch call')
    return next
  }) as typeof fetch
  return calls
}

const promptOf = (call: Call): string => call.body!.contents[0].parts[0].text

const Pick = z.object({ id: z.string(), score: z.number() })

// ---- generateObject ---------------------------------------------------------

test('generateObject returns the validated object', async () => {
  const calls = mockFetch(json(textBody('{"id":"a","score":3}')))
  const out = await makeService().ai.generateObject({ task: 't', prompt: 'p', schema: Pick })
  assert.deepEqual(out, { id: 'a', score: 3 })
  assert.equal(calls.length, 1)
  assert.match(promptOf(calls[0]!), /JSON Schema/)
  assert.match(calls[0]!.url, /models\/gem-model:generateContent/)
  assert.equal(calls[0]!.headers['x-goog-api-key'], 'gem-key')
})

test('generateObject retries once, feeding the validation error back', async () => {
  const calls = mockFetch(json(textBody('{"id":"a","score":"high"}')), json(textBody('{"id":"a","score":7}')))
  const out = await makeService().ai.generateObject({ task: 't', prompt: 'p', schema: Pick })
  assert.deepEqual(out, { id: 'a', score: 7 })
  assert.equal(calls.length, 2)
  assert.match(promptOf(calls[1]!), /rejected by validation/)
})

test('generateObject retries once on invalid JSON', async () => {
  const calls = mockFetch(json(textBody('not json at all')), json(textBody('{"id":"b","score":1}')))
  const out = await makeService().ai.generateObject({ task: 't', prompt: 'p', schema: Pick })
  assert.equal(out.id, 'b')
  assert.match(promptOf(calls[1]!), /not valid JSON/)
})

test('generateObject accepts JSON wrapped in code fences or preceded by <think> reasoning', async () => {
  mockFetch(json(textBody('```json\n{"id":"f","score":1}\n```')))
  assert.equal((await makeService().ai.generateObject({ task: 't', prompt: 'p', schema: Pick })).id, 'f')
  mockFetch(json(textBody('<think>let me see</think>\n{"id":"t","score":2}')))
  assert.equal((await makeService().ai.generateObject({ task: 't', prompt: 'p', schema: Pick })).id, 't')
  mockFetch(json(textBody('Sure! Here it is: {"id":"x","score":3} hope that helps')))
  assert.equal((await makeService().ai.generateObject({ task: 't', prompt: 'p', schema: Pick })).id, 'x')
})

test('generateObject gives up after two unusable answers', async () => {
  const calls = mockFetch(json(textBody('{"id":1}')), json(textBody('{"id":2}')))
  await assert.rejects(makeService().ai.generateObject({ task: 't', prompt: 'p', schema: Pick }), BadGatewayException)
  assert.equal(calls.length, 2)
})

test('generateObject refuses to run when no provider has a key', async () => {
  mockFetch()
  await assert.rejects(makeService([]).ai.generateObject({ task: 't', prompt: 'p', schema: Pick }), (e: unknown) => e instanceof BadRequestException && /Settings → AI models/.test((e as Error).message))
})

// ---- upstream errors --------------------------------------------------------

test('retryAfterSeconds reads Google\'s and Groq\'s "retry in" hints', () => {
  assert.equal(retryAfterSeconds('Please retry in 1h27m33.527053896s.'), 1 * 3600 + 27 * 60 + 33.527053896)
  assert.equal(retryAfterSeconds('Please retry in 12m5s'), 12 * 60 + 5)
  assert.equal(retryAfterSeconds('Please retry in 42.3s.'), 42.3)
  assert.equal(retryAfterSeconds('Rate limit reached. Please try again in 7m12s.'), 7 * 60 + 12)
  assert.equal(retryAfterSeconds('quota exceeded'), null)
  assert.equal(retryAfterSeconds(undefined), null)
})

test('a quota error that resets in an hour fails fast with a clear 429 and no retries', async () => {
  const calls = mockFetch(json({ error: { message: 'You exceeded your current quota. Please retry in 1h27m33.5s.' } }, 429))
  await assert.rejects(makeService().ai.generateObject({ task: 't', prompt: 'p', schema: Pick }), (error: unknown) => {
    return error instanceof HttpException && error.getStatus() === 429 && /quota for model "gem-model" on Google Gemini/.test(error.message) && /1h 28m/.test(error.message)
  })
  assert.equal(calls.length, 1)
})

test('the Retry-After header also triggers the fast-fail (OpenAI-style providers)', async () => {
  const calls = mockFetch(json({ error: { message: 'Rate limit reached' } }, 429, { 'retry-after': '3600' }))
  await assert.rejects(makeService([groq]).ai.generateObject({ task: 't', prompt: 'p', schema: Pick }), (error: unknown) => error instanceof HttpException && error.getStatus() === 429 && /on Groq/.test(error.message))
  assert.equal(calls.length, 1)
})

test('a short rate limit is still retried', async () => {
  const calls = mockFetch(json({ error: { message: 'Slow down. Please retry in 1s.' } }, 429), json(textBody('{"id":"a","score":1}')))
  const out = await makeService().ai.generateObject({ task: 't', prompt: 'p', schema: Pick })
  assert.equal(out.id, 'a')
  assert.equal(calls.length, 2)
})

test('an upstream 402 (no credits) fails immediately without retrying', async () => {
  const calls = mockFetch(json({ error: { message: 'credits depleted' } }, 402))
  await assert.rejects(makeService().ai.generateObject({ task: 't', prompt: 'p', schema: Pick }), /credits depleted/)
  assert.equal(calls.length, 1)
})

// ---- provider selection and fallback ---------------------------------------

test('an OpenAI-compatible provider gets a chat-completions request with bearer auth and JSON mode', async () => {
  const calls = mockFetch(json(chatBody('{"id":"g","score":5}')))
  const out = await makeService([groq]).ai.generateObject({ task: 't', prompt: 'hello', schema: Pick })
  assert.deepEqual(out, { id: 'g', score: 5 })
  assert.equal(calls[0]!.url, 'https://api.groq.com/openai/v1/chat/completions')
  assert.equal(calls[0]!.headers.Authorization, 'Bearer groq-key')
  assert.equal(calls[0]!.body!.model, 'groq-model')
  assert.deepEqual(calls[0]!.body!.response_format, { type: 'json_object' })
  assert.match(calls[0]!.body!.messages[0].content, /hello/)
})

test('a provider without reliable JSON mode relies on the prompt (no response_format)', async () => {
  const calls = mockFetch(json(chatBody('{"id":"c","score":1}')))
  await makeService([cerebras]).ai.generateObject({ task: 't', prompt: 'p', schema: Pick })
  assert.equal(calls[0]!.url, 'https://api.cerebras.ai/v1/chat/completions')
  assert.equal(calls[0]!.body!.response_format, undefined)
})

test('when the chosen provider fails, the fallback answers', async () => {
  const calls = mockFetch(json({ error: { message: 'invalid api key' } }, 401), json(textBody('{"id":"fb","score":9}')))
  const { ai } = makeService([groq, gemini])
  const out = await ai.generateObject({ task: 't', prompt: 'p', schema: Pick })
  assert.equal(out.id, 'fb')
  assert.match(calls[0]!.url, /api\.groq\.com/)
  assert.match(calls[1]!.url, /generativelanguage\.googleapis\.com/)
})

test('the fallback is not used when the chosen provider succeeds', async () => {
  const calls = mockFetch(json(chatBody('{"id":"first","score":1}')))
  const out = await makeService([groq, gemini]).ai.generateObject({ task: 't', prompt: 'p', schema: Pick })
  assert.equal(out.id, 'first')
  assert.equal(calls.length, 1)
})

test('when every provider fails, the last error is reported', async () => {
  mockFetch(json({ error: { message: 'groq down' } }, 401), json({ error: { message: 'gemini bad key' } }, 403))
  await assert.rejects(makeService([groq, gemini]).ai.generateObject({ task: 't', prompt: 'p', schema: Pick }), /gemini bad key/)
})

// ---- runWithTools -----------------------------------------------------------

const echoTool = (seen: Record<string, unknown>[]): AiTool => ({
  name: 'echo',
  description: 'echo',
  parameters: { type: 'OBJECT', properties: { days: { type: 'INTEGER' } } },
  handler: async (args) => {
    seen.push(args)
    return { echoed: args }
  }
})

test('runWithTools (Gemini) runs the requested tool and returns the final text', async () => {
  const seen: Record<string, unknown>[] = []
  const calls = mockFetch(json(callBody('echo', { days: 7 })), json(textBody('final answer')))
  const out = await makeService().ai.runWithTools({ task: 't', system: 's', history: [], question: 'q', tools: [echoTool(seen)] })
  assert.deepEqual(out, { text: 'final answer', toolsUsed: ['echo'] })
  assert.deepEqual(seen, [{ days: 7 }])
  // The tool result goes back to the model as a functionResponse, and the model's own parts are echoed.
  const last = calls[1]!.body!.contents.at(-1)
  assert.equal(last.parts[0].functionResponse.name, 'echo')
  assert.deepEqual(last.parts[0].functionResponse.response.result, { echoed: { days: 7 } })
  assert.deepEqual(calls[1]!.body!.contents.at(-2).parts, [{ functionCall: { name: 'echo', args: { days: 7 } } }])
  assert.equal(calls[0]!.body!.systemInstruction.parts[0].text, 's')
})

test('runWithTools (OpenAI-compatible) sends lower-case tool schemas and echoes tool_call ids', async () => {
  const seen: Record<string, unknown>[] = []
  const calls = mockFetch(json(chatBody(null, [{ id: 'abc', name: 'echo', args: { days: 3 } }])), json(chatBody('done')))
  const out = await makeService([groq]).ai.runWithTools({ task: 't', system: 'sys', history: [], question: 'q', tools: [echoTool(seen)] })
  assert.deepEqual(out, { text: 'done', toolsUsed: ['echo'] })
  assert.deepEqual(seen, [{ days: 3 }])

  const first = calls[0]!.body!
  assert.equal(first.messages[0].role, 'system')
  assert.equal(first.tools[0].type, 'function')
  assert.equal(first.tools[0].function.parameters.type, 'object')
  assert.equal(first.tools[0].function.parameters.properties.days.type, 'integer')
  assert.equal(first.response_format, undefined)

  const second = calls[1]!.body!.messages
  const assistant = second.find((m: any) => m.role === 'assistant')
  assert.equal(assistant.tool_calls[0].id, 'abc')
  assert.equal(assistant.tool_calls[0].function.arguments, '{"days":3}')
  const tool = second.find((m: any) => m.role === 'tool')
  assert.equal(tool.tool_call_id, 'abc')
  assert.deepEqual(JSON.parse(tool.content), { echoed: { days: 3 } })
})

test('runWithTools tolerates malformed tool-call arguments from a provider', async () => {
  const seen: Record<string, unknown>[] = []
  mockFetch(json(chatBody(null, [{ id: 'x', name: 'echo', args: '{not json' }])), json(chatBody('ok')))
  const out = await makeService([groq]).ai.runWithTools({ task: 't', system: 's', history: [], question: 'q', tools: [echoTool(seen)] })
  assert.equal(out.text, 'ok')
  assert.deepEqual(seen, [{}])
})

test('runWithTools stays on the provider that answered the first step', async () => {
  const { ai, settings } = makeService([groq, gemini])
  mockFetch(json(chatBody(null, [{ id: '1', name: 'echo', args: {} }])), json(chatBody(null, [{ id: '2', name: 'echo', args: {} }])), json(chatBody('end')))
  await ai.runWithTools({ task: 't', system: 's', history: [], question: 'q', tools: [echoTool([])] })
  assert.equal(settings.calls.targets, 1)
})

test('runWithTools tells the model when it asks for an unknown tool', async () => {
  const calls = mockFetch(json(callBody('nope', {})), json(textBody('done')))
  const out = await makeService().ai.runWithTools({ task: 't', system: 's', history: [], question: 'q', tools: [echoTool([])] })
  assert.deepEqual(out, { text: 'done', toolsUsed: [] })
  assert.match(JSON.stringify(calls[1]!.body!.contents.at(-1)), /Unknown tool/)
})

test('runWithTools survives a throwing tool and hides its error details', async () => {
  const boom: AiTool = { name: 'boom', description: 'x', parameters: { type: 'OBJECT', properties: {} }, handler: async () => Promise.reject(new Error('secret db detail')) }
  const calls = mockFetch(json(callBody('boom', {})), json(textBody('ok')))
  const out = await makeService().ai.runWithTools({ task: 't', system: 's', history: [], question: 'q', tools: [boom] })
  assert.equal(out.text, 'ok')
  const sent = JSON.stringify(calls[1]!.body!.contents.at(-1))
  assert.match(sent, /failed to run/)
  assert.doesNotMatch(sent, /secret db detail/)
})

test('runWithTools stops after maxSteps', async () => {
  const calls = mockFetch(json(callBody('echo', {})), json(callBody('echo', {})), json(callBody('echo', {})))
  await assert.rejects(makeService().ai.runWithTools({ task: 't', system: 's', history: [], question: 'q', tools: [echoTool([])], maxSteps: 2 }), /too many steps/)
  assert.equal(calls.length, 2)
})

test('runWithTools sends earlier turns as history', async () => {
  const calls = mockFetch(json(textBody('hi')))
  await makeService().ai.runWithTools({
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
    calls[0]!.body!.contents.map((c: any) => [c.role, c.parts[0].text]),
    [
      ['user', 'first'],
      ['model', 'reply'],
      ['user', 'second']
    ]
  )
})

// ---- cap and usage ----------------------------------------------------------

test('the daily cap blocks calls beyond the limit with a 429', async () => {
  const calls = mockFetch(json(textBody('{"id":"a","score":1}')), json(textBody('{"id":"a","score":1}')))
  const { ai } = makeService([gemini], fakeRedis(), 2)
  await ai.generateObject({ task: 't', prompt: 'p', schema: Pick })
  await ai.generateObject({ task: 't', prompt: 'p', schema: Pick })
  await assert.rejects(ai.generateObject({ task: 't', prompt: 'p', schema: Pick }), (error: unknown) => error instanceof HttpException && error.getStatus() === 429)
  assert.equal(calls.length, 2)
})

test('a fallback attempt does not count as a second request against the cap', async () => {
  mockFetch(json({ error: { message: 'bad key' } }, 401), json(textBody('{"id":"a","score":1}')))
  const redis = fakeRedis()
  await makeService([groq, gemini], redis).ai.generateObject({ task: 't', prompt: 'p', schema: Pick })
  assert.equal([...redis.hashes.values()][0]!.calls, 1)
})

test('usage records calls, tokens and calls per task', async () => {
  mockFetch(json(textBody('{"id":"a","score":1}')), json(textBody('{"id":"a","score":1}')))
  const { ai } = makeService()
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
  const out = await makeService([gemini], broken, 1).ai.generateObject({ task: 't', prompt: 'p', schema: Pick })
  assert.equal(out.id, 'a')
})

// ---- testTier ---------------------------------------------------------------

test('testTier reports success with the provider, model and timing', async () => {
  mockFetch(json(chatBody('ok')))
  const result = await makeService([groq]).ai.testTier('smart')
  assert.equal(result.ok, true)
  assert.equal(result.provider, 'groq')
  assert.equal(result.model, 'groq-model')
  assert.equal(typeof result.ms, 'number')
  assert.equal(result.error, null)
})

test('testTier reports the provider error in plain words instead of throwing', async () => {
  mockFetch(json({ error: { message: 'Invalid API Key' } }, 401))
  const result = await makeService([groq]).ai.testTier('fast')
  assert.equal(result.ok, false)
  assert.match(result.error!, /Invalid API Key/)
})

test('testTier says so when nothing is configured', async () => {
  const result = await makeService([]).ai.testTier('fast')
  assert.equal(result.ok, false)
  assert.equal(result.provider, null)
  assert.match(result.error!, /save an API key/)
})
