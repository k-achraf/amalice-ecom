import { BadGatewayException, BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { z } from 'zod'
import type { AiTier, AiTierTestResult } from '@amalice/shared'
import { RedisService } from '../redis/redis.service'
import { AiSettingsService, type AiResolvedTarget } from './ai-settings.service'
import { adapterFor, type AiImage, type AiMessage, type ProviderRequest, type ProviderResponse } from './providers'

const USAGE_TTL_SECONDS = 35 * 86_400

export type { AiImage }

export interface AiUsageDay {
  date: string
  calls: number
  tokens: number
  byTask: Record<string, number>
}

// Algiers calendar day (UTC+1 all year), so "today" matches the daily report.
const usageDay = (offsetDays = 0): string => new Date(Date.now() + 3_600_000 - offsetDays * 86_400_000).toISOString().slice(0, 10)

// A read-only data lookup the model may call. `parameters` is a Gemini
// (OpenAPI-subset) schema with UPPERCASE types, same as the rest of this repo's
// Gemini code (the OpenAI-style adapter lower-cases them). The handler returns
// plain JSON-serialisable data.
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

// Models sometimes wrap JSON in ```json fences, or prepend <think> reasoning.
function parseJsonLoose(text: string): unknown {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.search(/[{[]/)
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
    if (start === -1 || end <= start) throw new Error('no JSON found')
    return JSON.parse(cleaned.slice(start, end + 1))
  }
}

// The one place AI features go through. Callers hand over a prompt and a Zod
// schema and get back a validated, typed object — never raw model text — so
// nothing unvalidated reaches the database or the UI. Which provider/model
// answers is a setting (Settings → AI models): the chosen one for the tier, then
// the optional fallback if it fails. The existing GeminiService (landing pages /
// product editor) is separate and only shares the saved Gemini key.
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)

  constructor(
    private readonly redis: RedisService,
    private readonly settings: AiSettingsService
  ) {}

  async isConfigured(): Promise<boolean> {
    const [fast, smart] = await Promise.all([this.settings.targets('fast'), this.settings.targets('smart')])
    return fast.length > 0 || smart.length > 0
  }

  // Counts one model call against today's cap and records it per task. The
  // counters live in Redis (one hash per Algiers day, kept 35 days) — usage
  // tracking must never take a feature down, so a Redis failure only logs and
  // lets the call through.
  private async reserveCall(task: string): Promise<void> {
    const limit = await this.settings.dailyLimit()
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

  // One logical model call: counted once, sent to the tier's chosen provider
  // and, if that throws (quota, outage, bad key), to the fallback. `pin` fixes
  // the target (a tool conversation must stay on one provider).
  private async send(task: string, tier: 'fast' | 'smart', request: Omit<ProviderRequest, 'apiKey' | 'model'>, pin?: AiResolvedTarget): Promise<{ response: ProviderResponse; target: AiResolvedTarget }> {
    const targets = pin ? [pin] : await this.settings.targets(tier)
    if (targets.length === 0) throw new BadRequestException('The AI is not configured: add a provider API key in Settings → AI models.')
    await this.reserveCall(task)

    let lastError: unknown
    for (const [index, target] of targets.entries()) {
      try {
        const response = await adapterFor(target.provider, target.baseUrl).chat({ ...request, apiKey: target.apiKey, model: target.model })
        this.logger.log(`${task} ${target.provider}/${target.model} tokens=${response.tokens || '?'}`)
        await this.recordTokens(response.tokens)
        return { response, target }
      } catch (error) {
        lastError = error
        if (index < targets.length - 1) this.logger.warn(`${task}: ${target.provider}/${target.model} failed (${(error as Error).message}); trying the fallback`)
      }
    }
    throw lastError
  }

  // Asks for JSON matching `schema`, validates it, and retries once with the
  // validation errors fed back to the model before giving up.
  async generateObject<S extends z.ZodType>(input: GenerateObjectInput<S>): Promise<z.infer<S>> {
    const jsonSchema = JSON.stringify(z.toJSONSchema(input.schema))
    const basePrompt = `${input.prompt}\n\nRespond with ONLY a JSON value that conforms to this JSON Schema (no markdown, no commentary):\n${jsonSchema}`

    let feedback = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      const messages: AiMessage[] = [{ role: 'user', text: basePrompt + feedback, images: input.images }]
      const { response } = await this.send(input.task, input.tier ?? 'fast', { messages, json: true, temperature: input.temperature ?? 0.2 })
      let parsed: unknown
      try {
        parsed = parseJsonLoose(response.text)
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

  // Answers `question` using `tools`: the model may call them (several rounds)
  // and each result is fed back until it writes a final text answer. Tool
  // handlers must be read-only — the model decides when and with what
  // arguments they run. `maxSteps` bounds the rounds so a confused model can't
  // loop.
  async runWithTools(input: {
    task: string
    system: string
    history: { role: 'user' | 'assistant'; text: string }[]
    question: string
    tools: AiTool[]
    maxSteps?: number
    tier?: 'fast' | 'smart'
  }): Promise<{ text: string; toolsUsed: string[] }> {
    const byName = new Map(input.tools.map((t) => [t.name, t]))
    const toolsUsed = new Set<string>()
    const specs = input.tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }))
    const messages: AiMessage[] = [...input.history.map((m): AiMessage => (m.role === 'user' ? { role: 'user', text: m.text } : { role: 'assistant', text: m.text })), { role: 'user', text: input.question }]

    let pinned: AiResolvedTarget | undefined
    for (let step = 0; step < (input.maxSteps ?? 6); step++) {
      const { response, target } = await this.send(input.task, input.tier ?? 'smart', { system: input.system, messages, tools: specs, temperature: 0.2 }, pinned)
      pinned = target
      if (response.toolCalls.length === 0) {
        if (!response.text) throw new BadGatewayException('The AI returned no answer.')
        return { text: response.text, toolsUsed: [...toolsUsed] }
      }

      messages.push({ role: 'assistant', text: response.text || undefined, toolCalls: response.toolCalls, raw: response.rawAssistant })
      const results: { id?: string; name: string; result: unknown }[] = []
      for (const call of response.toolCalls) {
        const tool = byName.get(call.name)
        let result: unknown
        if (!tool) {
          result = { error: `Unknown tool "${call.name}".` }
        } else {
          toolsUsed.add(call.name)
          try {
            result = await tool.handler(call.args)
          } catch (error) {
            this.logger.warn(`tool ${call.name} failed: ${(error as Error).message}`)
            result = { error: 'The tool failed to run.' }
          }
        }
        results.push({ id: call.id, name: call.name, result })
      }
      messages.push({ role: 'tool', results })
    }
    throw new BadGatewayException('The AI needed too many steps to answer — try a more specific question.')
  }

  // Settings → AI models "Test": one tiny request against exactly the chosen
  // target of a tier (no fallback), so the owner learns whether it works.
  async testTier(tier: AiTier): Promise<AiTierTestResult> {
    const target = await this.settings.targetFor(tier)
    if (!target) return { ok: false, provider: null, model: null, ms: null, error: 'Nothing is configured for this tier: save an API key and choose a model first.' }
    const started = Date.now()
    try {
      await this.reserveCall('test')
      const response = await adapterFor(target.provider, target.baseUrl).chat({
        apiKey: target.apiKey,
        model: target.model,
        messages: [{ role: 'user', text: 'Reply with the single word: ok' }],
        temperature: 0
      })
      await this.recordTokens(response.tokens)
      if (!response.text) return { ok: false, provider: target.provider, model: target.model, ms: Date.now() - started, error: 'The model answered with no text.' }
      return { ok: true, provider: target.provider, model: target.model, ms: Date.now() - started, error: null }
    } catch (error) {
      return { ok: false, provider: target.provider, model: target.model, ms: Date.now() - started, error: (error as Error).message }
    }
  }
}
