# Phase 5 — Growth Iteration

Ongoing backlog once `06-risk-search-scale.md` is stable in production. Lighter detail than earlier tracks by design — these get scoped properly closer to when they're picked up, once real usage data exists to inform them rather than guesses made before launch.

---

### GRW-01 — Analytics dashboards
**Depends on:** FIN-05, COU-09 · **Effort:** L

- [ ] Sales, COD collection rate, RTO rate, and courier performance in one admin dashboard (not four separate reports someone has to stitch together manually)
- [ ] Built on data that's already being tracked (`FIN-05`, `COU-09`, `RSK-01`) — this is a presentation layer, not new instrumentation

### GRW-02 — Multi-warehouse inventory
**Depends on:** ADM-07 · **Effort:** L

- [ ] Stock tracked per warehouse location, not a single global number
- [ ] Order fulfillment logic picks the correct source warehouse — needs real design work once volume justifies more than one location, don't over-build this speculatively now

### GRW-03 — Coupons & discount engine
**Depends on:** SF-05 · **Effort:** M

- [ ] Percentage/fixed discounts, applied at checkout, validated server-side (never trust a client-supplied discount amount)
- [ ] Usage limits (per-customer, total) enforced atomically to prevent race-condition over-redemption

### GRW-04 — Marketing campaign tools
**Depends on:** SF-07 · **Effort:** M

- [ ] Reuses the notification service from `SF-07` for campaign sends, rather than a parallel messaging system
- [ ] Opt-out respected and enforced at the send layer, not just a UI checkbox

### GRW-05 — A/B testing infrastructure
**Depends on:** RSK-05 · **Effort:** M

- [ ] Feature-flag/experiment framework for the storefront, with results attributable to real conversion/RTO metrics already tracked elsewhere in the system
- [ ] Scoped to storefront experiments first — admin/ops tooling doesn't need this

### GRW-06 — Customer accounts & loyalty (optional)
**Depends on:** FND-07 · **Effort:** L

- [ ] Only worth building if repeat-purchase rate data (from `GRW-01`) shows it'd move the needle — don't build loyalty mechanics speculatively
- [ ] If built, extends the existing phone-based identity (`FND-07`) rather than introducing a separate password-based account system

### GRW-07 — Multi-language storefront
**Depends on:** SF-02, SF-03 · **Effort:** L

- [ ] `@nuxtjs/i18n` wiring, only pursued if expanding into a genuinely new-language region — premature otherwise
- [ ] Content (product descriptions, notification templates) needs a real translation workflow, not just UI-string i18n
