import type { AiProviderId } from '@amalice/shared'
import { getJson, postJson } from './http'
import type { AiMessage, AiProviderAdapter, AiToolCall, ProviderRequest, ProviderResponse } from './types'

interface OpenAiCompatibleConfig {
  id: AiProviderId
  label: string
  baseUrl: string
  // Where the model list lives when it isn't `${baseUrl}/models` (GitHub Models).
  modelsUrl?: string
  // Whether response_format {type:"json_object"} is reliably supported. When
  // false the prompt alone asks for JSON (AiService validates the answer anyway).
  jsonMode: boolean
  // Keeps only chat-usable models from the provider's /models list.
  keepModel?: (model: { id: string }) => boolean
}

// Tool schemas are written with Gemini's UPPERCASE type names; OpenAI-style
// APIs want JSON Schema's lowercase ones.
function lowerTypes(schema: unknown): unknown {
  return JSON.parse(JSON.stringify(schema), (key, value) => (key === 'type' && typeof value === 'string' ? value.toLowerCase() : value))
}

function toMessages(request: ProviderRequest): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  if (request.system) out.push({ role: 'system', content: request.system })
  for (const message of request.messages as AiMessage[]) {
    if (message.role === 'user') {
      out.push({
        role: 'user',
        content: message.images?.length
          ? [{ type: 'text', text: message.text }, ...message.images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mimeType};base64,${i.base64}` } }))]
          : message.text
      })
    } else if (message.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: message.text ?? null,
        ...(message.toolCalls?.length && {
          // Echo the provider's own tool_calls back verbatim when we have them: some
          // add fields that must come back (Google's `extra_content` thought signature).
          tool_calls: Array.isArray(message.raw) && message.raw.length ? message.raw : message.toolCalls.map((c, i) => ({ id: c.id ?? `call_${i}`, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } }))
        })
      })
    } else {
      message.results.forEach((r, i) => out.push({ role: 'tool', tool_call_id: r.id ?? `call_${i}`, content: JSON.stringify(r.result) }))
    }
  }
  return out
}

interface RawToolCall {
  id?: string
  function?: { name?: string; arguments?: string }
  [extra: string]: unknown
}

interface ChatCompletion {
  choices?: { message?: { content?: string | null; tool_calls?: RawToolCall[] } }[]
  usage?: { total_tokens?: number }
}

// One adapter for every provider that speaks the OpenAI chat-completions API
// (Groq, Cerebras, OpenRouter, Mistral).
export function openAiCompatible(config: OpenAiCompatibleConfig): AiProviderAdapter {
  return {
    id: config.id,

    async chat(request: ProviderRequest): Promise<ProviderResponse> {
      const json = await postJson<ChatCompletion>({
        label: config.label,
        model: request.model,
        url: `${config.baseUrl}/chat/completions`,
        headers: { Authorization: `Bearer ${request.apiKey}` },
        body: {
          model: request.model,
          messages: toMessages(request),
          temperature: request.temperature,
          ...(request.tools?.length && { tools: request.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: lowerTypes(t.parameters) } })) }),
          ...(request.json && config.jsonMode && { response_format: { type: 'json_object' } })
        }
      })
      const message = json.choices?.[0]?.message
      const toolCalls: AiToolCall[] = (message?.tool_calls ?? [])
        .filter((c) => c.function?.name)
        .map((c, i) => {
          let args: Record<string, unknown> = {}
          try {
            const parsed = JSON.parse(c.function!.arguments || '{}')
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) args = parsed
          } catch {
            // malformed arguments: call the tool with none rather than failing the answer
          }
          return { id: c.id ?? `call_${i}`, name: c.function!.name!, args }
        })
      // Only worth echoing back when every call carries an id (the tool results are matched by id).
      const rawCalls = message?.tool_calls ?? []
      return {
        text: (message?.content ?? '').trim(),
        toolCalls,
        rawAssistant: toolCalls.length && rawCalls.length === toolCalls.length && rawCalls.every((c) => c.id) ? rawCalls : undefined,
        tokens: json.usage?.total_tokens ?? 0
      }
    },

    async listModels(apiKey: string): Promise<string[]> {
      // Most providers answer { data: [{ id }] }; some a bare array, or { models: [...] }.
      const json = await getJson<unknown>(config.label, config.modelsUrl ?? `${config.baseUrl}/models`, { Authorization: `Bearer ${apiKey}` })
      const body = json as { data?: unknown; models?: unknown } | null
      const list: { id?: unknown }[] = Array.isArray(json) ? json : Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : []
      return list
        .filter((m): m is { id: string } => !!m && typeof m.id === 'string' && (config.keepModel?.({ id: m.id }) ?? true))
        .map((m) => m.id)
        .sort()
    }
  }
}
