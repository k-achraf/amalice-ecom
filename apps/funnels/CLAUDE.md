# apps/funnels

Standalone funnel pages (landing + order form + order bump + upsell/downsell + thank-you), served from their own domain and **completely separate from the storefront**: no Nuxt, no Vue, no store templates, no shared runtime. Built for one thing: loading very fast on a phone over a slow connection. Customer-facing copy is Arabic / RTL.

## How it works

- `src/server.ts` — plain `node:http`. Routes: `GET /f/:slug` (the page), `GET /img` (image proxy), `GET /healthz`. No database, no cookies, no session: every visitor gets the same bytes, so a CDN can cache pages too.
- `src/api.ts` — fetches `GET {API_BASE}/public/funnels/:slug` and renders it once into a page; the result is cached in memory with **stale-while-revalidate** (fresh `CACHE_TTL_MS`, then served stale instantly while a background refresh runs; only a cold start waits on the API). If the API is down, a stale page is still served.
- `src/render.ts` — builds the whole HTML string: inline critical CSS (`styles.ts`), an SVG icon sprite, the page, hidden screens for the post-order steps, and a JSON blob (`#fd`) for the client. Pre-compressed with Brotli and gzip at render time; ETag + 304 for returning visitors.
- `src/client.js` — ~14 KB of plain JS inlined into the page (comment lines/indentation stripped at boot; edit the file, `tsx watch` reloads it). Handles price maths, offers, wilaya→delivery→communes, validation, order submit, upsell/downsell accept, abandoned-cart capture, pinned order bar (always visible, hidden only while the form's own order button is on screen; pulse + shine animation, off for reduced-motion), pixels.
- `src/img.ts` — resizes product photos at fixed widths (sharp) to AVIF when the browser's `Accept` says so, WebP otherwise (`Vary: Accept`), cached in memory + on disk, served `immutable`. Only `/uploads/*` of our API, or an external image URL that **this server itself rendered into a page** (hash lookup), is ever fetched: never an arbitrary URL (no open proxy / SSRF).

## Data flow (what is shared with the rest of the platform)

- Page content, prices, offers, wilayas + shipping prices, pixel IDs, abandoned-cart delay, real approved reviews: all in the one `PublicFunnel` payload (`packages/shared/src/funnel-public.ts`) from `apps/api/src/funnels/funnels-public.*`. Only **Live** funnels are served; anything else is a 404.
- The browser calls the API directly (CORS) for: `GET /communes`, `POST /public/funnels/:slug/orders`, `POST …/orders/:id/offers/:stepId`, `POST /orders/abandoned`, `POST /analytics/view` (with a per-visit `viewId` + the visitor's ad touch), `POST /analytics/engagement` (visible seconds, scroll depth, form touched — sent cumulatively whenever the page is hidden/closed). The order goes through the same `OrdersService.createLeadOrder` as the storefront, so idempotency, bot-pace check, duplicate flagging, stock, server-side pricing, Meta CAPI / TikTok Events API and Google Sheets sync all apply unchanged. **Prices are never taken from the browser.**
- Pixels: a funnel can carry its own Meta pixel ID / TikTok code (`Funnel.metaPixelId`/`tiktokPixelCode`, set in the funnel's Settings card) that replaces the store-wide one in the page and in the server-side Purchase/Delivered events (store access token is reused). Meta and TikTok stubs are defined at once (events queue), the async vendor scripts start loading immediately (deferring them lost PageView/ViewContent for visitors who left within seconds, so no landing page view was ever counted). `ViewContent`, `InitiateCheckout`, `Purchase`/`CompletePayment` (event id = order id, matching the server-side event so each platform dedupes).
- Copy lives in `FUNNEL_COPY_AR` (`packages/shared`), shared with the admin's landing-page preview so they never drift.

## Brand identity

`PublicFunnel.brand` (Settings → Brand in the admin) overrides the funnel's own accent in `render.ts`: the brand colour becomes `--a`/`--s` (button/text colours are still contrast-checked), the logo is a small centred `.brandbar` above the page (through `/img`), the favicon/logo is the page icon, and a chosen font is the one webfont ever loaded (preconnect + `display=swap`; with no brand font the page stays system-font only). Pages are cached for `CACHE_TTL_MS`, but `api.ts` checks the live brand from the public `/settings` (at most every 3 s) and drops any page rendered with a different brand, so a change shows up on the next request. After changing `packages/shared`, rebuild it and restart this server — it loads `dist/`.

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
- Third-party pixel scripts load async right at page start (never defer them: bounce visitors would not be tracked).
- Keep `client.js` free of dependencies and new network calls on page load.

- Countdown: `LandingSettings.countdownEndsAt` (+ `countdownLabel`) renders a live timer under the urgency banner; it is a real deadline set in the admin and hides itself (server render and client tick) once passed. Every page also carries `Product` JSON-LD (price, availability, real approved rating).

- Session replay: `LandingSettings.recordSessions` (default on, toggle in the Landing editor's Order form card). The recorder is rrweb (`@rrweb/record` UMD, served by `src/recorder.ts` as `/rr.js?v=<hash>`, pre-compressed, immutable). It is **not** in the page: `client.js` injects it on the first pointer/touch/scroll/key event or after 4 s, so it never competes with first paint. Typed text is masked in the browser (`maskAllInputs`), mouse/scroll are sampled, a visit is recorded for at most 10 minutes. Events go to `POST /public/funnels/recordings` in chunks (the first carries the DOM snapshot; later ones every 5 s and on pagehide). The global is `window.rrwebRecord.record(...)`, not a function. Replays are watched in the admin's funnel **Sessions** tab (`apps/admin/app/components/funnel/Sessions.vue`, `rrweb-player`); the API keeps them 14 days (`FunnelRecording`/`FunnelRecordingChunk`, see `apps/api/CLAUDE.md`).
- `LandingSettings.hideShipping`: hides the delivery line, the per-option delivery prices and leaves the total at the product price (display only; the API still prices shipping).
- `LandingSettings.unitPieces` (default 1): pieces in one unit of the product, for packs sold together. With 4, the default option reads "اشترِ 4 قطع" and a "buy 2" offer reads "اشترِ 8 قطع" (`singleUnitLabelAr`/`offerLabelAr`/`offerNoteAr` in `packages/shared/src/funnel-public.ts`, shared with the admin preview). Display only: quantities and prices are still per unit.
