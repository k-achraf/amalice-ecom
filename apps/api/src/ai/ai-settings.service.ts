import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  AI_PROVIDER_IDS,
  AI_PROVIDERS,
  AiProviderIdSchema,
  normalizeAiBaseUrl,
  type AiModelTarget,
  type AiProviderId,
  type AiProviderModelsResult,
  type AiSettingsView,
  type AiTier,
  type UpdateAiSettings
} from '@amalice/shared'
import type { Env } from '../config/env.validation'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService, type AuditActor } from '../common/audit.service'
import { decryptToken, encryptToken } from '../meta-ads/meta-crypto'
import type { AiSettings } from '../generated/prisma/client'
import { adapterFor } from './providers'

export interface AiResolvedTarget extends AiModelTarget {
  apiKey: string
  // Only the custom endpoint: the owner's saved base URL.
  baseUrl?: string
}

interface Snapshot {
  at: number
  settings: AiSettings | null
  keys: Partial<Record<AiProviderId, string>>
  hints: Partial<Record<AiProviderId, string>>
  baseUrls: Partial<Record<AiProviderId, string>>
}

const SNAPSHOT_TTL_MS = 30_000
const DEFAULT_MODELS = { fast: 'gemini-flash-lite-latest', smart: 'gemini-flash-latest' } as const

const pair = (provider: string | null | undefined, model: string | null | undefined): AiModelTarget | null => {
  const parsed = AiProviderIdSchema.safeParse(provider)
  return parsed.success && model ? { provider: parsed.data, model } : null
}

