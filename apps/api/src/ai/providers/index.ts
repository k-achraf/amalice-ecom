import type { AiProviderId } from '@amalice/shared'
import { geminiAdapter } from './gemini.adapter'
import { openAiCompatible } from './openai-compatible.adapter'
import type { AiProviderAdapter } from './types'

// Providers with a fixed address. (The custom endpoint's address is the owner's,
// so it is built on demand: see adapterFor.)
export const ADAPTERS: Record<Exclude<AiProviderId, 'custom'>, AiProviderAdapter> = {
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
  // GitHub Models: the chat endpoint is OpenAI-style, but the model catalog lives elsewhere.
  github: openAiCompatible({
    id: 'github',
    label: 'GitHub Models',
    baseUrl: 'https://models.github.ai/inference',
    modelsUrl: 'https://models.github.ai/catalog/models',
    jsonMode: false,
    keepModel: (m) => !/(embedding|embed)/i.test(m.id)
  }),
  nvidia: openAiCompatible({
    id: 'nvidia',
    label: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    jsonMode: false,
    // The catalog also lists embedding, reranking, vision-only and safety models.
    keepModel: (m) => !/(embed|rerank|guard|safety|reward|clip|parse|retriev|nemoguard)/i.test(m.id)
  }),
  sambanova: openAiCompatible({
    id: 'sambanova',
    label: 'SambaNova',
    baseUrl: 'https://api.sambanova.ai/v1',
    jsonMode: false,
    keepModel: (m) => !/(whisper|embed)/i.test(m.id)
  }),
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
  }),
  huggingface: openAiCompatible({ id: 'huggingface', label: 'Hugging Face', baseUrl: 'https://router.huggingface.co/v1', jsonMode: false }),
  zai: openAiCompatible({ id: 'zai', label: 'Z.ai (GLM)', baseUrl: 'https://api.z.ai/api/paas/v4', jsonMode: false })
}

// The adapter for a provider; for the custom endpoint, one pointed at the
// owner's saved base URL (never a request-supplied one).
export function adapterFor(provider: AiProviderId, baseUrl?: string): AiProviderAdapter {
  if (provider !== 'custom') return ADAPTERS[provider]
  if (!baseUrl) throw new Error('The custom endpoint has no base URL saved.')
  return openAiCompatible({ id: 'custom', label: 'Custom endpoint', baseUrl, jsonMode: false })
}

export type { AiProviderAdapter, AiMessage, AiToolCall, AiToolSpec, AiImage, ProviderRequest, ProviderResponse } from './types'
