# apps/api

NestJS 11 + Prisma 7 + Postgres backend. Feature-module-per-domain layout under `src/`; validation via `nestjs-zod` against the schemas in `packages/shared`, not hand-rolled DTOs.

## Modules (`src/`)

| Module | Covers |
|---|---|
| `identity/admin-auth` | Admin login, JWT issuance/refresh, `JwtAuthGuard`, `RolesGuard` |
| `catalog` | Products, categories, reviews, search |
| `orders`, `order-items` | Order lifecycle, line items, upsells |
| `fulfillment` | Fulfillment/shipping workflow (call center → ship → deliver) |
| `shipping-companies` | Carrier integrations (DHD API client), tariffs |
| `reconciliation` | COD cash reconciliation |
| `locations` | Wilaya/Commune reference data (Algeria) |
| `sourcing` | Product-sourcing research/tracking (separate from live catalog) |
| `apps` | Third-party integrations: Meta Conversions API, TikTok Events API, Google Sheets |
| `landing-pages` | AI-generated product landing pages (Gemini) |
| `server-performance` | Server resource/perf monitoring endpoints (admin dashboard) |
| `store-settings` | Public storefront config (active template, store name, etc.) — `/settings`, exempt from throttling |
| `notifications` | OTP delivery — `ConsoleOtpProvider` in dev (logs to terminal), swap for a real SMS provider before launch |
| `common` | Audit log service, global exception filters |
| `redis` | Redis/BullMQ wiring |
| `admin` | Admin-only cross-cutting endpoints (users, audit log) |
| `prisma` | `PrismaService` wrapper |
| `generated` | Prisma client output — **never hand-edit**, regenerate via `prisma generate` |

## Env vars (`src/config`)

Validated via Zod at boot (`validateEnv`) — an invalid/missing required var crashes startup immediately with a clear message rather than failing three requests in. See `src/config/*.ts` for the full schema. Notably:
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — min 32 chars, no code-level defaults (a placeholder default is how it quietly ends up in production).
- `GEMINI_API_KEY` — optional; AI landing-page builder degrades to a clear "not configured" error rather than failing boot.
- `GOOGLE_SHEETS_CLIENT_EMAIL` / `GOOGLE_SHEETS_PRIVATE_KEY` — optional together; feature no-ops (order pushes silently skip) rather than failing checkout. Keep `PRIVATE_KEY`'s literal `\n` escapes as-is — unescaped at read time.

## CORS

Hardcoded in `src/main.ts` (`app.enableCors`), not env-driven — currently `amalice.shop` / `www.amalice.shop` / `admin.amalice.shop`. If you add a new storefront/admin domain (staging, a new tenant, etc.), it has to be added here explicitly or requests will fail with an opaque CORS error, not a helpful one.

## Uploads

Served statically from `<cwd>/uploads` at `/uploads/*` (`main.ts`). This directory only exists on the API server — a relative `/uploads/...` URL is never resolvable directly by either Nuxt app; they must resolve it against `apiBase` first (see `apps/storefront/CLAUDE.md`'s `resolveImageUrl()` note). This has caused real broken-image bugs before — don't pass a raw `imageUrl` straight to an `<img>`/`<NuxtImg>` in either frontend.

## Prisma workflow

```bash
cd apps/api
npx prisma format
npx prisma migrate dev --name descriptive_name
npx prisma generate
```

Seeding:
- `pnpm exec prisma db seed` — full dev seed (sample products, customer, one admin per role, **creates dev-password admin accounts** — do not run against production).
- `pnpm seed-locations` — Wilaya/Commune reference data only, safe for production (no dev credentials).
- `pnpm create-admin` — standalone script to create a single admin account (argv-parsed; if invoking via `pnpm create-admin -- --email=...`, note pnpm forwards the `--` separator itself into `process.argv`).

## Auth

Admin JWT access tokens: 12h TTL (`ACCESS_TOKEN_TTL` in `admin-auth.service.ts`) — deliberately long since the admin SPA has no silent-refresh flow; a 401 just clears session and bounces to `/login`. Refresh token TTL: 7d. If you add a silent-refresh flow, the access-token TTL is a reasonable thing to shorten back down.

## Pixel/CAPI events (Meta + TikTok)

`src/apps/meta-conversions-api.service.ts` and `tiktok-events-api.service.ts`, invoked from `orders.service.ts`'s `sendPurchaseEvents`. Both platforms **deduplicate** browser-pixel and server-side events sharing the same `event_id` — sending from both channels is intentional redundancy against ad-blockers/ITP, not double-counting, as long as the id matches what the storefront sends (currently `orderId`, wired in both places).

TikTok's schema is easy to get wrong: `content_id` must live inside `properties.contents[]` (array, one entry per line item — `content_id`, `content_type`, `quantity`, `price`), **not** a flat `properties.content_id`. A flat shape fails TikTok's validation silently from our side (shows as "Content ID is missing" in their dashboard, not a request error here).

## Style

- Prefer NestJS's DI/module conventions over ad hoc singletons.
- Validate everything at the controller boundary via the shared Zod schema, not a hand-rolled `class-validator` DTO — that's the entire point of `packages/shared`.
- `@SkipThrottle()` is used for genuinely public, high-frequency, low-risk endpoints (e.g. `/settings`) — don't add it reflexively; the default throttle exists for a reason.