// Which provider + model serves each AI tier, and the API keys behind them.
// Keys are AES-256-GCM encrypted at rest (same scheme and secret as the Meta
// tokens) and are never returned by view(). Reads are served from a 30 s
// snapshot so a model call doesn't cost two extra queries.
@Injectable()
export class AiSettingsService implements OnModuleInit {
  private readonly logger = new Logger(AiSettingsService.name)
  private snap: Snapshot | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: AuditService
  ) {}

  async onModuleInit() {
    // Warm the snapshot so cachedKey() works from the first request.
    await this.snapshot().catch((error) => this.logger.warn(`AI settings not loaded yet: ${(error as Error).message}`))
  }

  private secret(): string {
    return this.config.get('META_TOKEN_ENCRYPTION_KEY', { infer: true }) ?? this.config.get('JWT_SECRET', { infer: true })
  }

  private async snapshot(force = false): Promise<Snapshot> {
    if (!force && this.snap && Date.now() - this.snap.at < SNAPSHOT_TTL_MS) return this.snap
    const [settings, rows] = await Promise.all([this.prisma.aiSettings.findUnique({ where: { id: 'singleton' } }), this.prisma.aiProviderCredential.findMany()])
    const keys: Snapshot['keys'] = {}
    const hints: Snapshot['hints'] = {}
    const baseUrls: Snapshot['baseUrls'] = {}
    for (const row of rows) {
      const id = AiProviderIdSchema.safeParse(row.provider)
      if (!id.success) continue
      try {
        keys[id.data] = decryptToken(row.apiKeyEncrypted, this.secret())
        hints[id.data] = row.keyHint
        if (row.baseUrl) baseUrls[id.data] = row.baseUrl
      } catch {
        // The encryption secret changed: treat the key as missing so the owner re-enters it.
        this.logger.warn(`Could not decrypt the saved ${row.provider} key — enter it again in Settings → AI models.`)
      }
    }
    this.snap = { at: Date.now(), settings, keys, hints, baseUrls }
    return this.snap
  }

  // Synchronous read for code that can't await (the legacy GeminiService).
  // Only reflects the last snapshot; undefined when no key was saved here.
  cachedKey(provider: AiProviderId): string | undefined {
    return this.snap?.keys[provider]
  }

  private keyOf(snap: Snapshot, provider: AiProviderId): { key: string; source: 'settings' | 'env'; baseUrl?: string } | null {
    const saved = snap.keys[provider]
    if (provider === 'custom') {
      // The custom endpoint is only usable with its base URL.
      const baseUrl = snap.baseUrls.custom
      return saved && baseUrl ? { key: saved, source: 'settings', baseUrl } : null
    }
    if (saved) return { key: saved, source: 'settings' }
    const env = provider === 'gemini' ? this.config.get('GEMINI_API_KEY', { infer: true }) : undefined
    return env ? { key: env, source: 'env' } : null
  }

  private chosen(snap: Snapshot, tier: AiTier): AiModelTarget | null {
    const s = snap.settings
    if (!s) return null
    return tier === 'fast' ? pair(s.fastProvider, s.fastModel) : tier === 'smart' ? pair(s.smartProvider, s.smartModel) : pair(s.fallbackProvider, s.fallbackModel)
  }

  private defaultTarget(tier: 'fast' | 'smart'): AiModelTarget {
    const override = this.config.get(tier === 'fast' ? 'AI_FAST_MODEL' : 'AI_SMART_MODEL', { infer: true })
    return { provider: 'gemini', model: override ?? DEFAULT_MODELS[tier] }
  }

  // Targets to try, in order, for a tier: the chosen (or default) one, then the
  // fallback — only those that have an API key.
  async targets(tier: 'fast' | 'smart'): Promise<AiResolvedTarget[]> {
    const snap = await this.snapshot()
    const candidates = [this.chosen(snap, tier) ?? this.defaultTarget(tier), this.chosen(snap, 'fallback')]
    const out: AiResolvedTarget[] = []
    for (const target of candidates) {
      if (!target || out.some((t) => t.provider === target.provider && t.model === target.model)) continue
      const key = this.keyOf(snap, target.provider)
      if (key) out.push({ ...target, apiKey: key.key, ...(key.baseUrl && { baseUrl: key.baseUrl }) })
    }
    return out
  }

  // One specific tier's target (the fallback is tested on its own).
  async targetFor(tier: AiTier): Promise<AiResolvedTarget | null> {
    const snap = await this.snapshot()
    const target = tier === 'fallback' ? this.chosen(snap, 'fallback') : (this.chosen(snap, tier) ?? this.defaultTarget(tier))
    if (!target) return null
    const key = this.keyOf(snap, target.provider)
    return key ? { ...target, apiKey: key.key, ...(key.baseUrl && { baseUrl: key.baseUrl }) } : null
  }

  async dailyLimit(): Promise<number> {
    const snap = await this.snapshot()
    return snap.settings?.dailyCallLimit ?? this.config.get('AI_DAILY_CALL_LIMIT', { infer: true }) ?? 0
  }

  async view(): Promise<AiSettingsView> {
    const snap = await this.snapshot(true)
    const [fast, smart] = await Promise.all([this.targets('fast'), this.targets('smart')])
    const strip = (t: AiResolvedTarget | undefined): AiModelTarget | null => (t ? { provider: t.provider, model: t.model } : null)
    return {
      providers: AI_PROVIDER_IDS.map((id) => {
        const key = this.keyOf(snap, id)
        return { ...AI_PROVIDERS[id], hasKey: !!key, keySource: key?.source ?? null, keyHint: snap.hints[id] || null, baseUrl: id === 'custom' ? (snap.baseUrls.custom ?? null) : null }
      }),
      fast: this.chosen(snap, 'fast'),
      smart: this.chosen(snap, 'smart'),
      fallback: this.chosen(snap, 'fallback'),
      effective: { fast: strip(fast[0]), smart: strip(smart[0]) },
      dailyCallLimit: snap.settings?.dailyCallLimit ?? null,
      effectiveDailyCallLimit: snap.settings?.dailyCallLimit ?? this.config.get('AI_DAILY_CALL_LIMIT', { infer: true }) ?? 0
    }
  }

  assertProvider(id: string): AiProviderId {
    const parsed = AiProviderIdSchema.safeParse(id)
    if (!parsed.success) throw new NotFoundException(`Unknown AI provider "${id}".`)
    return parsed.data
  }

  async update(input: UpdateAiSettings, actor: AuditActor): Promise<AiSettingsView> {
    const snap = await this.snapshot(true)
    const data: Record<string, string | number | null> = {}
    for (const [tier, columns] of [
      ['fast', ['fastProvider', 'fastModel']],
      ['smart', ['smartProvider', 'smartModel']],
      ['fallback', ['fallbackProvider', 'fallbackModel']]
    ] as const) {
      const value = input[tier]
      if (value === undefined) continue
      if (value !== null && !this.keyOf(snap, value.provider)) {
        throw new BadRequestException(`Add an API key for ${AI_PROVIDERS[value.provider].label} before choosing it.`)
      }
      data[columns[0]] = value?.provider ?? null
      data[columns[1]] = value?.model ?? null
    }
    if (input.dailyCallLimit !== undefined) data.dailyCallLimit = input.dailyCallLimit

    await this.prisma.aiSettings.upsert({ where: { id: 'singleton' }, update: data, create: { id: 'singleton', ...data } })
    await this.audit.log({ actor, action: 'Update', entity: 'AiSettings', entityId: 'singleton', metadata: input })
    return this.view()
  }

  async setKey(provider: AiProviderId, apiKey: string, baseUrl: string | undefined, actor: AuditActor): Promise<AiSettingsView> {
    let row: { apiKeyEncrypted: string; keyHint: string; baseUrl: string | null }
    if (provider === 'custom') {
      const normalized = normalizeAiBaseUrl(baseUrl ?? '')
      if (!normalized) throw new BadRequestException('Enter a valid base URL: https://… (or http://localhost… for a server on this machine), with no password, query or fragment in it.')
      if (apiKey) {
        row = { apiKeyEncrypted: encryptToken(apiKey, this.secret()), keyHint: apiKey.slice(-4), baseUrl: normalized }
      } else {
        // Only the URL changed: keep the key already saved (or none, for a local server).
        const existing = await this.prisma.aiProviderCredential.findUnique({ where: { provider } })
        row = existing ? { apiKeyEncrypted: existing.apiKeyEncrypted, keyHint: existing.keyHint, baseUrl: normalized } : { apiKeyEncrypted: encryptToken('none', this.secret()), keyHint: '', baseUrl: normalized }
      }
    } else {
      if (apiKey.length < 8) throw new BadRequestException('Paste the API key.')
      row = { apiKeyEncrypted: encryptToken(apiKey, this.secret()), keyHint: apiKey.slice(-4), baseUrl: null }
    }
    await this.prisma.aiProviderCredential.upsert({ where: { provider }, update: row, create: { provider, ...row } })
    // Never log the key itself.
    await this.audit.log({ actor, action: 'Update', entity: 'AiProviderCredential', entityId: provider, metadata: { provider, change: 'key-saved' } })
    return this.view()
  }

  async clearKey(provider: AiProviderId, actor: AuditActor): Promise<AiSettingsView> {
    await this.prisma.aiProviderCredential.deleteMany({ where: { provider } })
    await this.audit.log({ actor, action: 'Update', entity: 'AiProviderCredential', entityId: provider, metadata: { provider, change: 'key-removed' } })
    return this.view()
  }

  // Models the provider offers for the saved key; also proves the key works.
  async listModels(provider: AiProviderId): Promise<AiProviderModelsResult> {
    const key = this.keyOf(await this.snapshot(true), provider)
    if (!key) return { ok: false, models: [], error: `No API key saved for ${AI_PROVIDERS[provider].label}.` }
    try {
      return { ok: true, models: await adapterFor(provider, key.baseUrl).listModels(key.key), error: null }
    } catch (error) {
      return { ok: false, models: [], error: (error as Error).message }
    }
  }
}
