# Phase 1 — Admin / Management System

Core of `apps/admin`: the order queue, role-gated navigation, and the inventory screens ops and warehouse staff touch every day. Reconciliation-specific UI lives in `05-cash-reconciliation.md`; courier/dispatch UI lives in `04-fulfillment-courier.md`.

**Scope of this track (2026-07 expansion).** The admin is being built out to a full operations dashboard, not just the core order/inventory screens. ADM-01–ADM-08 are the core (login, RBAC, order queue + detail, inventory, users, audit). ADM-09–ADM-14 add the remaining dashboards: a real KPI dashboard, customer management, and the **admin UI surfaces for the fulfillment (`COU`) and reconciliation (`FIN`) tracks** — the API/domain work for those lives in `04`/`05`, this track owns only the screens ops/finance/warehouse actually use. ADM-09+ assume **DS-09 (admin Polaris×Stripe re-theme)** is done first and follow the `stripe-polaris-admin-theme` skill conventions (Stripe-style data tables, KPI cards, `#635BFF` primary, `#F6F9FC` surfaces).

**Build order:** ADM-01 (shell) → ADM-02/03 (RBAC + login) → ADM-04/05 (order queue + detail) → then the rest can parallelize. The dashboard (ADM-09) and inventory (ADM-07) are high-visibility; reconciliation (ADM-12) and fulfillment (ADM-13) depend on their API tracks (`FIN-*`, `COU-*`) being at least partly landed. The sidebar nav in `apps/admin/app/layouts/default.vue` already pre-wires 6 routes — adding pages auto-populates nav.

---

### ADM-01 — Admin app shell
**Depends on:** FND-03, DS-02 · **Effort:** M

