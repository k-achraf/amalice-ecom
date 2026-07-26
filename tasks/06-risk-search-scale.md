# Phase 4 — Risk, Search & Scale Hardening

Two unrelated-sounding jobs that land in the same phase for a real reason: both are "make the system trustworthy and fast enough at real volume" work, done once the core flows (`02`–`05`) are proven, not before.

---

### RSK-01 — Customer risk scoring
**Depends on:** SF-06, COU-07 · **Effort:** L

- [ ] Score built from delivery-failure history, RTO count, and abandoned-OTP attempts (logged since `SF-06`) per customer (matched by phone number)
- [ ] Score exposed to ops/finance on the customer and order views — a number and a plain-language reason, not a black box
- [ ] Threshold configurable, not hardcoded — this will need tuning after real launch data comes in

### RSK-02 — Partial-prepayment gate
**Depends on:** RSK-01 · **Effort:** M

- [ ] Customers above the risk threshold are offered (or required) a small prepayment to place a COD order
- [ ] Requires *some* online payment capability — scope the minimum viable payment integration here (this is the one place the plan's "no card data to protect" simplification gets revisited; keep the integration narrow, don't back into a full payments platform)
- [ ] Clearly communicated to the customer why (no silent extra step) — trust principle from `00-design-system.md` applies here directly

### RSK-03 — Meilisearch indexing pipeline
**Depends on:** SF-01 · **Effort:** M

- [ ] Product changes (create/update/archive, stock changes) sync to a Meilisearch index via a BullMQ job, not a request-blocking write
- [ ] Index rebuild-from-scratch script exists and is tested — you will need it at least once
- [ ] Indexed fields tuned for typo-tolerance and relevance on product name/description/category

### RSK-04 — Storefront search UI on Meilisearch
**Depends on:** RSK-03, SF-12 · **Effort:** S

- [ ] Swap the `SF-12` interim search implementation behind the single search-service interface — this should be a small, contained change if `SF-12` was built correctly
- [ ] Typeahead/instant results on the catalog search box
- [ ] Old Postgres `ILIKE` search path removed, not left as dead code

### RSK-05 — Caching pass
**Depends on:** SF-01, ADM-04 · **Effort:** M

- [ ] Redis caching on hot read paths: catalog listing, product detail, session/auth lookups
- [ ] Cache invalidation tied to the actual write events (product update, stock change) — no fixed-TTL-only caching on data that needs to be immediately consistent (e.g. stock at checkout)
- [ ] Cache hit rate observable (even a basic log/metric is enough at this stage)

### RSK-06 — Load testing
**Depends on:** RSK-05, SF-08, ADM-04 · **Effort:** M

- [ ] Load test script (k6 or similar) covering checkout and the admin order queue — the two paths most likely to buckle under real traffic
- [ ] Documented results: requests/sec sustained before error rate or latency degrades unacceptably
- [ ] At least one bottleneck found and fixed as a result — if the first run shows no issues, the test isn't hitting hard enough yet

### RSK-07 — Database index & query audit
**Depends on:** RSK-06 · **Effort:** M

- [ ] `EXPLAIN ANALYZE` run on the slowest queries surfaced by `RSK-06`
- [ ] Missing indexes added, particularly on the order queue's filter/sort columns and the reconciliation matching join
- [ ] Connection pooling (PgBouncer or provider-managed) confirmed configured before assuming app-level fixes are the bottleneck

### RSK-08 — Alerting thresholds
**Depends on:** RSK-05, FIN-04, OPS-08 · **Effort:** S

- [ ] Alerts wired for: API error-rate spike, BullMQ queue backlog growing unbounded, reconciliation mismatch rate above a threshold, low-stock breach (from `ADM-07`)
- [ ] Alerts route somewhere a human actually sees them promptly (not a channel nobody watches) — confirm this with whoever owns on-call before calling the task done
