import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { getPage } from './api'
import { config } from './config'
import { getImage, parseImgQuery, pickFormat } from './img'
import { RECORDER_PATH, recorder } from './recorder'
import type { Rendered } from './render'
import { esc } from './util'

// Zero-framework server: one route that returns a cached, pre-compressed HTML document, one image
// proxy, one health check. Nothing else. No database, no session, no cookies: every response for a
// funnel is identical for every visitor, so a CDN can cache it too.

const SECURITY = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()'
}

function send(res: ServerResponse, status: number, headers: Record<string, string | number>, body?: Buffer | string) {
  res.writeHead(status, { ...SECURITY, ...headers })
  res.end(body)
}

function negotiate(req: IncomingMessage, r: Rendered): { body: Buffer; encoding?: string } {
  const accept = String(req.headers['accept-encoding'] ?? '')
  if (/\bbr\b/.test(accept)) return { body: r.br, encoding: 'br' }
  if (/\bgzip\b/.test(accept)) return { body: r.gzip, encoding: 'gzip' }
  return { body: r.identity }
}

const notFoundPage = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404</title><body style="font:16px system-ui,Tahoma,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#0e2928;text-align:center"><p>الصفحة غير موجودة</p></body></html>`

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://x')
  const method = req.method ?? 'GET'
  if (method !== 'GET' && method !== 'HEAD') return send(res, 405, { allow: 'GET, HEAD' })

  if (url.pathname === '/healthz') return send(res, 200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }, 'ok')

  if (url.pathname === RECORDER_PATH) {
    const accept = String(req.headers['accept-encoding'] ?? '')
    const enc = /br/.test(accept) ? 'br' : /gzip/.test(accept) ? 'gzip' : null
    const body = enc === 'br' ? recorder.br : enc === 'gzip' ? recorder.gzip : recorder.identity
    return send(
      res,
      200,
      {
        'content-type': 'text/javascript; charset=utf-8',
        vary: 'Accept-Encoding',
        // The URL carries a content hash, so it can be cached for good.
        'cache-control': 'public, max-age=31536000, immutable',
        'content-length': body.length,
        ...(enc ? { 'content-encoding': enc } : {})
      },
      method === 'HEAD' ? undefined : body
    )
  }

  if (url.pathname === '/img') {
    const q = parseImgQuery(url)
    if (!q) return send(res, 400, {}, 'bad request')
    try {
      const img = await getImage(q.source, q.width, pickFormat(req.headers.accept))
      // The same URL serves AVIF or WebP depending on the browser, so caches must key on Accept.
      return send(res, 200, { 'content-type': img.type, vary: 'Accept', 'cache-control': 'public, max-age=31536000, immutable', 'content-length': img.body.length }, method === 'HEAD' ? undefined : img.body)
    } catch {
      // Could not produce a resized copy: send the visitor to the original rather than a broken image.
      return send(res, 302, { location: q.fallback, 'cache-control': 'public, max-age=60' })
    }
  }

  const m = /^\/f\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(url.pathname)
  if (!m) return send(res, 404, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' }, notFoundPage)

  let page: Rendered | null
  try {
    page = await getPage(m[1]!)
  } catch {
    return send(res, 503, { 'content-type': 'text/html; charset=utf-8', 'retry-after': '5', 'cache-control': 'no-store' }, `<!doctype html><meta charset="utf-8"><p style="font:16px system-ui;padding:2rem">${esc('الخدمة غير متاحة مؤقتاً، حاول بعد قليل.')}</p>`)
  }
  if (!page) return send(res, 404, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=10' }, notFoundPage)

  // Conditional request: a returning visitor revalidates for ~200 bytes instead of re-downloading the page.
  if (req.headers['if-none-match'] === page.etag) return send(res, 304, { etag: page.etag, 'cache-control': CACHE })

  const { body, encoding } = negotiate(req, page)
  return send(
    res,
    200,
    {
      'content-type': 'text/html; charset=utf-8',
      etag: page.etag,
      vary: 'Accept-Encoding',
      'cache-control': CACHE,
      'content-length': body.length,
      ...(encoding ? { 'content-encoding': encoding } : {})
    },
    method === 'HEAD' ? undefined : body
  )
}

// Browsers revalidate every time (max-age=0) and get a 304; shared caches / CDNs may keep it for a minute
// and serve it stale for five while they refresh.
const CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'

createServer((req, res) => {
  handle(req, res).catch(() => {
    if (!res.headersSent) send(res, 500, { 'content-type': 'text/plain' }, 'error')
    else res.end()
  })
}).listen(config.port, () => {
  console.log(`[funnels] http://localhost:${config.port}  (API ${config.apiBase})`)
})
