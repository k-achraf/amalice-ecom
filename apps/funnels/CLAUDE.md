# apps/funnels

Standalone funnel pages (landing + order form + order bump + upsell/downsell + thank-you), served from their own domain and **completely separate from the storefront**: no Nuxt, no Vue, no store templates, no shared runtime. Built for one thing: loading very fast on a phone over a slow connection. Customer-facing copy is Arabic / RTL.

## How it works

- `src/server.ts` — plain `node:http`. Routes: `GET /f/:slug` (the page), `GET /img` (image proxy), `GET /healthz`. No database, no cookies, no session: every visitor gets the same bytes, so a CDN can cache pages too.
- `src/api.ts` — fetches `GET {API_BASE}/public/funnels/:slug` and renders it once into a page; the result is cached in memory with **stale-while-revalidate** (fresh `CACHE_TTL_MS`, then served stale instantly while a background refresh runs; only a cold start waits on the API). If the API is down, a stale page is still served.
- `src/render.ts` — builds the whole HTML string: inline critical CSS (`styles.ts`), an SVG icon sprite, the page, hidden screens for the post-order steps, and a JSON blob (`#fd`) for the client. Pre-compressed with Brotli and gzip at render time; ETag + 304 for returning visitors.
- `src/client.js` — ~14 KB of plain JS inlined into the page (comment lines/indentation stripped at boot; edit the file, `tsx watch` reloads it). Handles price maths, offers, wilaya→delivery→communes, validation, order submit, upsell/downsell accept, abandoned-cart capture, pinned order bar, pixels.
- `src/img.ts` — resizes product photos to WebP at fixed widths (sharp), cached in memory + on disk, served `immutable`. Only `/uploads/*` of our API, or an external image URL that **this server itself rendered into a page** (hash lookup), is ever fetched: never an arbitrary URL (no open proxy / SSRF).

## Data flow (what is shared with the rest of the platform)

- Page content, prices, offers, wilayas + shipping prices, pixel IDs, abandoned-cart delay, real approved reviews: all in the one `PublicFunnel` payload (`packages/shared/src/funnel-public.ts`) from `apps/api/src/funnels/funnels-public.*`. Only **Live** funnels are served; anything else is a 404.
- The browser calls the API directly (CORS) for: `GET /communes`, `POST /public/funnels/:slug/orders`, `POST …/orders/:id/offers/:stepId`, `POST /orders/abandoned`, `POST /analytics/view` (with a per-visit `viewId` + the visitor's ad touch), `POST /analytics/engagement` (visible seconds, scroll depth, form touched — sent cumulatively whenever the page is hidden/closed). The order goes through the same `OrdersService.createLeadOrder` as the storefront, so idempotency, bot-pace check, duplicate flagging, stock, server-side pricing, Meta CAPI / TikTok Events API and Google Sheets sync all apply unchanged. **Prices are never taken from the browser.**
- Pixels: Meta and TikTok stubs are defined at once (events queue), the vendor scripts load on first interaction or idle. `ViewContent`, `InitiateCheckout`, `Purchase`/`CompletePayment` (event id = order id, matching the server-side event so each platform dedupes).
- Copy lives in `FUNNEL_COPY_AR` (`packages/shared`), shared with the admin's landing-page preview so they never drift.

## Config (`.env`, all optional)

`PORT` (3002), `API_BASE` (server → API), `PUBLIC_API_BASE` (browser → API, defaults to `API_BASE`), `CACHE_TTL_MS`. The API must allow this site's origin: dev `http://localhost:3002` is built in, production needs `CORS_EXTRA_ORIGINS=https://your-funnels-domain` in `apps/api/.env`. The admin builds each funnel's public link from `NUXT_PUBLIC_FUNNELS_BASE`.

## Dev

```bash
pnpm --filter funnels dev        # http://localhost:3002 (tsx watch)
pnpm --filter funnels typecheck
pnpm --filter funnels build && pnpm --filter funnels start
```

After changing `packages/shared`, rebuild it (`pnpm --filter @amalice/shared build`) and restart this server: it loads `dist/`.

## Speed rules (don't break these)

- No framework, no webfonts, no external CSS/JS request on the critical path; the page is one cached, compressed document.
- Every image has a reserved box (no layout shift); the first photo is preloaded with `fetchpriority=high`, the rest are `loading=lazy`.
- Third-party pixel scripts never load before the first interaction / idle.
- Keep `client.js` free of dependencies and new network calls on page load.
