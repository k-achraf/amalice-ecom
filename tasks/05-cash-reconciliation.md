# Phase 3 — Cash Reconciliation

The ledger work: matching what a courier actually collected in cash against what each `Delivered` order owes. This is the module where a bug costs real money and real trust, not just a bad UX moment — build it deliberately, and lean on the audit log (`SEC-03`) throughout.

---

### FIN-01 — Reconciliation data model
**Depends on:** FND-06 · **Effort:** M

- [ ] `RemittanceBatch` (one per courier cash handover) and `LedgerEntry` (one per order within a batch) tables
- [ ] Every `LedgerEntry` links to exactly one `Order` and carries expected vs. collected amount
- [ ] Schema makes double-counting an order structurally hard (unique constraint on order↔batch), not just an app-level check

### FIN-02 — Remittance import
**Depends on:** FIN-01, COU-02 · **Effort:** M

- [ ] CSV import (manual) and/or API pull (if the courier partner supports it) for remittance batches
- [ ] Import validates row-level data (valid order reference, numeric amount) before committing, with a clear per-row error report on partial failure — never a silent partial import
- [ ] Imported batches are immutable once created; corrections happen via a new adjustment entry, not an edit

### FIN-03 — Auto-matching job
**Depends on:** FIN-02 · **Effort:** L

- [ ] Matches `LedgerEntry` rows to `Order`s by courier reference ID
- [ ] Exact matches (amount and reference both align) auto-transition the order to `Reconciled`
- [ ] Mismatches (amount differs, or no matching order found) are flagged, never silently accepted or silently dropped

### FIN-04 — Discrepancy review queue
**Depends on:** FIN-03, ADM-02 · **Effort:** M

Finance-role screen.

- [ ] Lists every flagged mismatch with the expected amount, collected amount, and delta, sorted by delta size so the biggest problems surface first
- [ ] Manual resolution action (accept discrepancy with a reason, or reject and escalate) — every resolution is itself an audit-logged event
- [ ] Order only reaches `Settled` after explicit resolution here, per the state machine — no auto-settling a flagged mismatch

### FIN-05 — Settlement reports
**Depends on:** FIN-04 · **Effort:** M

- [ ] Exportable report (CSV/PDF) per period: total COD collected, total settled, outstanding discrepancies, per-courier breakdown
- [ ] Numbers in the report are traceable back to individual `LedgerEntry` rows — a finance user should be able to click through, not just trust a summary figure
- [ ] Report generation runs as a background job (`BullMQ`) for large date ranges rather than blocking a request

### FIN-06 — Reconciliation audit trail
**Depends on:** SEC-03, FIN-04 · **Effort:** S

- [ ] Every state change on a `LedgerEntry` or `RemittanceBatch` (import, match, flag, resolve) writes an audit entry: who, what, when, before/after values
- [ ] Audit entries for this module are queryable by order ID from the order detail view (`ADM-05`) — finance history should be visible in context, not only in a separate audit screen

### FIN-07 — Settlement gate on order state machine
**Depends on:** FIN-03, COU-08 · **Effort:** S

- [ ] `CashCollected → Reconciled → Settled` transitions are only reachable through this module's logic, never a manual admin override (unlike earlier lifecycle states, which do allow manual override per `ADM-05`)
- [ ] Attempting to bypass reconciliation (e.g. manually marking `Settled`) is rejected at the API level, not just hidden in the UI
