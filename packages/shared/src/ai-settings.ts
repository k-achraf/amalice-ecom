import { z } from 'zod'

// AI model settings (admin → Settings → AI models, SuperAdmin). The owner stores
// an API key per provider, then picks which provider + model serves each tier
// ('fast' = classification/cleanup/daily insight, 'smart' = the business
// assistant's tool loop) and an optional fallback used when the primary one
// fails (quota, outage). Keys are write-only: they are encrypted at rest and
// never returned to the browser.

export const AI_PROVIDER_IDS = ['gemini', 'groq', 'cerebras', 'openrouter', 'mistral'] as const
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
  // the owner's key (GET /admin/ai/providers/:id/models).
  suggested: { fast: string; smart: string }
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

export const SetAiProviderKeySchema = z.object({
  apiKey: z.string().trim().min(8).max(500)
})
export type SetAiProviderKey = z.infer<typeof SetAiProviderKeySchema>

export const AiTierTestSchema = z.object({ tier: z.enum(AI_TIERS) })
export type AiTierTest = z.infer<typeof AiTierTestSchema>

export interface AiProviderView extends AiProviderInfo {
  hasKey: boolean
  // Where the key in use comes from: saved here, or the server's env var (Gemini only).
  keySource: 'settings' | 'env' | null
  // Last 4 characters of a saved key, to recognise which one it is.
  keyHint: string | null
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
