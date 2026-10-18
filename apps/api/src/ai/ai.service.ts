import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { z } from 'zod'
import type { Env } from '../config/env.validation'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const MAX_HTTP_ATTEMPTS = 3

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

  constructor(private readonly config: ConfigService<Env, true>) {}

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
        lastError = new BadGatewayException(`AI service error: ${json.error?.message ?? `HTTP ${response.status}`}`)
        continue
      }
      if (!response.ok) throw new BadGatewayException(`AI service error: ${json.error?.message ?? `HTTP ${response.status}`}`)
      if (json.promptFeedback?.blockReason) throw new BadGatewayException(`The AI blocked the request: ${json.promptFeedback.blockReason}`)

      const usage = json.usageMetadata
      this.logger.log(`${task} model=${model} tokens in=${usage?.promptTokenCount ?? '?'} out=${usage?.candidatesTokenCount ?? '?'}`)
      return json
    }
    throw lastError ?? new BadGatewayException('The AI request failed.')
  }
}
