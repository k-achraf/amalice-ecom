import { BadGatewayException, BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { z } from 'zod'
import type { Env } from '../config/env.validation'
import { RedisService } from '../redis/redis.service'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const MAX_HTTP_ATTEMPTS = 3
const USAGE_TTL_SECONDS = 35 * 86_400

export interface AiUsageDay {
  date: string
  calls: number
  tokens: number
  byTask: Record<string, number>
}

// Google's quota errors say "Please retry in 1h27m33.5s" / "retry in 42.3s".
// Returns that wait in seconds, or null when the message has none.
export function retryAfterSeconds(message: string | undefined): number | null {
  const match = message?.match(/retry in\s+((?:\d+h)?(?:\d+m(?!s))?(?:[\d.]+s)?)/i)
  if (!match?.[1]) return null
  const hours = /(\d+)h/.exec(match[1])
  const minutes = /(\d+)m(?!s)/.exec(match[1])
  const seconds = /([\d.]+)s/.exec(match[1])
  const total = (hours ? Number(hours[1]) * 3600 : 0) + (minutes ? Number(minutes[1]) * 60 : 0) + (seconds ? parseFloat(seconds[1]!) : 0)
  return total > 0 ? total : null
}

const formatWait = (seconds: number): string =>
  seconds >= 3600 ? `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m` : seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${Math.round(seconds)}s`

// A quota that resets in more than this is not worth retrying in-request.
const MAX_RETRYABLE_WAIT_SECONDS = 30

// Algiers calendar day (UTC+1 all year), so "today" matches the daily report.
const usageDay = (offsetDays = 0): string => new Date(Date.now() + 3_600_000 - offsetDays * 86_400_000).toISOString().slice(0, 10)

export interface AiImage {
  base64: string
  mimeType: string
}

// A read-only data lookup the model may call. `parameters` is a Gemini
// (OpenAPI-subset) schema with UPPERCASE types, same as the rest of this repo's
// Gemini code. The handler returns plain JSON-serialisable data.
export interface AiTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  handler: (args: Record<string, unknown>) => Promise<unknown>
}

export interface GenerateObjectInput<S extends z.ZodType> {
  // Short label for logs/usage ("address-normalize", "cancel-reason"…).
  task: string
  prompt: string
  schema: S
  images?: AiImage[]
  temperature?: number
  // 'fast' = cheap classification/cleanup; 'smart' = analysis and long copy.
  tier?: 'fast' | 'smart'
}

interface GeminiPart {
  text?: string
  functionCall?: { name: string; args?: Record<string, unknown> }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[]
  promptFeedback?: { blockReason?: string }
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
  error?: { message?: string }
}

// The one place new AI features go through. Callers hand over a prompt and a
// Zod schema and get back a validated, typed object — never raw model text — so
// nothing unvalidated reaches the database or the UI. The existing
// GeminiService (landing pages / product editor) is untouched; new features use
// this. The provider is an implementation detail: swapping it only changes
// `post()` below.
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly redis: RedisService
  ) {}

  // Counts one model call against today's cap (AI_DAILY_CALL_LIMIT, 0 = no cap)
  // and records it per task. The counters live in Redis (one hash per Algiers
  // day, kept 35 days) — usage tracking must never take a feature down, so a
  // Redis failure only logs and lets the call through.
  private async reserveCall(task: string): Promise<void> {
    const limit = this.config.get('AI_DAILY_CALL_LIMIT', { infer: true }) ?? 0
    const key = `ai:usage:${usageDay()}`
    let calls: number
    try {
      calls = await this.redis.hincrby(key, 'calls', 1)
      await this.redis.hincrby(key, `task:${task}`, 1)
      await this.redis.expire(key, USAGE_TTL_SECONDS)
    } catch (error) {
      this.logger.warn(`AI usage tracking unavailable: ${(error as Error).message}`)
      return
    }
    if (limit > 0 && calls > limit) {
      throw new HttpException(`The daily AI limit (${limit} requests) has been reached. It resets at midnight (Algiers time).`, HttpStatus.TOO_MANY_REQUESTS)
    }
  }

  private async recordTokens(tokens: number): Promise<void> {
    if (!tokens) return
    try {
      await this.redis.hincrby(`ai:usage:${usageDay()}`, 'tokens', tokens)
    } catch {
      // best-effort
    }
  }

  // Usage of the last `days` Algiers days, newest first (for the admin).
  async usage(days = 7): Promise<AiUsageDay[]> {
    const out: AiUsageDay[] = []
    for (let i = 0; i < days; i++) {
      const date = usageDay(i)
      const hash = await this.redis.hgetall(`ai:usage:${date}`).catch(() => ({}) as Record<string, string>)
      const byTask: Record<string, number> = {}
      for (const [field, value] of Object.entries(hash)) if (field.startsWith('task:')) byTask[field.slice(5)] = Number(value)
      out.push({ date, calls: Number(hash.calls ?? 0), tokens: Number(hash.tokens ?? 0), byTask })
    }
    return out
  }

  isConfigured(): boolean {
    return !!this.config.get('GEMINI_API_KEY', { infer: true })
  }

  private model(tier: 'fast' | 'smart'): string {
    return tier === 'fast'
      ? (this.config.get('AI_FAST_MODEL', { infer: true }) ?? 'gemini-flash-lite-latest')
      : (this.config.get('AI_SMART_MODEL', { infer: true }) ?? 'gemini-flash-latest')
  }

  // Asks for JSON matching `schema`, validates it, and retries once with the
  // validation errors fed back to the model before giving up.
  async generateObject<S extends z.ZodType>(input: GenerateObjectInput<S>): Promise<z.infer<S>> {
    const apiKey = this.config.get('GEMINI_API_KEY', { infer: true })
    if (!apiKey) throw new BadRequestException('The AI is not configured (GEMINI_API_KEY is missing).')

    const model = this.model(input.tier ?? 'fast')
    const jsonSchema = JSON.stringify(z.toJSONSchema(input.schema))
    const basePrompt = `${input.prompt}\n\nRespond with ONLY a JSON value that conforms to this JSON Schema (no markdown, no commentary):\n${jsonSchema}`
    const imageParts = (input.images ?? []).map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.base64 } }))

    let feedback = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await this.complete(model, apiKey, input.task, [{ text: basePrompt + feedback }, ...imageParts], input.temperature ?? 0.2)
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        feedback = '\n\nYour previous answer was not valid JSON. Return valid JSON only.'
        continue
      }
      const result = input.schema.safeParse(parsed)
      if (result.success) return result.data
      feedback = `\n\nYour previous answer was rejected by validation:\n${z.prettifyError(result.error)}\nFix every problem and answer again.`
    }
    throw new BadGatewayException(`The AI returned an unusable answer for "${input.task}" — try again.`)
  }

  private async complete(model: string, apiKey: string, task: string, parts: Record<string, unknown>[], temperature: number): Promise<string> {
    const json = await this.post(model, apiKey, task, { contents: [{ parts }], generationConfig: { responseMimeType: 'application/json', temperature } })
    const text = json.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text
    if (!text) throw new BadGatewayException('The AI returned no content.')
    return text
  }

  // Answers `question` using `tools`: the model may call them (several rounds)
  // and each result is fed back until it writes a final text answer. Tool
  // handlers must be read-only — the model decides when and with what
  // arguments they run. `maxSteps` bounds the rounds so a confused model
  // can't loop.
  async runWithTools(input: {
    task: string
    system: string
    history: { role: 'user' | 'assistant'; text: string }[]
    question: string
    tools: AiTool[]
    maxSteps?: number
    tier?: 'fast' | 'smart'
  }): Promise<{ text: string; toolsUsed: string[] }> {
    const apiKey = this.config.get('GEMINI_API_KEY', { infer: true })
    if (!apiKey) throw new BadRequestException('The AI is not configured (GEMINI_API_KEY is missing).')
    const model = this.model(input.tier ?? 'smart')
    const byName = new Map(input.tools.map((t) => [t.name, t]))
    const toolsUsed = new Set<string>()

    const contents: Record<string, unknown>[] = [
      ...input.history.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
      { role: 'user', parts: [{ text: input.question }] }
    ]
    const declarations = input.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }))

    for (let step = 0; step < (input.maxSteps ?? 6); step++) {
      const json = await this.post(model, apiKey, input.task, {
        systemInstruction: { parts: [{ text: input.system }] },
        contents,
        tools: [{ functionDeclarations: declarations }],
        generationConfig: { temperature: 0.2 }
      })
      const content = json.candidates?.[0]?.content
      const calls = (content?.parts ?? []).filter((p) => p.functionCall)
      if (calls.length === 0) {
        const text = (content?.parts ?? []).map((p) => p.text ?? '').join('').trim()
        if (!text) throw new BadGatewayException('The AI returned no answer.')
        return { text, toolsUsed: [...toolsUsed] }
      }

      contents.push({ role: 'model', parts: content!.parts })
      const responses: Record<string, unknown>[] = []
      for (const part of calls) {
        const { name, args } = part.functionCall!
        const tool = byName.get(name)
        let response: unknown
        if (!tool) {
          response = { error: `Unknown tool "${name}".` }
        } else {
          toolsUsed.add(name)
          try {
            response = await tool.handler((args ?? {}) as Record<string, unknown>)
          } catch (error) {
            this.logger.warn(`tool ${name} failed: ${(error as Error).message}`)
            response = { error: 'The tool failed to run.' }
          }
        }
        responses.push({ functionResponse: { name, response: { result: response } } })
      }
      contents.push({ role: 'user', parts: responses })
    }
    throw new BadGatewayException('The AI needed too many steps to answer — try a more specific question.')
  }

  // Gemini's free tier rate-limits (429) and sometimes 5xx under load: retried
  // with backoff so a busy moment doesn't fail the whole feature.
  private async post(model: string, apiKey: string, task: string, body: Record<string, unknown>): Promise<GeminiResponse> {
    await this.reserveCall(task)
    let lastError: Error | null = null
    for (let attempt = 0; attempt < MAX_HTTP_ATTEMPTS; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 2500 * attempt))
      let response: Response
      try {
        response = await fetch(`${API_BASE}/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000)
        })
      } catch (error) {
        lastError = new BadGatewayException(`Could not reach the AI service: ${(error as Error).message}`)
        continue
      }

      const json = (await response.json().catch(() => ({}))) as GeminiResponse
      if (response.status === 429 || response.status >= 500) {
        // A quota that resets in an hour (the free tier's per-model daily
        // limit) can't be fixed by retrying: fail fast with a clear message.
        const wait = response.status === 429 ? retryAfterSeconds(json.error?.message) : null
        if (wait !== null && wait > MAX_RETRYABLE_WAIT_SECONDS) {
          throw new HttpException(
            `The AI quota for model "${model}" is used up (the free tier allows only a limited number of requests per day). Try again in about ${formatWait(wait)}, or set AI_FAST_MODEL / AI_SMART_MODEL to another model, or enable billing.`,
            HttpStatus.TOO_MANY_REQUESTS
          )
        }
        lastError = new BadGatewayException(`AI service error: ${json.error?.message ?? `HTTP ${response.status}`}`)
        continue
      }
      if (!response.ok) throw new BadGatewayException(`AI service error: ${json.error?.message ?? `HTTP ${response.status}`}`)
      if (json.promptFeedback?.blockReason) throw new BadGatewayException(`The AI blocked the request: ${json.promptFeedback.blockReason}`)

      const usage = json.usageMetadata
      this.logger.log(`${task} model=${model} tokens in=${usage?.promptTokenCount ?? '?'} out=${usage?.candidatesTokenCount ?? '?'}`)
      await this.recordTokens(usage?.totalTokenCount ?? (usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0))
      return json
    }
    throw lastError ?? new BadGatewayException('The AI request failed.')
  }
}
