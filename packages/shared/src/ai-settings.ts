import { z } from 'zod'

// AI model settings (admin → Settings → AI models, SuperAdmin). The owner stores
// an API key per provider, then picks which provider + model serves each tier
// ('fast' = classification/cleanup/daily insight, 'smart' = the business
// assistant's tool loop) and an optional fallback used when the primary one
// fails (quota, outage). Keys are write-only: they are encrypted at rest and
// never returned to the browser.

export const AI_PROVIDER_IDS = ['gemini', 'groq', 'cerebras', 'github', 'nvidia', 'sambanova', 'openrouter', 'mistral', 'huggingface', 'zai', 'custom'] as const
export const AiProviderIdSchema = z.enum(AI_PROVIDER_IDS)
export type AiProviderId = z.infer<typeof AiProviderIdSchema>

export interface AiProviderInfo {
  id: AiProviderId
  label: string
  // Where the owner creates a key.
  keyUrl: string
  // One short, hedged line about the free plan. Quotas change and differ per
  // model, so exact numbers are deliberately NOT stated: the provider's own
  // console is the source of truth.
  note: string
  // Starting points only — the real, current list comes from the provider with
  // the owner's key (GET /admin/ai/providers/:id/models), and the per-tier Test
  // button proves a choice works.
  suggested: { fast: string; smart: string }
  // The "Custom endpoint" provider: any OpenAI-compatible service. The owner
  // supplies the base URL; the key is optional (local servers need none).
  custom?: true
}

export const AI_PROVIDERS: Record<AiProviderId, AiProviderInfo> = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    note: 'Free tier with a small per-model daily request limit; create the key in a project without billing to stay on it.',
    suggested: { fast: 'gemini-3.1-flash-lite', smart: 'gemini-3.5-flash' }
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    keyUrl: 'https://console.groq.com/keys',
    note: 'Free tier, rate-limited per model (check your console for the current numbers). Supports tool calling.',
    suggested: { fast: 'llama-3.1-8b-instant', smart: 'openai/gpt-oss-120b' }
  },
  cerebras: {
    id: 'cerebras',
    label: 'Cerebras',
    keyUrl: 'https://cloud.cerebras.ai/',
    note: 'Free tier with rate limits that change; check your account for what applies today.',
    suggested: { fast: 'gpt-oss-120b', smart: 'gpt-oss-120b' }
  },
  github: {
    id: 'github',
    label: 'GitHub Models',
    keyUrl: 'https://github.com/settings/personal-access-tokens/new',
    note: 'Free for prototyping, rate-limited per model and per day. The key is a GitHub fine-grained token with the "Models: read" permission. GitHub says the free tier is not meant for production.',
    suggested: { fast: 'openai/gpt-4.1-mini', smart: 'openai/gpt-4.1' }
  },
  nvidia: {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    keyUrl: 'https://build.nvidia.com/settings/api-keys',
    note: 'Free key for NVIDIA Developer Program members, reported at about 40 requests per minute (varies by model and load; not an official figure).',
    suggested: { fast: 'meta/llama-3.1-8b-instruct', smart: 'meta/llama-3.3-70b-instruct' }
  },
  sambanova: {
    id: 'sambanova',
    label: 'SambaNova',
    keyUrl: 'https://cloud.sambanova.ai/apis',
    note: 'A free tier with a small daily allowance on a short list of models; sources disagree on the exact numbers, so check your console.',
    suggested: { fast: 'DeepSeek-V3.1', smart: 'DeepSeek-V3.1' }
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    keyUrl: 'https://openrouter.ai/keys',
    note: 'Only models ending in ":free" cost nothing, with a low daily request cap per account; tool-calling support differs per model. Best used as a fallback.',
    suggested: { fast: 'openrouter/free', smart: 'openrouter/free' }
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral',
    keyUrl: 'https://console.mistral.ai/api-keys',
    note: 'The free plan may require opting in to data training and phone verification — check the terms before sending business data.',
    suggested: { fast: 'mistral-small-latest', smart: 'mistral-small-latest' }
  },
  huggingface: {
    id: 'huggingface',
    label: 'Hugging Face',
    keyUrl: 'https://huggingface.co/settings/tokens',
    note: 'Free accounts get only a very small monthly credit, so this runs out fast. Needs a token with permission to call Inference Providers.',
    suggested: { fast: 'meta-llama/Llama-3.1-8B-Instruct', smart: 'openai/gpt-oss-120b' }
  },
  zai: {
    id: 'zai',
    label: 'Z.ai (GLM)',
    keyUrl: 'https://z.ai/manage-apikey/apikey-list',
    note: 'Offers a free "flash" GLM model with strict concurrency limits. One source says its retirement has been announced, so confirm it is still free.',
    suggested: { fast: 'glm-4.5-flash', smart: 'glm-4.5-flash' }
  },
  custom: {
    id: 'custom',
    label: 'Custom endpoint',
    keyUrl: 'https://platform.openai.com/docs/api-reference/chat',
    note: 'Any service that speaks the OpenAI chat-completions API: Ollama on your own server (http://localhost:11434/v1), Cloudflare Workers AI (https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/ai/v1), Together, Fireworks, DeepSeek… Give its base URL, and a key if it needs one.',
    suggested: { fast: '', smart: '' },
    custom: true
  }
}

