// Thin HTTP client for the Amalice admin API that forwards the AI client's own token.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

type Query = Record<string, string | number | boolean | undefined | null>

export class AmaliceApi {
  constructor(
    private readonly base: string,
    private readonly token: string
  ) {}

  async request<T = unknown>(method: string, path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
    const url = new URL(this.base + path)
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
    const res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${this.token}`,
        ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {})
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    })

    const text = await res.text()
    const data = text ? safeJson(text) : null
    if (!res.ok) {
      const msg = typeof data === 'object' && data && 'message' in data ? (data as { message: unknown }).message : text
      throw new ApiError(res.status, `API ${res.status}: ${Array.isArray(msg) ? msg.join('; ') : String(msg)}`)
    }
    return data as T
  }

  get = <T = unknown>(path: string, query?: Query) => this.request<T>('GET', path, { query })
  post = <T = unknown>(path: string, body?: unknown) => this.request<T>('POST', path, { body: body ?? {} })
  patch = <T = unknown>(path: string, body: unknown) => this.request<T>('PATCH', path, { body })
  put = <T = unknown>(path: string, body: unknown) => this.request<T>('PUT', path, { body })
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
