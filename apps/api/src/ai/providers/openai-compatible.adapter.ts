import type { AiProviderId } from '@amalice/shared'
import { getJson, postJson } from './http'
import type { AiMessage, AiProviderAdapter, AiToolCall, ProviderRequest, ProviderResponse } from './types'

interface OpenAiCompatibleConfig {
  id: AiProviderId
  label: string
  baseUrl: string
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
          tool_calls: message.toolCalls.map((c, i) => ({ id: c.id ?? `call_${i}`, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } }))
        })
      })
    } else {
      message.results.forEach((r, i) => out.push({ role: 'tool', tool_call_id: r.id ?? `call_${i}`, content: JSON.stringify(r.result) }))
    }
  }
  return out
}

interface ChatCompletion {
  choices?: { message?: { content?: string | null; tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[] } }[]
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
      return { text: (message?.content ?? '').trim(), toolCalls, tokens: json.usage?.total_tokens ?? 0 }
    },

    async listModels(apiKey: string): Promise<string[]> {
      const json = await getJson<{ data?: { id: string }[] }>(config.label, `${config.baseUrl}/models`, { Authorization: `Bearer ${apiKey}` })
      return (json.data ?? [])
        .filter((m) => typeof m.id === 'string' && (config.keepModel?.(m) ?? true))
        .map((m) => m.id)
        .sort()
    }
  }
}
