# Phase 0 — Foundations

Monorepo, tooling, environments, auth skeleton, and schema v1. Nothing in `02`–`06` can start until this track is done — treat it as the one place where taking an extra day now is cheaper than paying for it four times later.

---

### FND-01 — Monorepo scaffold
**Depends on:** — · **Effort:** M

Initialize `pnpm` workspaces + Turborepo with `apps/storefront`, `apps/admin`, `apps/api`, `packages/shared`, `packages/ui`.

- [x] `pnpm-workspace.yaml` and root `turbo.json` in place, pipeline defined for `build`/`lint`/`typecheck`/`test` (`apps/api` and `packages/shared` are stubs — recognized workspace members, no real content yet; that's `FND-04`/`FND-05`)
- [x] `turbo run build --dry` shows the expected graph: `admin#build`/`storefront#build` correctly depend on `@amalice/ui#build`; a real `turbo run typecheck` across both apps confirmed working (2/2 successful cold, `FULL TURBO` cache hit on re-run)
- [x] Root `README.md` documents the layout and how to run each app locally — also fixed a port-collision bug this surfaced: neither app had a fixed dev port, so `pnpm dev` (both apps via turbo) would have raced for Nuxt's default 3000. Pinned storefront to 3000, admin to 3001.

### FND-02 — Nuxt 4 storefront app scaffold
**Depends on:** FND-01 · **Effort:** S

- [x] `apps/storefront` on Nuxt 4, consuming `packages/ui` theme (DS-02)
- [x] SSR confirmed working (view-source shows rendered HTML, not an empty shell — `curl` against `/` and `/style-guide` both return full server-rendered HTML)
- [x] ESLint (`@nuxt/eslint`, project-aware flat config) + Prettier (`eslint-config-prettier` disables conflicting stylistic rules rather than running Prettier as an ESLint rule) + explicit `strict: true` in `tsconfig.json` — `pnpm --filter storefront run lint`/`typecheck`/`format:check` and `turbo run lint` all pass clean; production build (`nuxt build`) still succeeds

### FND-03 — Nuxt 4 admin app scaffold
**Depends on:** FND-01 · **Effort:** S

- [x] `apps/admin` on Nuxt 4, SPA rendering mode (`ssr: false`), consuming `packages/ui`
- [x] Base layout (`app/layouts/default.vue`) with a real nav shell — `UDashboardGroup`/`UDashboardSidebar`/`UNavigationMenu` (Nuxt UI v4's dashboard components, verified against current docs before use), collapsible + resizable, dark-mode toggle in the footer. Six nav links to the sections `03-admin-core.md` will build (Orders, Inventory, Reconciliation, Users & Roles, Audit Log) — routes don't exist yet, so they correctly 404 for now (verified via Playwright: no crash, no console error, standard Nuxt 404 page) rather than being dead/fake buttons. No role-based filtering or command palette — that's `ADM-01`, once auth exists. The shared `/style-guide` page opts out via `definePageMeta({ layout: false })` so it keeps rendering standalone in both apps.

### FND-04 — NestJS API scaffold
**Depends on:** FND-01 · **Effort:** M

- [x] `apps/api` on NestJS 11, module structure stubbed: `catalog`, `orders`, `fulfillment`, `reconciliation`, `identity`, `notifications` — each has a real `/health` endpoint, verified booted and responding (all 6)
- [x] OpenAPI (Swagger) doc auto-generated and served at `/docs`, gated to non-prod via `NODE_ENV` check — verified 200
- [x] Global validation pipe (`nestjs-zod`'s `ZodValidationPipe` via `APP_PIPE`) and a standardized error-response shape (`AllExceptionsFilter`: `statusCode`/`error`/`message`/`timestamp`/`path`) — verified on a real 404

### FND-05 — Shared types & schema package
**Depends on:** FND-01 · **Effort:** M

`packages/shared` holds Zod schemas and the TS types derived from them, imported by all three apps so a DTO only gets defined once.

- [x] Order (+ the full 13-state lifecycle enum), Product, Customer/Address, Shipment schemas defined and exported — built as a real dual CJS+ESM package (`unbuild`) with a proper `exports` map, since apps/api (CommonJS) and the Nuxt apps (Vite/ESM) both consume it and a CJS-only build silently breaks Vite's named-export resolution (hit and fixed for real, see `00-design-system-plan.md`-style note: the fix wasn't guessed, it was diagnosed via a failing browser console error)
- [x] Not a real checkout form yet (that's `SF-05`/`SF-06` — building one now would be scope creep), but the *same* `CreateOrderSchema` is proven wired on both sides: `apps/api`'s `OrdersController` uses it as a `nestjs-zod` DTO on a real `POST /orders` (tested valid + invalid payloads), and a live client-side demo on `/style-guide` validates `CustomerSchema.shape.phone` in the browser via the identical import
- [x] Proven for real, not assumed: introduced a deliberate type error in `packages/shared/src/order.ts`, ran `turbo run typecheck` — failed red (`@amalice/shared#typecheck` exit 2, blocked the whole run); reverted — green again, `FULL TURBO` cache hit

### FND-06 — Postgres schema v1 + Prisma setup
**Depends on:** FND-04 · **Effort:** L

Implement the core entities from the plan's ERD (§6): `Customer`, `Address`, `Product`, `Order`, `OrderItem`, `Shipment`, `Courier`, `CashReconciliation`, `AdminUser`, `Role`.

- [x] Prisma 7 schema committed (`apps/api/prisma/schema.prisma`), all 10 entities, migration applied cleanly against a fresh Postgres 18 (docker-compose) — all columns explicitly `@map`'d to snake_case (Prisma defaults to camelCase columns, non-idiomatic for Postgres; caught and fixed before it became a breaking change later)
- [x] `Order.state` is the `OrderState` enum, all 13 states from plan §7, matching `packages/shared`'s Zod enum (`FND-05`) — no free-text status column
- [x] Seed script (idempotent — verified by running it twice, no duplicates) populates 5 roles, 3 products, 1 test customer, 1 test order, and one `AdminUser` per role
- [x] Proven end-to-end through the actual NestJS app, not just `psql`: `GET /orders` returns real seeded data with nested items; `POST /orders` creates a real row (verified order count went 1→2); a bad foreign key returns a safe generic 500, no DB internals leaked

### FND-07 — Auth skeleton: customer OTP
**Depends on:** FND-04, FND-05 · **Effort:** M

- [x] `POST /auth/otp/request` and `POST /auth/otp/verify`, each with its own `@nestjs/throttler` bucket (5/5min, 10/5min) — two real bugs caught here, in sequence. First: both routes initially overrode the same `'default'` throttler name at the same key, silently sharing one counter, so `/verify` traffic was eating into `/request`'s budget — fixed by giving each route its own registered named throttler (`otpRequest`/`otpVerify`). Second (caught during `02-storefront.md` work): `ThrottlerGuard` checks *every* named throttler registered in `forRoot` against *every* route by default, so those two globally-registered strict buckets were silently rate-limiting the product catalog and every other unrelated route to 5-10 req/5min. Fixed by removing the named throttlers entirely and instead overriding `'default'`'s limit per-route via `@Throttle({ default: {...} })` — the storage key already includes controller+handler name, so `/request` and `/verify` still get fully independent counters without leaking onto other routes. Verified: 6th `/request` call in a window returns 429, `/verify` unaffected, and `/products` no longer inherits either OTP bucket
- [x] `OtpProvider` interface + `ConsoleOtpProvider` (logs the code server-side, dev-only) — swapping in real SMS later is a new class + one binding change in `identity.module.ts`, not a rewrite
- [x] Verified end-to-end: request → code appears in server log → wrong code rejected (401) → correct code returns a JWT (`OTP_SECRET`, 30 min expiry, confirmed by decoding it) + upserts a real `Customer` row → replaying the same code fails (one-time use, deleted from Redis on success)

### FND-08 — Auth skeleton: admin JWT + RBAC scaffold
**Depends on:** FND-04, FND-06 · **Effort:** M

- [x] `POST /auth/admin/login` verified end-to-end: correct password → real access (15m) + refresh (7d) JWT pair; wrong password and non-existent email both return the identical "Invalid credentials" (no user-enumeration oracle). `POST /auth/admin/refresh` verified too: a real refresh token issues a fresh pair, a garbage token is rejected — bcrypt-hashed passwords, not plaintext
- [x] `Role` table (`FND-06`) seeded with exactly the five roles from plan §8, one `AdminUser` per role. No separate `Permission` table — this schema/plan describe role-based access (a fixed responsibility per role), not a granular permission-assignment system, so the five `Role` rows *are* the permission model here, not a placeholder for one
- [x] `@Roles()` decorator + `RolesGuard`, proven on `GET /auth/admin/super-admin-only` — verified all three states for real: no token → 401 (`JwtAuthGuard`), valid token but wrong role (`Support`) → 403 (`RolesGuard`, distinct from 401 — authenticated but not authorized), valid token with `SuperAdmin` → 200. A real bug caught along the way: the seed script's `upsert` used `update: {}`, so re-seeding never actually updated an admin's password hash once the record existed — login kept failing until that was fixed to `update: { passwordHash }`

### FND-09 — Environment & config management
**Depends on:** FND-01 · **Effort:** S

- [x] `.env.example` per app (`storefront`, `admin`, `api`, plus root for docker-compose credentials), validated at boot — verified fail-fast on all three: a bad URL crashes the Nuxt apps' built server, a too-short JWT secret crashes the API with a precise field-level error, both exit 1 rather than starting broken
- [x] Local config lives in gitignored `.env` files (copied from `.env.example`); staging/production config doesn't exist yet since there's nowhere to deploy to (no infra provisioned — that's `OPS-05`/`OPS-06`), so "separated" means "not hardcoded, sourced from environment" for now
- [x] Zod used consistently for validation across all four `.env.example`s — `packages/shared` (`FND-05`) reuses the same library for domain schemas, not a separate validation approach

### FND-10 — Local dev orchestration
**Depends on:** FND-01 · **Effort:** S

`docker-compose.yml` for Postgres, Redis, and Meilisearch so `pnpm dev` after a fresh clone works without manual service setup.

- [ ] `docker-compose up` brings up all three services with correct default credentials matching `.env.example`
- [ ] Documented in root README as the first step of onboarding
- [ ] Health-check wait added so the app doesn't race a not-yet-ready Postgres on cold start

### FND-11 — CI pipeline skeleton
**Depends on:** FND-01 through FND-06 · **Effort:** M

Baseline GitHub Actions workflow — full CD is `OPS-03`/`OPS-04`, this is lint/typecheck/test/build only, gating merges.

- [x] `.github/workflows/ci.yml` — lint/typecheck/test/build, each scoped to `turbo run <task> --affected` (Turborepo 2.2+'s auto base-branch detection via `GITHUB_BASE_REF`/`GITHUB_SHA`, verified current syntax rather than assumed), triggered on PRs into `main` and pushes to `main`. YAML syntax validated (`js-yaml`).
- [x] **Partially proven — flagged, not glossed over.** There is no GitHub remote or `gh` CLI in this environment, so the actual "open a PR, watch it go red, push a fix, watch it go green" loop on GitHub Actions itself could not be executed. What *was* proven: ran the exact commands the workflow specifies (`turbo run typecheck --affected`, then all four together) against a deliberate type error in `packages/shared` — red (`@amalice/shared#typecheck` exit 2, blocked the run), reverted — green (9/9 tasks). The workflow YAML wraps these same commands; what's unverified is GitHub Actions' own execution of that YAML, not the underlying gate logic.
- [ ] **Not done — requires a real GitHub repo, left unchecked rather than faked.** "Required status checks" is a branch-protection setting configured via GitHub's UI/API against an actual remote (Settings → Branches → Branch protection rule → Require status checks → select the `Lint, typecheck, test, build` job) — there's nothing to configure it against yet. Do this once the repo has a remote, before the first real PR merges.
