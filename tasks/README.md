# Build Tasks — COD Storefront & Operations

Implementation-ready task backlog for `cod-platform-plan.md` (the architecture plan one level up). That document says *what* to build and why; this directory breaks it into work items you can actually pick up and check off.

## How to use this

- Each file below is one track — either a roadmap phase or a cross-cutting concern (infra, security).
- Every task has a stable ID, its dependencies, an effort estimate, and acceptance criteria written as checkboxes — not vibes.
- Reference IDs in commits/PRs/branch names, e.g. `FND-03-auth-skeleton`.
- These files are the backlog, not the board. Status (todo/in-progress/done) belongs in whatever issue tracker you use — mirror it there, don't edit these files to track state.
- IDs are stable once assigned. If a task splits, add `-a`/`-b` suffixes rather than renumbering everything after it.

## Track index

| File | Track | Roadmap phase | Depends on |
|---|---|---|---|
| [00-design-system.md](00-design-system.md) | Design system — tokens, theme, shared components | Phase 0 | — |
| [00-design-system-plan.md](00-design-system-plan.md) | ↳ execution runbook for the file above (commands, code, order of ops) | Phase 0 | 00-design-system.md |
| [01-foundations.md](01-foundations.md) | Monorepo, tooling, auth skeleton, schema v1 | Phase 0 | Design system |
| [02-storefront.md](02-storefront.md) | Catalog, cart, COD checkout, OTP, tracking | Phase 1 | Foundations |
| [03-admin-core.md](03-admin-core.md) | Admin app, RBAC, order queue, inventory CRUD | Phase 1 | Foundations |
| [04-fulfillment-courier.md](04-fulfillment-courier.md) | Courier adapters, shipment tracking, RTO, warehouse | Phase 2 | Storefront, Admin core |
| [05-cash-reconciliation.md](05-cash-reconciliation.md) | COD collection tracking, remittance matching, settlement | Phase 3 | Fulfillment |
| [06-risk-search-scale.md](06-risk-search-scale.md) | Fraud scoring, Meilisearch, caching, load testing | Phase 4 | Storefront, Reconciliation |
| [07-infrastructure-devops.md](07-infrastructure-devops.md) | CI/CD, hosting, monitoring, backups | Cross-cutting | Foundations |
| [08-security-compliance.md](08-security-compliance.md) | RBAC enforcement, audit log, PII, rate limits | Cross-cutting | Foundations |
| [09-growth-iteration.md](09-growth-iteration.md) | Analytics, multi-warehouse, coupons, experimentation | Phase 5 | Everything above |

## Task ID prefixes

| Prefix | Track |
|---|---|
| `DS` | Design system |
| `FND` | Foundations |
| `SF` | Storefront |
| `ADM` | Admin / management system |
| `COU` | Courier & fulfillment |
| `FIN` | Cash reconciliation / finance |
| `RSK` | Risk, search, scale |
| `OPS` | Infrastructure / DevOps |
| `SEC` | Security & compliance |
| `GRW` | Growth iteration |

## Effort legend

`S` under 1 day · `M` 1–3 days · `L` 3–7 days · `XL` split into smaller tasks before starting — nothing should ship as an XL task.

## Suggested build order

`00 → 01 → (02 and 03 in parallel) → 04 → 05 → 06`, with `07` and `08` running alongside every other track from day one rather than as a phase of their own — infra and security debt compounds if deferred. `09` starts once `06` is stable in production.

**Current focus (2026-07):** the next milestones are **DS-08** (storefront Polaris re-theme) and **DS-09** (admin Polaris×Stripe re-theme), which gate the storefront expansion (SF-13+) and dashboard build-out (ADM-09+) respectively. After the re-themes: SF-13–SF-19 (full Shopify-like storefront) and ADM-01–ADM-14 (full admin dashboards) run in parallel, with ADM-12/13 (reconciliation/fulfillment screens) waiting on their `FIN`/`COU` domain tracks. Project skills `polaris-design-language` and `stripe-polaris-admin-theme` carry the token values and conventions for the re-theme and the pages that follow.
