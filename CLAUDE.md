# Amalice — COD Commerce Platform

Cash-on-delivery (COD) storefront + back-office platform, primarily serving the Algerian market. pnpm workspace orchestrated by Turborepo. Each app/package has its own `CLAUDE.md` with details specific to it — read this one first for the shape of the whole repo, then the one for whatever you're touching.

## Layout

| Path | What it is | Stack |
|---|---|---|
| `apps/storefront` | Customer-facing site, SSR, 100% RTL/Arabic, 15 selectable visual templates | Nuxt 4 |
| `apps/admin` | Back-office SPA — orders, catalog, shipping, call center, reconciliation, apps/integrations | Nuxt 4 |
| `apps/api` | Backend API | NestJS 11 + Prisma 7 + Postgres |
| `packages/ui` | Shared design system (Nuxt UI v4 theme, tokens, `StatusBadge`/`PriceDisplay`/`EmptyState`) | Nuxt module |
| `packages/shared` | Shared Zod schemas + derived TS types — the single source of truth for shapes crossing the API boundary | TS lib |

Full architecture/roadmap: [`cod-platform-plan.md`](cod-platform-plan.md). Implementation backlog: [`tasks/README.md`](tasks/README.md). Production deployment (VPS, no Docker): [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Getting started

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/storefront/.env.example apps/storefront/.env   # optional, has working defaults
cp apps/admin/.env.example apps/admin/.env             # optional, has working defaults

docker compose up -d            # Postgres, Redis, Meilisearch
pnpm install

cd apps/api
pnpm exec prisma migrate dev    # apply schema
pnpm exec prisma db seed        # sample products, one customer, one admin per role

cd ../..
pnpm dev                        # all three apps via Turborepo
```

Or run `./start.sh` (Linux/macOS, Git Bash on Windows) to do all of the above in one shot — safe to re-run.

Ports (fixed, don't collide):
- Storefront — `http://localhost:3000`
- Admin — `http://localhost:3001`
- API — `http://localhost:3333` (Swagger at `/docs`)

Run one app only: `pnpm --filter storefront dev` / `--filter admin dev` / `--filter api dev`.

**Postgres runs on 5433, not 5432** — a native Postgres install on this machine silently shadows Docker's port mapping if you don't remap it. If `docker compose up`/`prisma migrate` fails with an *auth* error (not connection-refused), that's the tell — check `Get-NetTCPConnection -LocalPort 5432 -State Listen` (Windows) before assuming the password is wrong.

OTP codes (checkout/login) aren't sent anywhere real in dev — `ConsoleOtpProvider` logs them to the API's terminal (`OTP for +1...: 123456`).

## Common commands

Everything routes through Turborepo at the root, scoped to whichever package defines the script:

```bash
pnpm build       # turbo run build
pnpm typecheck   # turbo run typecheck
pnpm lint        # turbo run lint
pnpm test        # turbo run test
```

Scope to one package with `--filter`, e.g. `pnpm --filter storefront typecheck`. A package missing a given script is a no-op, not a failure.

## Cross-cutting conventions

- **Zod is the schema source of truth.** Shapes that cross the API boundary (Order, Product, Customer, etc.) are defined once in `packages/shared/src/*.ts` and consumed by both `apps/api` (validation + Swagger via `nestjs-zod`) and the two Nuxt apps (client + SSR validation). Add a field there first, then thread it through — don't redeclare the same shape ad hoc in a controller or component.
- **Design tokens live in `packages/ui`**, not per-app. Both Nuxt apps `extends: ['../../packages/ui']` in their `nuxt.config.ts` and inherit fonts/colors/shared components from it. Template-specific palettes in the storefront are a layer on top of this, not a replacement for it (see `apps/storefront/CLAUDE.md`).
- **Prisma migration workflow** (`apps/api`): `npx prisma format` → `npx prisma migrate dev --name X` → `npx prisma generate`. Never hand-edit `apps/api/src/generated/` (Prisma client output) or a migration file after it's landed on another branch/environment.
- **Env var naming must match exactly what the framework auto-maps.** The recurring bug in this repo: Nuxt only auto-maps `NUXT_PUBLIC_*`-prefixed vars to `runtimeConfig.public.*` (e.g. `NUXT_PUBLIC_API_BASE` → `apiBase`) — a var named `NUXT_PUBLIC_API_BASE_URL` is silently ignored, not an error. Check `runtimeConfig` in the relevant `nuxt.config.ts` before inventing a new env var name.
- **`nuxt.config.ts` runs at BUILD time**, not runtime — anything read via `process.env` directly inside it (as opposed to via `runtimeConfig`) needs that var exported in the actual build shell, not just present in a `.env` file a process manager loads later. See `DEPLOYMENT.md` and `apps/storefront/CLAUDE.md`.
- **PM2 is per-Linux-user in production.** Each user has its own PM2 daemon/process list (`~/.pm2`); running `pm2` commands as the wrong user silently operates on an empty, unrelated list rather than erroring clearly. See `DEPLOYMENT.md`.
- **Nitro/Nuxt production builds don't hot-reload.** After any rebuild on the VPS, PM2 processes must be explicitly restarted (`pm2 restart <app> --update-env`) or they keep serving a stale in-memory manifest referencing old build hashes (manifests as 404/500s for assets that look like they "should" exist).

## Skills

`.agents/skills/` has two project skills encoding design-system conventions so the re-themed apps stay consistent: `polaris-design-language` (storefront) and `stripe-polaris-admin-theme` (admin). Check these before making visual changes to either app's chrome/tokens.
