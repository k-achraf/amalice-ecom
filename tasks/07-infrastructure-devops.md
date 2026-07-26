# Infrastructure & DevOps

Cross-cutting — start alongside `01-foundations.md`, not after it. Deployable-from-day-one beats a big-bang infra task at the end of Phase 4.

---

### OPS-01 — Docker images for API & workers
**Depends on:** FND-04 · **Effort:** M

- [ ] Multi-stage Dockerfile for `apps/api` (build stage separate from runtime, minimal final image)
- [ ] BullMQ workers run as a separate container/process from the HTTP API, so a worker crash doesn't take down request handling
- [ ] Image builds reproducibly in CI, not just on one developer's machine

### OPS-02 — Local dev orchestration
**Depends on:** FND-10 · **Effort:** — (tracked as `FND-10`; listed here for visibility only)

See `01-foundations.md`. Cross-referenced because it's the foundation every other infra task in this file builds on.

### OPS-03 — CI pipeline
**Depends on:** FND-11, OPS-01 · **Effort:** M

Extends `FND-11`'s skeleton with the full gate.

- [ ] Lint, typecheck, unit tests, and Docker build all run per-PR, Turborepo affected-only
- [ ] Build artifacts (Docker images) tagged and pushed to a registry on merge to main
- [ ] Pipeline duration tracked — if it creeps past a few minutes, that's a signal to revisit caching before it becomes a tax on every PR

### OPS-04 — CD pipeline
**Depends on:** OPS-03 · **Effort:** L

- [ ] Nuxt apps (`storefront`, `admin`) deploy to Vercel or Cloudflare (NuxtHub) on merge to main
- [ ] `apps/api` + workers deploy to the chosen container platform (Railway/Render/Fly.io to start, per the plan's scale-out path)
- [ ] Rollback procedure documented and tested at least once before this task is called done — "we can roll back" untested is a claim, not a fact

### OPS-05 — Managed Postgres provisioning
**Depends on:** FND-06 · **Effort:** M

- [ ] Managed Postgres 18 instance (Neon or equivalent) for staging and production, separate from local dev
- [ ] Connection pooling (PgBouncer or provider-native) configured before load testing (`RSK-06`) runs against it
- [ ] Migration pipeline runs Prisma migrations as part of `OPS-04`'s deploy, not manually per release

### OPS-06 — Managed Redis provisioning
**Depends on:** FND-04 · **Effort:** S

- [ ] Managed Redis (Upstash or equivalent) for staging and production
- [ ] Separate logical databases/prefixes for cache vs. BullMQ queues, so a cache flush can't accidentally drop in-flight jobs

### OPS-07 — Cloudflare CDN / WAF / DNS
**Depends on:** OPS-04 · **Effort:** M

- [ ] Domain routed through Cloudflare, both apps and the API behind it
- [ ] WAF rules tuned for the storefront's public surface, particularly checkout and OTP endpoints (this is the edge half of the rate limiting in `SEC-06`)
- [ ] Cache rules confirmed not to cache anything customer- or order-specific

### OPS-08 — Error tracking (Sentry)
**Depends on:** OPS-04 · **Effort:** S

- [ ] Sentry wired into `storefront`, `admin`, and `api`, source maps uploaded so stack traces are readable
- [ ] Release tagging tied to deploys, so a spike in errors can be pinned to a specific release
- [ ] Alert routing feeds into `RSK-08`, not a second disconnected alerting setup

### OPS-09 — Logging & uptime monitoring
**Depends on:** OPS-04 · **Effort:** M

- [ ] Centralized log aggregation (Better Stack, Grafana Cloud, or equivalent) across all three apps
- [ ] Uptime checks on the storefront, admin login, and the API's health endpoint
- [ ] Logs retain enough context (request ID correlated across services) to actually debug a production issue, not just confirm one happened

### OPS-10 — Backups & restore drill
**Depends on:** OPS-05 · **Effort:** M

- [ ] Automated daily Postgres backups with point-in-time recovery enabled
- [ ] A full restore-from-backup drill performed and timed at least once — document the actual recovery time, don't assume it from the provider's marketing page
- [ ] R2 object storage (product images, invoices, proof-of-delivery) covered by the provider's own redundancy, confirmed not solely reliant on the Postgres backup

### OPS-11 — Secrets management
**Depends on:** FND-09 · **Effort:** S

- [ ] Secrets stored in the hosting platform's secret manager (not `.env` files committed anywhere, not plaintext in CI config)
- [ ] Rotation procedure documented for API keys (courier, SMS/WhatsApp, Sentry) — at minimum, know how to rotate each one under pressure before you need to
