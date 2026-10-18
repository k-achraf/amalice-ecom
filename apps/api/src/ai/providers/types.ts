import type { AiProviderId } from '@amalice/shared'

export interface AiImage {
  base64: string
  mimeType: string
}

export interface AiToolCall {
  // Provider-assigned id (OpenAI-style APIs need it echoed back with the result).
  id?: string
  name: string
  args: Record<string, unknown>
}

// Provider-neutral conversation. AiService speaks only this; each adapter
// converts it to its provider's wire format.
export type AiMessage =
  | { role: 'user'; text: string; images?: AiImage[] }
  // `raw` is whatever the provider needs echoed back verbatim to continue a
  // tool conversation (Gemini's parts, including thought signatures).
  | { role: 'assistant'; text?: string; toolCalls?: AiToolCall[]; raw?: unknown }
  | { role: 'tool'; results: { id?: string; name: string; result: unknown }[] }

// A tool the model may call. `parameters` uses Gemini's UPPERCASE type names
// (the repo's convention); the OpenAI adapter lower-cases them.
export interface AiToolSpec {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ProviderRequest {
  apiKey: string
  model: string
  system?: string
  messages: AiMessage[]
  tools?: AiToolSpec[]
  // Ask for a JSON object answer (not combined with tools).
  json?: boolean
  temperature: number
}

export interface ProviderResponse {
  text: string
  toolCalls: AiToolCall[]
  rawAssistant?: unknown
  tokens: number
}

export interface AiProviderAdapter {
  id: AiProviderId
  chat(request: ProviderRequest): Promise<ProviderResponse>
  // Model ids usable for chat with this key (also proves the key works).
  listModels(apiKey: string): Promise<string[]>
}