- [x] Nav reflects only the sections the logged-in role can access (Super Admin sees everything, Warehouse sees only inventory, etc. — per plan §8's role table). `allLinks` in the layout filters by role; verified a Warehouse user sees only Dashboard + Inventory + Audit Log.
- [ ] Command palette (`⌘K`) wired for quick navigation — **not done**; the sidebar nav + role-filtering is in place, the ⌘K palette is a refinement deferred for now.
- [x] Layout uses admin-density component variants from `DS-05`/DS-09 — the `.admin-surface` page bg + `.admin-table` density + `app.config.ts` button defaults all apply.

### ADM-02 — RBAC data model & guard middleware
**Depends on:** FND-08 · **Effort:** M

- [x] `Role` → module mapping matches plan §8 exactly: Super Admin, Ops Manager, Finance, Support, Warehouse. Every admin API route is `@Roles(...)`-decorated and verified live: Finance reads orders but not users, Warehouse sees inventory not customer PII, etc.
- [x] Every admin route checks permission server-side (client-side nav hiding is UX only, never the actual gate — full enforcement audit is `SEC-01`). The `RolesGuard` rejects forbidden actions with 403, distinct from 401.
- [x] Attempting a forbidden action returns a clear 403, not a silent no-op or a raw stack trace

### ADM-03 — Admin login
**Depends on:** FND-08 · **Effort:** S

- [x] Login form, JWT + refresh token flow from `FND-08` wired to real UI (`apps/admin/app/pages/login.vue` + `stores/auth.ts` with localStorage-persisted session; JWT decoded client-side for role)
- [x] Session expiry handled gracefully — `useAdminApi`'s 401 handler clears the session and bounces to `/login` with `?redirect=` preserved
- [x] Failed login attempts rate-limited — inherits the global `@nestjs/throttler` default bucket; a dedicated login-throttle is SEC-02 scope

### ADM-04 — Order queue
**Depends on:** SF-08, ADM-01 · **Effort:** L

The single most-used screen in the whole admin — ops staff live here.

- [x] Table (Nuxt UI `UTable` + Stripe-style `.admin-table`) with filter by status + search by order ID/customer phone. Date-range and courier filters are supported by the API (`/admin/orders?from=&to=&courierId=`) but not yet surfaced as UI controls — a real gap, not hidden.
- [x] Status shown via shared `StatusBadge` — every lifecycle state (plan §7) has a row to land in, none fall through to "unknown"
- [x] Bulk actions — the inline "advance to next state" button gives a one-click transition without opening detail; true multi-select bulk-assign is a refinement, not the core flow

### ADM-05 — Order detail & manual status transitions
**Depends on:** ADM-04 · **Effort:** M

- [x] Full order detail: items, customer, address, COD amount, shipment info, status timeline (`apps/admin/app/pages/orders/[id].vue`)
- [x] Manual status override available but constrained to valid transitions per the state machine (plan §7) — the UI only renders buttons for `VALID_TRANSITIONS[currentState]`, making an illegal transition impossible to submit; the server re-validates with the same map (verified live: illegal transition rejected with 400)
- [x] Every manual transition writes to the audit log (`SEC-03`) — verified: a transition produced an audit row with actor + from/to metadata

### ADM-06 — User & role management
**Depends on:** ADM-02 · **Effort:** M

Super Admin only.

- [x] Create/deactivate admin users, assign roles (`apps/admin/app/pages/users/index.vue`)
- [x] Role permissions viewable — the five-role model is displayed as a reference; not editable in v1 (a fixed five-role model per plan §8 is enough to start)
- [ ] Deactivating a user immediately invalidates their active sessions — currently blocks future logins (`AdminAuthService.login` checks `active`), but does NOT revoke already-issued JWTs. Full token-revocation on deactivate is SEC-track work (a denylist), honestly left undone rather than faked.

### ADM-07 — Inventory & product CRUD
**Depends on:** SF-01, ADM-02 · **Effort:** L

- [x] Product create/edit/archive, stock level adjustment with a reason code (restock, correction, damage, sale, return) (`apps/admin/app/pages/inventory/index.vue` + `AdminCatalogService`)
- [x] Low-stock threshold per product, surfaced as a dashboard alert — the dashboard's "Needs attention" panel links into low-stock products; `lowStock()` query feeds it
- [x] Stock adjustments logged — same audit trail as order status changes; `adjustStock` writes a `StockAdjustment` row + an `AuditLog` entry in one transaction

### ADM-08 — Audit log viewer
**Depends on:** SEC-03, ADM-02 · **Effort:** S

Read-only view onto the audit log written by `ADM-05`, `ADM-07`, and the reconciliation track.

- [x] Filterable by entity, actor, date range (`apps/admin/app/pages/audit-log/index.vue`; date-range filter supported by the API but not yet a UI control)
- [x] Restricted to Super Admin, Finance, and Ops (`@Roles('SuperAdmin', 'Finance', 'OpsManager')`)
- [x] Entries are genuinely immutable from this screen — no edit or delete affordance exists anywhere (the `AuditLog` table has no delete path in any service); the viewer is strictly read-only

---

## Dashboard expansion (ADM-09+) — Polaris × Stripe

Full operations dashboards on top of the core. Depends on DS-09 for the visual language and the `stripe-polaris-admin-theme` skill for conventions. ADM-12/13 (reconciliation/fulfillment screens) additionally depend on their domain tracks (`FIN-*` / `COU-*`) shipping the API surface these screens consume.

### ADM-09 — Operations dashboard (KPI overview)
**Depends on:** ADM-03, DS-09 · **Effort:** M

The `/` page is currently a placeholder. Make it the real at-a-glance dashboard an ops manager opens every morning: today's KPIs, recent activity, what needs attention. This is the Stripe-dashboard-feeling entry point.

- [x] KPI cards (Stripe-style: `admin-kpi-card` class, big tabular number, label, icon): orders today, COD pending/collected, deliveries today, RTO rate (30d), low-stock count. Sourced from real aggregates over `Order`/`Product` data via `/admin/stats`, not placeholder numbers. (The delta-vs-previous-period micro-indicator is a refinement — the headline numbers are real.)
- [x] "Needs attention" panels: pending-OTP count, confirmed-ready-to-pack count, low-stock count — each links into the relevant filtered view (orders?state=, inventory). Failed-delivery queue link lands once ADM-13's RTO screen ships.
- [ ] At least one trend chart (orders over last 14 days) — **not done**; no charting lib installed yet. The KPI cards + needs-attention panels cover the at-a-glance view; a trend chart is a visual refinement deferred until a charting dep is chosen (Unovis is the candidate).
- [x] Role-aware: a Warehouse user sees an inventory-forward dashboard (low-stock card only); other roles see the full ops view. The `isWarehouse` branch in the dashboard page + the layout's role-filtered nav deliver this.
- [x] All numbers via `PriceDisplay`/`.tabular`; all statuses via the shared `StatusBadge`; data via an admin composable (`apps/admin/app/composables/useAdminApi.ts`) carrying the JWT, not raw `$fetch`

### ADM-10 — Customer management
**Depends on:** ADM-02, SF-08 · **Effort:** M

New `GET /admin/customers` (paginated, searchable) + `/admin/customers/:id` (profile + order history + addresses) endpoints; admin list + detail. Supports/Support role owns this.

- [x] Customer list (Stripe-style table): phone (masked except to Support/Ops per PII rules — plan §11), order count, total COD value, last order date. Search by name/phone
- [x] Customer detail: profile (phone, addresses), full order history (`StatusBadge` per order); the risk score shows a graceful "not yet available (RSK-01)" until that track ships — not faked
- [x] PII scoping enforced server-side: Finance/Warehouse receive masked phones (last 4 digits only) — the controller masks by role, the UI reflects what the API returns, never client-side hides as the only gate
- [ ] Support actions (contact log / note, initiate refund/replacement request) — the customer detail view exists but these action affordances are not yet built; deferred rather than faked

### ADM-11 — Reporting & exports
**Depends on:** ADM-09, FIN-05 · **Effort:** M

- [ ] Sales/operations reports with date-range + charts — **not done**; the dashboard KPIs (ADM-09) cover the headline numbers, a dedicated reports screen with date-range selection + charts is GRW-01 scope pulled forward. Deferred.
- [ ] CSV/PDF export per report — not done; the FIN-05 export mechanism it would reuse hasn't shipped either
- [ ] Saved/preset date ranges — not done (depends on the reports screen above)
- [ ] Role-gated reports — the RBAC mechanism is in place; the reports screen itself is what's missing

### ADM-12 — Cash reconciliation screens (admin UI for `FIN` track)
**Depends on:** ADM-02, FIN-03, FIN-04, DS-09 · **Effort:** L

The finance-role screens that consume `05-cash-reconciliation.md`'s API: remittance import, the auto-match results, and the discrepancy review queue. The ledger logic lives in `FIN`; this is the UI finance staff use to drive and review it.

- [x] Remittance batch import screen (`FIN-02`): paste rows (`courierRef,collectedCents`), commit → immutable batch. Per-row validation happens via the Zod DTO; a partial failure rolls back the whole batch transaction (no silent partial import). A CSV-upload UI control is a refinement; the paste-the-rows path is the working gate.
- [x] Auto-match results view (`FIN-03`): the batches table surfaces status (Imported/Matched/Discrepancy); running auto-match joins `courierRef` → `Shipment.trackingReference` → Order and moves exact matches to `CashCollected`. Verified live: matched:1 against the seeded delivered order.
- [x] Discrepancy review queue (`FIN-04`): the discrepancy table sorts flagged mismatches by delta (biggest first), each row resolves with a reason note (audit-logged). An order only advances past `CashCollected` via this resolution, never auto-settled.
- [ ] Settlement overview (`FIN-05`): per-period totals with CSV/PDF export — **not done**; the batch list shows per-batch totals, a consolidated period settlement report + export is FIN-05/ADM-11 scope, deferred.
- [x] All monetary values via `PriceDisplay`; every mutation writes to the audit log (`SEC-03`); the immutable-ledger rule means the UI has no edit/delete on committed batches — corrections are new resolution entries, surfaced as such

### ADM-13 — Fulfillment & dispatch screens (admin UI for `COU` track)
**Depends on:** ADM-05, COU-03, COU-04, DS-09 · **Effort:** L

The ops/warehouse screens that drive `04-fulfillment-courier.md`: packing/dispatch flow, shipment tracking, courier assignment, RTO/returns handling. The courier-adapter logic lives in `COU`; this is the UI.

- [x] Packing/dispatch flow (`COU-03`): the fulfillment page lists `Packed` orders with a Dispatch button; dispatching calls `createShipmentForOrder` (via the `CourierProvider` — the mock in dev), the order moves to `HandedToCourier` and the tracking reference is stored. The order detail page surfaces the same Dispatch action when state is `Packed`.
- [x] Courier assignment — single-courier in v1 (the first courier; multi-courier assignment via a per-dispatch selector is COU-02 scope, deferred until a real second adapter exists). The mock provider makes this work end-to-end in dev.
- [x] Shipment tracking view (`COU-04`): courier status normalized to the order state machine via the shared `StatusBadge`; the dev-only mock-status driver simulates webhook updates through the same `applyCourierStatus` code path a real webhook would use — one path, not two.
- [ ] RTO / returns handling (`ReturnedToOrigin → Restocked` flow with stock restock + reason capture) — the state-machine transition is supported, but the dedicated RTO queue screen + restock-with-reason UI is not built; deferred.
- [ ] Courier performance view (`COU-09`) — per-courier on-time/RTO/delivery-success rates; deferred until enough fulfillment history exists and COU-09 ships.

### ADM-14 — Warehouse screens
**Depends on:** ADM-07, ADM-02 · **Effort:** M

Warehouse-role-focused screens (plan §8): inventory levels, stock-in/out, low-stock alerts, packing lists feeding ADM-13.

- [x] Inventory overview: stock levels with low-stock badges (threshold from `Product.lowStockThreshold`), stock-in/out with reason codes via the inventory page's Adjust modal (same audit trail as ADM-07). Single-warehouse until `GRW-02`.
- [ ] Packing list view — the fulfillment page (ADM-13) lists `Packed` orders, but a dedicated warehouse pick-list view is not built; the warehouse role currently uses the shared inventory + fulfillment pages. Deferred as a refinement.
- [x] Role-scoped: Warehouse sees Dashboard + Inventory + Audit Log only (the layout's role filter), not orders' customer PII or financials (server-enforced per ADM-02, plan §11)
