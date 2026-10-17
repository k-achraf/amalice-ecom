import { createHmac } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../config/env.validation'
import type { MetaAppCredentials } from './meta-credentials.service'

// An error object returned by Meta's Graph API.
export class MetaGraphError extends Error {
  constructor(
    message: string,
    readonly code: number | undefined,
    readonly subcode: number | undefined,
    readonly httpStatus: number
  ) {
    super(message)
  }

  // 190 = access token invalid/expired/revoked; 102 = session invalid.
  get isAuthError() {
    return this.code === 190 || this.code === 102
  }

  // Meta's rate-limit family (app/user/account level).
  get isRateLimit() {
    return this.code === 4 || this.code === 17 || this.code === 32 || this.code === 613 || this.code === 80004
  }
}

// Thin Graph API client — GET only in phase 1. Calls made with a token from our
// own app also send appsecret_proof (HMAC-SHA256 of the token with the app
// secret), which Meta uses to reject calls made with a leaked token alone.
@Injectable()
export class MetaGraphService {
  private readonly logger = new Logger(MetaGraphService.name)

  constructor(private readonly config: ConfigService<Env, true>) {}

  get version(): string {
    return this.config.get('META_GRAPH_VERSION', { infer: true })
  }

  dialogUrl(creds: MetaAppCredentials, redirectUri: string, state: string, scopes: readonly string[]): string {
    const params = new URLSearchParams({ client_id: creds.appId, redirect_uri: redirectUri, state, scope: scopes.join(','), response_type: 'code' })
    return `https://www.facebook.com/${this.version}/dialog/oauth?${params}`
  }

  // `proofSecret`: the app secret to sign appsecret_proof with — only for tokens issued to that app.
  async get<T>(path: string, params: Record<string, string | number | undefined> = {}, token?: string, proofSecret?: string): Promise<T> {
    const query = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') query.set(k, String(v))
    if (token) {
      query.set('access_token', token)
      if (proofSecret) query.set('appsecret_proof', createHmac('sha256', proofSecret).update(token).digest('hex'))
    }
    const url = path.startsWith('http') ? path : `https://graph.facebook.com/${this.version}/${path.replace(/^\//, '')}?${query}`
    let response: Response
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
    } catch (error) {
      // Never log the URL: it carries the access token.
      this.logger.warn(`Graph request to ${path.split('?')[0]} failed: ${(error as Error).name}: ${(error as Error).message}`)
      throw new MetaGraphError('Could not reach Meta. Try again in a moment.', undefined, undefined, 502)
    }
    const body = (await response.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_subcode?: number } } & T
    if (!response.ok || body.error) {
      const e = body.error
      throw new MetaGraphError(e?.message ?? `Meta returned HTTP ${response.status}`, e?.code, e?.error_subcode, response.status)
    }
    return body
  }

  // code -> short-lived token -> long-lived (~60 days) token.
  async exchangeCode(creds: MetaAppCredentials, code: string, redirectUri: string): Promise<{ token: string; expiresInSeconds: number | null }> {
    const short = await this.get<{ access_token: string }>('oauth/access_token', { client_id: creds.appId, client_secret: creds.appSecret, redirect_uri: redirectUri, code })
    return (await this.extendToken(creds, short.access_token)) ?? { token: short.access_token, expiresInSeconds: null }
  }

  // Swaps a user token of OUR app for a long-lived one; null when Meta won't (system-user tokens, other app's tokens).
  async extendToken(creds: MetaAppCredentials, token: string): Promise<{ token: string; expiresInSeconds: number | null } | null> {
    try {
      const long = await this.get<{ access_token: string; expires_in?: number }>('oauth/access_token', {
        grant_type: 'fb_exchange_token',
        client_id: creds.appId,
        client_secret: creds.appSecret,
        fb_exchange_token: token
      })
      return { token: long.access_token, expiresInSeconds: long.expires_in ?? null }
    } catch {
      return null
    }
  }

  // Expiry of a pasted token (null = unknown, 0/never = does not expire). Best effort.
  async tokenExpiry(creds: MetaAppCredentials, token: string): Promise<{ valid: boolean; expiresAt: Date | null } | null> {
    try {
      const res = await this.get<{ data?: { is_valid?: boolean; expires_at?: number } }>('debug_token', { input_token: token, access_token: `${creds.appId}|${creds.appSecret}` })
      const exp = res.data?.expires_at
      return { valid: res.data?.is_valid !== false, expiresAt: exp ? new Date(exp * 1000) : null }
    } catch {
      return null
    }
  }

  // Checks an app id + secret pair against Meta; returns the app's name.
  async appInfo(appId: string, appSecret: string): Promise<{ name: string | null }> {
    const res = await this.get<{ id?: string; name?: string }>(appId, { fields: 'id,name', access_token: `${appId}|${appSecret}` })
    return { name: res.name ?? null }
  }
}
