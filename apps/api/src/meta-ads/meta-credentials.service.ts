import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../config/env.validation'
import { PrismaService } from '../prisma/prisma.service'
import { decryptToken, encryptToken } from './meta-crypto'

export interface MetaAppCredentials {
  appId: string
  appSecret: string
  appName: string | null
  source: 'database' | 'env'
}

const CACHE_MS = 30_000

// Where the Meta developer app (id + secret) comes from: the row saved from the
// admin UI first, then META_APP_ID / META_APP_SECRET as a fallback. Also owns the
// encryption of everything secret in this module (app secret, user tokens).
@Injectable()
export class MetaCredentialsService {
  private cache: { value: MetaAppCredentials | null; at: number } | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>
  ) {}

  private get encryptionSecret(): string {
    return this.config.get('META_TOKEN_ENCRYPTION_KEY', { infer: true }) ?? this.config.get('JWT_SECRET', { infer: true })
  }

  encrypt(plain: string): string {
    return encryptToken(plain, this.encryptionSecret)
  }

  decrypt(stored: string): string {
    return decryptToken(stored, this.encryptionSecret)
  }

  async get(): Promise<MetaAppCredentials | null> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.value
    let value: MetaAppCredentials | null = null
    const row = await this.prisma.metaAppCredentials.findUnique({ where: { id: 'singleton' } })
    if (row) {
      try {
        value = { appId: row.appId, appSecret: this.decrypt(row.appSecretEnc), appName: row.appName, source: 'database' }
      } catch {
        // Unreadable (encryption key changed) — fall through to the env fallback.
      }
    }
    if (!value) {
      const appId = this.config.get('META_APP_ID', { infer: true })
      const appSecret = this.config.get('META_APP_SECRET', { infer: true })
      if (appId && appSecret) value = { appId, appSecret, appName: null, source: 'env' }
    }
    this.cache = { value, at: Date.now() }
    return value
  }

  async save(appId: string, appSecret: string, appName: string | null): Promise<void> {
    const data = { appId, appName, appSecretEnc: this.encrypt(appSecret) }
    await this.prisma.metaAppCredentials.upsert({ where: { id: 'singleton' }, create: { id: 'singleton', ...data }, update: data })
    this.cache = null
  }

  async clear(): Promise<void> {
    await this.prisma.metaAppCredentials.deleteMany({})
    this.cache = null
  }

  // The saved secret, for "keep the current secret" saves.
  async savedSecretFor(appId: string): Promise<string | null> {
    const current = await this.get()
    return current && current.appId === appId ? current.appSecret : null
  }
}
