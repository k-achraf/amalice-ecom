# Security & Compliance

Cross-cutting, per the plan's §11 risk controls. Like infrastructure, this runs alongside every other track — the tasks below assume the mechanisms from `FND-07`/`FND-08` exist and turn them into actual enforced guarantees.

---

### SEC-01 — RBAC enforcement audit
**Depends on:** ADM-02 · **Effort:** M

`ADM-02` builds the mechanism; this task proves every module actually uses it.

- [ ] Every admin API route audited against the role table in plan §8 — no route reachable by a role that shouldn't have it
- [ ] Automated test suite asserts 403 for each (role, forbidden-route) pair, not just a manual spot-check
- [ ] Re-run this audit whenever a new admin module ships — add it to the PR checklist for new routes, not just a one-time pass

### SEC-02 — OTP rate limiting
**Depends on:** FND-07 · **Effort:** S

- [ ] Per-phone-number and per-IP limits on both `request` and `verify` endpoints
- [ ] Limits enforced at the Cloudflare edge (`OPS-07`) as a first layer and again in NestJS as defense in depth
- [ ] Limit-exceeded response doesn't leak whether a phone number is a registered customer (avoid turning the rate limiter into an enumeration oracle)

### SEC-03 — Immutable audit log infrastructure
**Depends on:** FND-06 · **Effort:** M

Underlies `ADM-08`, `FIN-06`, and every "who changed this" requirement across the plan.

- [ ] Append-only audit table — enforced at the database level (no `UPDATE`/`DELETE` grant for the application role on this table, not just app-level discipline)
- [ ] Interceptor/middleware pattern in NestJS so adding audit logging to a new mutation is a one-line addition, not a bespoke implementation per module
- [ ] Entry captures actor, action, entity, before/after values, and timestamp — enough to reconstruct what happened without guessing

### SEC-04 — PII encryption at rest
**Depends on:** FND-06 · **Effort:** M

- [ ] Customer phone numbers and addresses encrypted at the column level (or via a KMS-backed approach if the managed Postgres provider offers one)
- [ ] Encryption doesn't break the features that need to query on this data (order lookup by phone in `SF-10` needs a deterministic-searchable approach, not naive random-IV encryption that makes lookups impossible)
- [ ] Key management documented — where the key lives, who can access it, rotation plan

### SEC-05 — Field-level access scoping
**Depends on:** SEC-01, SEC-04 · **Effort:** M

- [ ] Warehouse role's order view shows shipping info needed for packing, not full customer PII or order financials
- [ ] Finance role's view shows financial data without necessarily exposing full customer contact details beyond what reconciliation needs
- [ ] Scoping enforced at the API response layer (field filtering server-side), not just hidden in the admin UI

### SEC-06 — Public endpoint rate limiting
**Depends on:** OPS-07 · **Effort:** S

- [ ] Checkout and OTP endpoints specifically covered (highest-value targets for abuse), plus general rate limits on the rest of the public API
- [ ] NestJS-level throttler configured as defense in depth behind the Cloudflare edge rules
- [ ] Rate-limit responses tested under simulated burst traffic, not just configured and assumed correct

### SEC-07 — Dependency & security scanning in CI
**Depends on:** OPS-03 · **Effort:** S

- [ ] Automated dependency vulnerability scanning (`npm audit`/Snyk/Dependabot or equivalent) running on a schedule and on PRs
- [ ] Secret-scanning enabled on the repo (catches an accidentally committed key before it ships, not after)
- [ ] Process defined for triaging findings — a scanner nobody looks at is not a control

### SEC-08 — Pre-launch security review
**Depends on:** SEC-01 through SEC-07 · **Effort:** M

- [ ] Checklist walkthrough of every item in plan §11 against the actual running staging environment, not just the task list
- [ ] Basic penetration-style pass on checkout, OTP, and admin auth flows (manual or a lightweight external review, scoped to what a small team can reasonably do before launch)
- [ ] Findings triaged and either fixed or explicitly accepted-with-reason before the first real production order ships
