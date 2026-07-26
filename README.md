# Amalice — COD Commerce Platform

Cash-on-delivery storefront and back-office management system. Architecture and roadmap: [`cod-platform-plan.md`](cod-platform-plan.md). Implementation backlog: [`tasks/`](tasks/README.md).

## Layout

pnpm workspace, orchestrated with Turborepo.

| Path | What it is | Status |
|---|---|---|
| `apps/storefront` | Customer-facing site (Nuxt 4, SSR) | COD MVP done (catalog→PDP→cart→OTP checkout→tracking→history); full-store expansion + Polaris re-theme next (SF-13+, DS-08) |
| `apps/admin` | Back-office management system (Nuxt 4, SPA) | Scaffold + dashboard nav shell; full dashboards + Polaris×Stripe re-theme next (ADM-01+, DS-09) |
| `apps/api` | Backend API (NestJS 11 + Prisma 7) | Scaffold — 6 modules, Swagger, Postgres schema v1 |
| `packages/ui` | Shared design system — Nuxt UI v4 theme, tokens, `StatusBadge`/`PriceDisplay`/`EmptyState` | Implemented (DS-01–07); Polaris storefront re-theme (DS-08) + admin override layer (DS-09) next |
| `packages/shared` | Shared Zod schemas + derived TS types | Implemented — `Order`/`Product`/`Customer`/`Shipment` |

## Prerequisites

- Node.js (see `engines.node` in `package.json` — Nuxt 4.4's supported range; check yours with `node -v` before assuming it's fine)
- pnpm — pinned via `packageManager` in `package.json`; run any pnpm command and Corepack picks up the right version automatically
- Docker (Desktop or equivalent) — for local Postgres/Redis/Meilisearch

## Getting started

Run `./start.sh` (Linux/macOS, or Git Bash on Windows) to do all of the below in one shot — it's safe to re-run any time. Otherwise, manually:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/storefront/.env.example apps/storefront/.env   # optional, has working defaults
cp apps/admin/.env.example apps/admin/.env             # optional, has working defaults

docker compose up -d       # Postgres, Redis, Meilisearch
pnpm install

cd apps/api
pnpm exec prisma migrate dev   # apply the schema
pnpm exec prisma db seed       # sample products, one customer, one admin user per role

cd ../..
pnpm dev
```

`pnpm dev` runs all three apps at once via Turborepo, on fixed distinct ports so they don't collide:

- Storefront — http://localhost:3000
- Admin — http://localhost:3001
- API — http://localhost:3333 (OpenAPI docs at `/docs`)

To run just one: `pnpm --filter storefront dev`, `pnpm --filter admin dev`, or `pnpm --filter api dev`.

OTP codes for checkout/login aren't sent anywhere real yet — `ConsoleOtpProvider` just logs them to the API's terminal output (`OTP for +1...: 123456`) until a real SMS provider is wired up.

Every app inherits its theme, fonts, color tokens, and shared components from `packages/ui` — see `/style-guide` on either app (dev-only route) for the full design system reference, including a live demo of the same Zod schema validating on both the client and `apps/api`.

### ⚠️ Postgres port conflict

If `docker compose up` or `prisma migrate` fails with an auth error, check whether something else is already listening on port 5432 — that's why this project's Postgres is mapped to **5433**, not the default. On Windows: `Get-NetTCPConnection -LocalPort 5432 -State Listen`. A native/other Postgres install silently shadowing Docker's port mapping produces a *very* misleading "password authentication failed" error rather than a connection-refused, since the client actually reaches the wrong server entirely.

## Common commands

All run through Turborepo at the root, scoped to whichever packages define the script (a package with no `build` script, for instance, is a no-op, not a failure):

```bash
pnpm build       # turbo run build
pnpm typecheck   # turbo run typecheck
pnpm lint        # turbo run lint
pnpm test        # turbo run test
```

Run any of these for a single package with `--filter`, e.g. `pnpm --filter storefront typecheck`.

## Where to go next

`tasks/README.md` indexes the full implementation backlog. Current focus: the **design-system re-theme** — DS-08 (storefront → Shopify Polaris visual language) and DS-09 (admin → Polaris × Stripe hybrid), both as token/theme overrides on the existing Nuxt UI v4 layer (no React, no rewrite). Those gate the storefront expansion (SF-13+: marketing home, collections, CMS pages, rich PDP, reviews, store SEO/infra) and the admin dashboard build-out (ADM-01+: login/RBAC, order queue, inventory, then the full dashboards through reconciliation and fulfillment).

Two project-level skills encode the re-theme token values and page conventions so the two apps stay consistent: `polaris-design-language` (storefront) and `stripe-polaris-admin-theme` (admin), under `.agents/skills/`. The shared `StatusBadge` order-lifecycle semantics are intentionally frozen across both apps — tracking state matches admin 1:1.

After the re-themes: `02`/`03` (storefront/admin features) in parallel, then `04` → `05` → `06`, with `07` (infra) and `08` (security) running alongside everything else rather than as their own phase.
