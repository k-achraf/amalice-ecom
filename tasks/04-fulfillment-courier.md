# Phase 2 — Fulfillment & Courier Integration

Gets a `Confirmed` order out the door and into a third-party courier's hands, tracks it, and handles what happens when delivery fails. This is where the order lifecycle state machine (plan §7) actually gets driven by the outside world instead of manual admin clicks.

---

### COU-01 — `CourierProvider` interface
**Depends on:** FND-04 · **Effort:** M

Define the contract every courier integration implements, before writing the first real one — this is the seam that keeps "add a second courier" from being a rewrite.

- [ ] Interface covers `createShipment`, `getStatus`, `cancelShipment`, `parseWebhook`
- [ ] Courier-specific status codes normalize to the internal order state enum from `FND-06`, not leaked into the rest of the app as raw provider strings
- [ ] A mock/fake provider exists for local dev and tests — no real API calls needed to develop against this module

### COU-02 — First courier adapter
**Depends on:** COU-01 · **Effort:** L

- [ ] Real implementation of `CourierProvider` for your chosen courier partner
- [ ] Credentials/config sourced from environment (`FND-09`), never hardcoded
- [ ] Integration tested against the courier's sandbox/staging API before touching production orders

### COU-03 — Shipment creation on pack/dispatch
**Depends on:** COU-02, ADM-05 · **Effort:** M

- [ ] Packing an order in admin (`Packed` state) triggers `createShipment`, order moves to `HandedToCourier` on success
- [ ] Failure to create a shipment surfaces clearly to ops (not a silent retry-forever or a swallowed error) with a manual retry action
- [ ] Shipment record stores the courier's tracking/reference ID against the order

### COU-04 — Inbound webhook handling
**Depends on:** COU-01 · **Effort:** M

- [ ] Webhook endpoint verifies the courier's signature/auth before processing (never trust an unauthenticated POST to move an order's state)
- [ ] Status updates normalized and applied through the same state-transition logic `ADM-05` uses — one code path for "admin changed it" and "courier told us," not two
- [ ] Duplicate/out-of-order webhook deliveries handled idempotently

### COU-05 — Polling fallback job
**Depends on:** COU-02 · **Effort:** M

Covers couriers with unreliable webhook delivery, per plan §9.

- [ ] BullMQ scheduled job polls `getStatus` for any shipment not updated within a configurable window (default hourly)
- [ ] Poll results reconcile through the same normalization path as `COU-04`
- [ ] Job failure (courier API down) doesn't block or crash the wider queue — isolated retry/backoff

### COU-06 — Warehouse packing & dispatch UI
**Depends on:** ADM-04, COU-03 · **Effort:** M

- [ ] Warehouse-role view: orders in `Confirmed` ready to pack, pack-confirmation action, dispatch action
- [ ] Packing slip / label generation (PDF) for physical handoff to courier
- [ ] Scoped to the Warehouse role per `ADM-02` — warehouse staff shouldn't see finance or customer PII beyond what packing requires

### COU-07 — Delivery re-attempt logic
**Depends on:** COU-04 · **Effort:** S

- [ ] `DeliveryFailed` → `OutForDelivery` re-attempt, up to a configured max attempts
- [ ] Max attempts exceeded transitions to `ReturnedToOrigin` automatically, not stuck waiting on a manual admin check
- [ ] Each failure reason (from courier webhook, where available) recorded — feeds `RSK-01` risk scoring later

### COU-08 — RTO (return-to-origin) & restock flow
**Depends on:** COU-07 · **Effort:** M

- [ ] `ReturnedToOrigin` → `Restocked` transition restores stock levels via the same audited path as `ADM-07`
- [ ] RTO orders visible in a dedicated admin filter — this is a cost center ops needs to watch, not just another closed order
- [ ] Customer notified of RTO status via `SF-07`'s notification service

### COU-09 — Courier performance tracking
**Depends on:** COU-04 · **Effort:** M

- [ ] Per-courier on-time delivery rate and RTO rate computed and viewable in admin
- [ ] Data granular enough to support a future multi-courier decision (renegotiate vs. switch vs. split volume) — this is reporting, not yet an automated routing decision
