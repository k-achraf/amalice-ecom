import { BadGatewayException, Injectable, Logger } from '@nestjs/common'
import { createHash } from 'node:crypto'

// Meta's Graph API version — date-stamped and deprecated on a rolling
// schedule (roughly one version retired per year), so this will eventually
// need bumping. Not worth making configurable: a hardcoded, occasionally-
// stale constant is simpler to reason about than a setting nobody will
// remember to update either way.
const GRAPH_API_VERSION = 'v21.0'

export interface MetaCapiCredentials {
  pixelId: string
  accessToken: string
  testEventCode?: string | null
}

export interface MetaCapiUserData {
  phone?: string | null
  ip?: string | null
  userAgent?: string | null
  fbp?: string | null
  fbc?: string | null
}

export interface MetaCapiEvent {
  eventName: string
  eventId: string
  eventSourceUrl?: string
  userData: MetaCapiUserData
  customData?: Record<string, unknown>
  // Only 'website' is used here — the storefront has no app/offline-CRM
  // integration, so the other Meta-defined action sources don't apply.
  actionSource?: 'website'
}

export interface MetaCapiResult {
  eventsReceived: number
  fbtraceId: string | null
  messages: string[]
}

interface GraphApiSuccessResponse {
  events_received?: number
  fbtrace_id?: string
  messages?: string[]
}

interface GraphApiErrorResponse {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number; fbtrace_id?: string }
}

// Talks to Meta's Conversions API — the server-side half of the Meta Pixel
// app (packages/shared/apps.ts). Two callers: OrdersService fires real
// Purchase events (fire-and-forget, never blocks checkout), AppsService
// fires synthetic test events on demand from the admin UI.
@Injectable()
export class MetaConversionsApiService {
  private readonly logger = new Logger(MetaConversionsApiService.name)

  // Meta requires PII in user_data to be SHA-256 hashed after normalization
  // (lowercase + trim for email; digits-only, no leading '+', for phone —
  // our numbers are already E.164 so stripping non-digits is sufficient).
  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '')
  }

  private buildUserData(data: MetaCapiUserData): Record<string, unknown> {
    const userData: Record<string, unknown> = {}
    if (data.phone) userData.ph = [this.hash(this.normalizePhone(data.phone))]
    if (data.ip) userData.client_ip_address = data.ip
    if (data.userAgent) userData.client_user_agent = data.userAgent
    if (data.fbp) userData.fbp = data.fbp
    if (data.fbc) userData.fbc = data.fbc
    return userData
  }

  async sendEvent(credentials: MetaCapiCredentials, event: MetaCapiEvent): Promise<MetaCapiResult> {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${credentials.pixelId}/events`

    const payload: Record<string, unknown> = {
      access_token: credentials.accessToken,
      data: [
        {
          event_name: event.eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: event.eventId,
          action_source: event.actionSource ?? 'website',
          event_source_url: event.eventSourceUrl,
          user_data: this.buildUserData(event.userData),
          custom_data: event.customData
        }
      ]
    }
    if (credentials.testEventCode) payload.test_event_code = credentials.testEventCode

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
    } catch (error) {
      throw new BadGatewayException(`Could not reach Meta's Conversions API: ${(error as Error).message}`)
    }

    const body = (await response.json().catch(() => ({}))) as GraphApiSuccessResponse & GraphApiErrorResponse

    if (!response.ok) {
      const message = body.error?.message ?? `Meta returned HTTP ${response.status}`
      throw new BadGatewayException(`Meta Conversions API error: ${message}`)
    }

    return {
      eventsReceived: body.events_received ?? 0,
      fbtraceId: body.fbtrace_id ?? null,
      messages: body.messages ?? []
    }
  }

  // Fire-and-forget wrapper for real production events (Purchase on order
  // creation) — a Meta outage or bad credential must never fail or slow
  // down checkout. Callers should NOT await this in the request path; it
  // resolves on its own and only logs on failure.
  fireAndForget(credentials: MetaCapiCredentials, event: MetaCapiEvent): void {
    this.sendEvent(credentials, event).catch((error: Error) => {
      this.logger.warn(`Meta CAPI event '${event.eventName}' (${event.eventId}) failed: ${error.message}`)
    })
  }
}
