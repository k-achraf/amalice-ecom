import type { AiProviderId } from '@amalice/shared'
import { geminiAdapter } from './gemini.adapter'
import { openAiCompatible } from './openai-compatible.adapter'
import type { AiProviderAdapter } from './types'

export const ADAPTERS: Record<AiProviderId, AiProviderAdapter> = {
  gemini: geminiAdapter,
  groq: openAiCompatible({
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    jsonMode: true,
    // The list also holds speech and safety-classifier models.
    keepModel: (m) => !/(whisper|guard|tts|distil-whisper|playai)/i.test(m.id)
  }),
  cerebras: openAiCompatible({ id: 'cerebras', label: 'Cerebras', baseUrl: 'https://api.cerebras.ai/v1', jsonMode: false }),
  // Hundreds of models; only the free ones are useful here.
  openrouter: openAiCompatible({
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    jsonMode: false,
    keepModel: (m) => m.id === 'openrouter/free' || m.id.endsWith(':free')
  }),
  mistral: openAiCompatible({
    id: 'mistral',
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    jsonMode: true,
    keepModel: (m) => !/(embed|moderation|ocr|transcribe)/i.test(m.id)
  })
}

export type { AiProviderAdapter, AiMessage, AiToolCall, AiToolSpec, AiImage, ProviderRequest, ProviderResponse } from './types'
