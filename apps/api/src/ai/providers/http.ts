import { BadGatewayException, HttpException, HttpStatus } from '@nestjs/common'

const MAX_HTTP_ATTEMPTS = 3
// A quota that resets in more than this is not worth retrying in-request.
const MAX_RETRYABLE_WAIT_SECONDS = 30

// Providers say "Please retry in 1h27m33.5s" (Google) or "Please try again in
// 7m12s" (Groq). Returns that wait in seconds, or null when there is none.
export function retryAfterSeconds(message: string | undefined): number | null {
  const match = message?.match(/(?:retry|try again) in\s+((?:\d+h)?(?:\d+m(?!s))?(?:[\d.]+s)?)/i)
  if (!match?.[1]) return null
  const hours = /(\d+)h/.exec(match[1])
  const minutes = /(\d+)m(?!s)/.exec(match[1])
  const seconds = /([\d.]+)s/.exec(match[1])
  const total = (hours ? Number(hours[1]) * 3600 : 0) + (minutes ? Number(minutes[1]) * 60 : 0) + (seconds ? parseFloat(seconds[1]!) : 0)
  return total > 0 ? total : null
}

export const formatWait = (seconds: number): string =>
  seconds >= 3600 ? `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m` : seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${Math.round(seconds)}s`

// The human-readable message out of a provider's error body (shapes differ:
// { error: { message } }, { error: "..." }, { message }).
export function errorMessage(json: unknown, status: number): string {
  const body = json as { error?: { message?: string } | string; message?: string } | null
  const fromError = typeof body?.error === 'string' ? body.error : body?.error?.message
  return fromError ?? body?.message ?? `HTTP ${status}`
}

export interface PostJsonInput {
  label: string // "Google Gemini" — for messages
  model: string
  url: string
  headers: Record<string, string>
  body: unknown
}

// POST JSON with retries: short rate limits (429) and 5xx/network errors are
// retried with backoff; a quota that resets in more than ~30 s fails fast as a
// 429 (retrying a 1-hour limit only makes the user wait); other errors (bad
// key, no credits, bad request) fail immediately.
export async function postJson<T>(input: PostJsonInput): Promise<T> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < MAX_HTTP_ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 2500 * attempt))
    let response: Response
    try {
      response = await fetch(input.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...input.headers },
        body: JSON.stringify(input.body),
        signal: AbortSignal.timeout(60_000)
      })
    } catch (error) {
      lastError = new BadGatewayException(`Could not reach ${input.label}: ${(error as Error).message}`)
      continue
    }

    const json = await response.json().catch(() => ({}))
    const message = errorMessage(json, response.status)
    if (response.status === 429 || response.status >= 500) {
      const header = Number(response.headers.get('retry-after'))
      const wait = response.status === 429 ? (Number.isFinite(header) && header > 0 ? header : retryAfterSeconds(message)) : null
      if (wait !== null && wait > MAX_RETRYABLE_WAIT_SECONDS) {
        throw new HttpException(
          `The AI quota for model "${input.model}" on ${input.label} is used up (free plans allow a limited number of requests). Try again in about ${formatWait(wait)}, or choose another model or provider in Settings → AI models, or enable billing.`,
          HttpStatus.TOO_MANY_REQUESTS
        )
      }
      lastError = new BadGatewayException(`${input.label} error: ${message}`)
      continue
    }
    if (!response.ok) throw new BadGatewayException(`${input.label} error: ${message}`)
    return json as T
  }
  throw lastError ?? new BadGatewayException(`${input.label} request failed.`)
}

export async function getJson<T>(label: string, url: string, headers: Record<string, string>): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) })
  } catch (error) {
    throw new BadGatewayException(`Could not reach ${label}: ${(error as Error).message}`)
  }
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new BadGatewayException(`${label} error: ${errorMessage(json, response.status)}`)
  return json as T
}