export const AI_TIERS = ['fast', 'smart', 'fallback'] as const
export type AiTier = (typeof AI_TIERS)[number]

export const AiModelTargetSchema = z.object({
  provider: AiProviderIdSchema,
  model: z.string().trim().min(1).max(120)
})
export type AiModelTarget = z.infer<typeof AiModelTargetSchema>

// Omitted = unchanged; null = clear (back to the default / no fallback).
export const UpdateAiSettingsSchema = z.object({
  fast: AiModelTargetSchema.nullable().optional(),
  smart: AiModelTargetSchema.nullable().optional(),
  fallback: AiModelTargetSchema.nullable().optional(),
  // Max model requests per Algiers day across all AI features; 0 = no cap, null = use the server default.
  dailyCallLimit: z.number().int().min(0).max(1_000_000).nullable().optional()
})
export type UpdateAiSettings = z.infer<typeof UpdateAiSettingsSchema>

// `apiKey` is required for every provider except the custom endpoint (a local
// server may need none); `baseUrl` is required for (and only used by) the
// custom endpoint. Both rules are checked server-side per provider.
export const SetAiProviderKeySchema = z.object({
  apiKey: z.string().trim().max(500).default(''),
  baseUrl: z.string().trim().max(300).optional()
})
export type SetAiProviderKey = z.infer<typeof SetAiProviderKeySchema>

export const AiTierTestSchema = z.object({ tier: z.enum(AI_TIERS) })
export type AiTierTest = z.infer<typeof AiTierTestSchema>

// A custom endpoint must be https, except plain http to this machine (a local
// model server). No credentials, query string or fragment in the URL. Returns
// the normalised URL (no trailing slash), or null when it isn't acceptable.
export function normalizeAiBaseUrl(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return null
  if (url.username || url.password || url.search || url.hash) return null
  return url.toString().replace(/\/+$/, '')
}

export interface AiProviderView extends AiProviderInfo {
  hasKey: boolean
  // Where the key in use comes from: saved here, or the server's env var (Gemini only).
  keySource: 'settings' | 'env' | null
  // Last 4 characters of a saved key, to recognise which one it is.
  keyHint: string | null
  // The custom endpoint's saved base URL (null for every other provider).
  baseUrl: string | null
}

export interface AiSettingsView {
  providers: AiProviderView[]
  // What the owner chose (null = not chosen: the default applies).
  fast: AiModelTarget | null
  smart: AiModelTarget | null
  fallback: AiModelTarget | null
  // What will actually run for each tier right now (null = nothing configured).
  effective: { fast: AiModelTarget | null; smart: AiModelTarget | null }
  dailyCallLimit: number | null
  // The cap in force (settings value, else the server default).
  effectiveDailyCallLimit: number
}

export interface AiProviderModelsResult {
  ok: boolean
  models: string[]
  error: string | null
}

export interface AiTierTestResult {
  ok: boolean
  provider: AiProviderId | null
  model: string | null
  ms: number | null
  // What went wrong, in plain words.
  error: string | null
}
