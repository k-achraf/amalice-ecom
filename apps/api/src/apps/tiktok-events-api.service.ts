import { BadGatewayException, Injectable, Logger } from '@nestjs/common'
import { createHash } from 'node:crypto'

// TikTok's Events API version — same rolling-deprecation caveat as Meta's
// GRAPH_API_VERSION constant in meta-conversions-api.service.ts.
const EVENTS_API_VERSION = 'v1.3'

export interface TikTokEapiCredentials {
  pixelCode: string
  accessToken: string
  testEventCode?: string | null
}

export interface TikTokEapiUserData {
  phone?: string | null
  ip?: string | null
  userAgent?: string | null
  ttp?: string | null
}

export interface TikTokEapiEvent {
  eventName: string
  eventId: string
  eventSourceUrl?: string
  userData: TikTokEapiUserData
  properties?: Record<string, unknown>
}

export interface TikTokEapiResult {
  eventsReceived: number
  requestId: string | null
  messages: string[]
}

interface EventsApiResponse {
  code: number
  message: string
  request_id?: string
  data?: unknown
}

// Talks to TikTok's Events API — the server-side half of the TikTok Pixel
// app (packages/shared/apps.ts). Structurally the same role as
// MetaConversionsApiService: OrdersService fires real CompletePayment
// events fire-and-forget, AppsService fires synthetic test events on
// demand from the admin UI.
@Injectable()
export class TikTokEventsApiService {
  private readonly logger = new Logger(TikTokEventsApiService.name)

  // TikTok requires user_data PII hashed with SHA-256. Unlike Meta (which
  // wants phone digits only), TikTok's docs specify the E.164 string
  // (leading '+' included) hashed as-is — our stored phone numbers are
  // already E.164, so no normalization beyond trim is needed here.
  private hashPhone(phone: string): string {
    return createHash('sha256').update(phone.trim()).digest('hex')
  }

  private buildUserData(data: TikTokEapiUserData): Record<string, unknown> {
    const userData: Record<string, unknown> = {}
    if (data.phone) userData.phone_number = this.hashPhone(data.phone)
    if (data.ip) userData.ip = data.ip
    if (data.userAgent) userData.user_agent = data.userAgent
    if (data.ttp) userData.ttp = data.ttp
    return userData
  }

  async sendEvent(credentials: TikTokEapiCredentials, event: TikTokEapiEvent): Promise<TikTokEapiResult> {
    const url = `https://business-api.tiktok.com/open_api/${EVENTS_API_VERSION}/event/track/`

    const payload: Record<string, unknown> = {
      event_source: 'web',
      event_source_id: credentials.pixelCode,
      data: [
        {
          event: event.eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: event.eventId,
          user: this.buildUserData(event.userData),
          page: event.eventSourceUrl ? { url: event.eventSourceUrl } : undefined,
          properties: event.properties
        }
      ]
    }
    if (credentials.testEventCode) payload.test_event_code = credentials.testEventCode

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Access-Token': credentials.accessToken },
        body: JSON.stringify(payload)
      })
    } catch (error) {
      throw new BadGatewayException(`Could not reach TikTok's Events API: ${(error as Error).message}`)
    }

    const body = (await response.json().catch(() => ({}))) as EventsApiResponse

    // TikTok always returns HTTP 200 and signals success/failure via the
    // `code` field (0 = success) rather than the HTTP status — unlike
    // Meta, which uses the status code itself.
    if (!response.ok || body.code !== 0) {
      throw new BadGatewayException(`TikTok Events API error: ${body.message ?? `HTTP ${response.status}`}`)
    }

    return {
      eventsReceived: 1,
      requestId: body.request_id ?? null,
      messages: [body.message]
    }
  }

  // Fire-and-forget wrapper for real production events (CompletePayment on
  // order creation) — same rationale as MetaConversionsApiService: TikTok
  // being slow or down must never affect checkout. Callers should NOT
  // await this in the request path.
  fireAndForget(credentials: TikTokEapiCredentials, event: TikTokEapiEvent): void {
    this.sendEvent(credentials, event).catch((error: Error) => {
      this.logger.warn(`TikTok Events API event '${event.eventName}' (${event.eventId}) failed: ${error.message}`)
    })
  }
}
