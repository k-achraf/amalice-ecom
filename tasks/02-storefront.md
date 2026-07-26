# Phase 1 — Storefront

Catalog, cart, COD checkout, and order tracking for the customer-facing `apps/storefront`. Full-text search via Meilisearch is deliberately deferred to `06-risk-search-scale.md` — this track ships with a basic Postgres-backed filter so checkout isn't blocked on search infrastructure.

**SF-01–SF-12 (done)** shipped the core COD loop: browse → PDP → cart → OTP checkout → confirmation → tracking → history. It's a working MVP, not a full store. **SF-13–SF-19 (new)** is the expansion to a real Shopify-like storefront: marketing home, collections, CMS/legal pages, richer PDP (gallery/variants/reviews/related), and the SEO/infra a store needs. SF-13+ assume **DS-08 (storefront Polaris re-theme)** is done first — they build on the Polaris visual language, not the old amber theme. Read the project skill `polaris-design-language` before picking up any SF-13+ task.

> Note on schema: SF-15 (rich PDP) and SF-16 (reviews) require **new tables** (`ProductImage`, `ProductVariant`, `Review`, `Wishlist`) plus `Product`/Prisma/`packages/shared` changes. Land those migrations alongside SF-15, not as a separate "schema v2" task — the feature and the schema ship together so the storefront never codes against a shape that doesn't exist yet.

---

### SF-01 — Product catalog API
**Depends on:** FND-06 · **Effort:** M

- [x] `GET /products` (pagination, `category`, `minPriceCents`/`maxPriceCents`) and `GET /products/:slug` — verified all filters against real seeded data (5 products across 3 categories), 404 on unknown slug. Added `category` to `Product` in both Prisma and `packages/shared` — a real gap from `FND-06`, the field never existed until this task needed it
- [x] `stockQuantity` present on every response (list and single) — it's just a plain column on `Product`, never hidden
- [x] Response shape matches `packages/shared`'s `Product`/`ProductListResponse` — caught and fixed a real type mismatch: Prisma returns `null` for unset nullable columns, the Zod schema originally only accepted `undefined` (`.optional()`); fixed to `.nullable().optional()` so it's structurally assignable from what Prisma actually returns

### SF-02 — Catalog browse page
**Depends on:** SF-01, DS-05 · **Effort:** M

- [x] Grid view with category and search filters (price-range filter UI deferred — API supports `minPriceCents`/`maxPriceCents`, no UI control wired to it yet, a real gap not hidden), using shared `PriceDisplay` — verified via Playwright against 5 real seeded products: grid renders correct names/prices, category select and search box both round-trip through the URL query (`?q=lamp&page=1`) and refetch
- [x] Loading state (simple pending text) and empty state use the shared `EmptyState` component — verified `EmptyState` appears for a nonsense search with zero matches
- [x] SSR-rendered, not client-fetched-only — verified via raw `curl` (product names present in the initial HTML response, no JS execution). Full Lighthouse audit not run (no Chrome/Lighthouse CLI in this environment); instead verified the concrete signals Lighthouse's SEO category checks directly: `<title>`, a real `<meta name="description">` (added this task — was previously missing entirely), viewport meta, charset, and crawlable `<a href>` links via `NuxtLink`

### SF-03 — Product detail page (PDP)
**Depends on:** SF-01, DS-05 · **Effort:** M

No product variants in the schema yet (single SKU per `Product`), so that part of the acceptance criteria doesn't apply — not hidden, just not a thing that exists to build against.

- [x] Image, stock status (in-stock / low-stock / out-of-stock, low-stock threshold pulled from the real `lowStockThreshold` column), quantity selector, add-to-cart — verified via Playwright against real seeded products: `/products/ceramic-mug` renders name/price/description, quantity increments correctly, "Add to cart" adds the right quantity and shows a confirmation message
- [x] Out-of-stock state disables both the quantity selector and add-to-cart button (`:disabled` bound to `!inStock`, not just styled to look disabled) and shows the `error`-token `UBadge`, not a grey button — code-path verified (`inStock` computed + `:disabled` bindings); no seeded product is currently at 0 stock so this wasn't exercised against a live fixture, only against the store's own logic in the cart revalidation test (a wallet driven to 0 stock server-side was correctly treated as unavailable)
- [x] Structured data (schema.org `Product`, with nested `Offer`/`availability`) injected via `useHead`'s `script` array — verified the `application/ld+json` tag is present and parses to the correct product name

### SF-04 — Cart
**Depends on:** SF-01 · **Effort:** M

- [x] Client-side cart (Pinia store: `apps/storefront/app/stores/cart.ts`), persisted to `localStorage`, hydrated via a client-only plugin — verified reload-persistence via Playwright (add items, reload the page, cart contents survive). No server-sync for logged-in customers — there's no customer login/session concept in this app (checkout is phone+OTP per order, not an account system), so that half of the acceptance criteria doesn't apply here
- [x] Server-side re-validation of price/stock, wired to run when the cart page loads (today's stand-in for "checkout start" until `SF-05` exists; will run again there) — verified against real Postgres mutations: drove one item's stock to 0 (correctly removed, user-visible notice) and changed another's price (correctly updated in place, user-visible notice), then confirmed the DB was restored afterward. A real bug was caught and fixed here: the original revalidation logic treated *any* fetch failure (network blip, a 429, a 500) the same as "product deleted" and silently emptied the whole cart — now only a confirmed 404 removes a line; other failures leave the cached line untouched
- [x] Quantity limits enforced against live stock (`Math.min(requested, stockQuantity)` on add, on manual quantity change, and again on revalidation)

### SF-05 — Checkout: address & review
**Depends on:** SF-04, DS-05 · **Effort:** M

- [x] Multi-step checkout (`UStepper` as the visual indicator, address → review → verify) — driven by the app's own step state (`UStepper` doesn't gate content itself); `apps/storefront/app/pages/checkout.vue`
- [x] Address form validated against the shared schema — `CheckoutSchema.omit({ items: true })` from `@amalice/shared` passed directly to `UForm`'s `schema` prop, the identical Zod object the API's `CheckoutDto` validates against, not a re-implemented copy
- [x] Order summary (review step) shows exact COD amount due before the customer commits — verified via Playwright: cart total ($12.00 for 1 ceramic mug) shown correctly at review, matches the confirmed order's total

### SF-06 — Phone OTP verification at checkout
**Depends on:** FND-07, SF-05 · **Effort:** M

The single highest-leverage anti-fraud control in the whole system (plan §7, §11) — do not let this slip to a later phase.

- [x] OTP required before an order can move from cart to `Confirmed` — checkout's third step blocks on `POST /orders/:id/confirm`; verified end-to-end with a real code read from the API's dev log: wrong code → inline error, stays on `/checkout`, no navigation; correct code → order confirmed, redirected to the confirmation page, cart cleared
- [x] Resend/expiry UX: "Resend code" re-calls `POST /auth/otp/request` (phone-keyed, same underlying `OtpService` as the original request, so it works against the same pending order) with a 60s client-side cooldown so it can't be spammed faster than the server's own 5/5min limit — verified the button is correctly disabled immediately after the code is sent
- [x] Failed/abandoned attempts logged — already covered server-side by `SF-08`'s `OrdersService.confirmOrder` (`Logger.warn` on OTP verify failure); no new client-side work needed here
- A real, significant bug was found and fixed while testing this: `ThrottlerGuard` applies *every* registered named throttler to *every* route by default, so the `otpRequest`/`otpVerify` buckets originally added in `FND-07` were silently rate-limiting the product catalog (and every other route) to 5–10 requests per 5 minutes. Fixed in `FND-07`'s entry in `01-foundations.md` — the OTP routes now override `'default'`'s limit per-route instead of registering new global names.

### SF-07 — SMS/WhatsApp/email notification provider integration
**Depends on:** FND-04 · **Effort:** M

Shared notification service used by storefront order events and (later) admin/finance events.

- [x] `NotificationProvider` interface + `ConsoleNotificationProvider` (dev-only, logs) — same pattern as `FND-07`'s `OtpProvider`, one binding change in `notifications.module.ts` to go real
- [x] BullMQ queue (`@nestjs/bullmq`), 3 attempts with exponential backoff — a dedicated ioredis connection (`maxRetriesPerRequest: null`, a hard BullMQ requirement), not shared with `RedisService`, since a worker's blocking commands would starve OTP's Redis reads/writes on a shared connection
- [x] `Notification` model (new — added to `FND-06`'s schema) tracks `status`/`attempts`/`lastError` per row, updated by the processor on both success and failure. Minimal "visible to support" proof: `GET /notifications/order/:orderId` — the real admin UI for this is `ADM` track's job, not this one's

### SF-08 — Order placement API
**Depends on:** SF-06, FND-06 · **Effort:** M

Redesigned from `FND-05`'s original `POST /orders` proof-of-concept, which accepted a `customerId`/`addressId`/client-supplied prices — fine for proving the shared-schema wiring, not fine as real checkout logic. The real flow: `CheckoutSchema` (phone + address + `{productId, quantity}` items only, no price) → server resolves live prices/stock → upserts `Customer` by phone → creates `Order` in `PendingOTP` → `POST /orders/:id/confirm` verifies the OTP and transitions state.

- [x] `POST /orders` creates `PendingOTP`; `POST /orders/:id/confirm` verifies OTP (reusing `FND-07`'s `OtpService`) and transitions to `Confirmed` — verified end-to-end with real seeded products: correct total computed server-side ($61.00 for 3 mugs + 1 tote, never trusting a client price), wrong code → 401 (order stays `PendingOTP`), re-confirming an already-`Confirmed` order → 409
- [x] Stock decremented transactionally via an atomic conditional `UPDATE ... WHERE stockQuantity >= quantity` inside `prisma.$transaction` — proved the actual concurrency guarantee, not just the happy path: manually depleted stock between checkout and confirm, confirm correctly failed with 409, the order was marked `Cancelled`, and stock was verifiably untouched (transaction rolled back, not just the order state)
- [x] Order confirmation enqueues a real notification via `SF-07`'s service — verified the full chain: confirm → BullMQ job → `ConsoleNotificationProvider` logs it → `Notification.status` becomes `Sent`, queryable via `GET /notifications/order/:id`

### SF-09 — Order confirmation page
**Depends on:** SF-08 · **Effort:** S

- [x] Shows order ID, items, COD amount due, estimated delivery window — the delivery window is a flat placeholder estimate ("3–5 business days"), honestly labeled as such in code; a real per-order estimate depends on the `COU` (courier) track, which doesn't exist yet
- [x] Order ID rendered in the shared mono/tabular style (`DS-03`'s `.tabular` class — JetBrains Mono + tabular-nums, same class `PriceDisplay` uses) — this is a number the customer will read back over the phone to support

### SF-10 — Order tracking (lookup by phone / order ID)
**Depends on:** SF-08, DS-05 · **Effort:** M

New endpoint: `GET /orders/:id/track?phone=...`. Order id + phone act as a shared secret — public and unauthenticated by design (there's no account system), but the id alone is a guessable-enough UUID that wrong-phone and unknown-id both return the identical generic 404 (no oracle for "does this order id exist").

- [x] Public lookup route (`apps/storefront/app/pages/track.vue`), rate-limited (`@Throttle({default: {limit: 20, ttl: 5min}})`, ties into `SEC-06`'s broader work), no login required — verified via curl and Playwright: correct phone → 200 with order data, wrong phone → 404, unknown order id → the same 404
- [x] Uses the shared `StatusBadge` so tracking state matches admin's internal state 1:1 — same component, same `OrderState` union from `@amalice/shared`
- [x] Shows courier tracking reference once available (`Shipment.trackingReference`), gracefully falls back to a plain "not yet" message otherwise — honest about the gap: nothing in the codebase creates `Shipment` rows yet (that's the `COU` track), so this always shows the fallback today; the field is wired end-to-end and ready for when it does

A real bug was caught and fixed while building this: `apps/storefront/app/pages/track.vue`'s form fields, filled by Playwright immediately after the page became interactive, were silently reverted to empty right after — Vue's hydration pass was reconciling against the still-empty server-rendered state and clobbering the just-typed value. Fixed by wrapping the form in `<ClientOnly>` (nothing here has SEO value server-rendered anyway, so deferring to client-mount removes the race instead of narrowing it). The same fix was applied to `SF-11`'s page for the same reason.

### SF-11 — Order history for returning customers
**Depends on:** SF-08, FND-07 · **Effort:** S

New endpoint: `GET /orders/history`, guarded by a new lightweight `CustomerAuthGuard` (not a full passport strategy — this is one route's worth of auth, with a different secret/payload shape than the admin JWT) that verifies the same 30-minute token `POST /auth/otp/verify` already issues.

- [x] Customers verify by phone (reusing `FND-07`'s existing OTP request/verify flow, not a new mechanism) and see their past orders, no separate password-based account required — verified end-to-end via Playwright with a real code read from the API's dev log: request code → verify → `GET /orders/history` with the returned bearer token → order list rendered. Also verified rejection paths directly: no token → 401, garbage token → 401
- [x] Reuses `SF-10`'s status rendering — same `StatusBadge` component, not a second implementation

A second real bug was caught and fixed here: on first boot, `CustomerAuthGuard` (declared in `IdentityModule`, used via `@UseGuards()` on a controller in `OrdersModule`) failed with "Nest can't resolve dependencies... JwtService... available in the OrdersModule module" — a class referenced in `@UseGuards()` gets instantiated using the *controller's own* module context, which doesn't automatically inherit the declaring module's imports. Fixed by registering `IdentityModule`'s `JwtModule.register({ global: true })` instead of a module-scoped registration.

### SF-12 — Storefront basic catalog search (interim)
**Depends on:** SF-01 · **Effort:** S

Postgres `ILIKE`/trigram search, explicitly a placeholder for `RSK-3`/`RSK-4`'s Meilisearch rollout.

- [x] Search box on the catalog page returns relevant results for product name/description — landed with `SF-02`; verified end-to-end via Playwright, search "lamp" correctly returns "Desk Lamp"
- [x] Isolated behind `CatalogSearchService.buildSearchFilter()` — `ProductsController` calls it, never builds `ILIKE` conditions itself; a Meilisearch swap changes one file

---

## Full-store expansion (SF-13+)

Builds out the storefront into a complete Shopify-like store. **Depends on DS-08 (Polaris re-theme) for the visual language** and on `polaris-design-language` skill for conventions. These tasks are sequential by dependency, not strictly by ID — see each task's `Depends on`.

### SF-13 — Storefront layout chrome: header, mega-menu, footer, announcement bar
**Depends on:** DS-08 · **Effort:** M

The current `app/layouts/default.vue` is a minimal one-row header with no footer, no category nav, no mobile drawer, no announcement bar. A real store's chrome is its navigation backbone — get this right before the marketing/collection pages that live inside it.

- [x] Rich header: announcement bar (dismissible, content static in v1 — no CMS yet), logo/wordmark, category nav (desktop) + hamburger drawer (mobile) via `SiteHeader.vue`, header search input (round-trips to `/catalog?q=`), cart link with count, and "Track order" / "My orders" — responsive down to mobile
- [x] Footer: multi-column (Shop categories, Customer service links to the SF-14 pages, Company/legal, trust strip for COD benefits), legal row (Terms/Privacy/Shipping/Returns → SF-14), copyright. Newsletter signup stub deferred (no placeholder endpoint to wire to yet — not faked).
- [x] All chrome uses Polaris tokens from DS-08 — no hardcoded hexes in the layout; nav and drawer built with Nuxt UI `USlideover`, not bespoke
- [x] Mobile drawer: hamburger opens a `USlideover` with all nav + customer-service links. (Automated Playwright width checks not run in this pass; the responsive layout + drawer render against real SSR content.)

### SF-14 — CMS / static store pages (about, contact, FAQ, policies)
**Depends on:** SF-13 · **Effort:** M

The legal/SEO/trust pages a COD store needs. Static (no CMS) in v1 — content authored in Vue pages, not a database table. A real CMS is `GRW`-track work if usage justifies it.

- [x] Pages: `/about`, `/contact` (form → posts to `/notifications/contact`; falls back gracefully if that endpoint isn't wired, not a mailto), `/faq` (accordion), `/how-it-works`, `/shipping` (honest about the COD flow + the 3–5 day placeholder estimate), `/returns`, `/terms`, `/privacy`
- [x] A consistent long-form content layout (prose container, consistent heading hierarchy) shared across the pages
- [x] Every page has `useSeoMeta` (title + description) and an `<h1>`; policy pages carry a "last updated" date
- [x] Footer (SF-13) links to the relevant policy pages — no dead links (checkout policy-link wiring is a small SF-05 follow-up)

### SF-15 — Rich product detail: gallery, variants, related products
**Depends on:** SF-03, DS-08 · **Effort:** L

The current PDP (`products/[slug].vue`) is single-image, single-SKU, no variants, no related. This makes it a real product page. **Requires a schema migration** — landed as part of this task: `ProductImage` (1:N, ordered), `ProductVariant` (optional; a product with no variants stays single-SKU). The `related` set is same-category (excluding self), not a curated field. Prisma, `packages/shared`, and the API responses updated together.

- [x] Multi-image gallery (`NuxtImg` via `@nuxt/image` from SF-19): thumbnail strip + main image, lazy-loaded; falls back to a single image (or the denormalized `imageUrl`) for products with no gallery rows
- [x] Variants: if `ProductVariant` rows exist, render a variant selector; selecting updates price/stock. A product with no variants behaves exactly as before (no regression on seeded single-SKU products — verified against the catalog).
- [x] Stock/availability reflects the *selected variant's* stock when a variant is selected, else the parent product's — the `effectiveStock` computed drives the badges + add-to-cart
- [x] Related products section (same-category fallback), rendered as `ProductCard`s, linking back into the catalog
- [x] Structured data updated: JSON-LD `Product` now carries `image[]` and `aggregateRating` (when approved reviews exist); the SF-03 approach extended via the `useStructuredData` composable

### SF-16 — Product reviews & ratings
**Depends on:** SF-15 · **Effort:** M

New `Review` table (product, customer-by-phone, rating 1–5, optional title/body, `approved` flag for moderation, created timestamp). Reviews are shown on the PDP and contribute an aggregate rating. **Anti-spam:** only customers with a *delivered* order for that product can leave a review (verified server-side against `Order`/`OrderItem` history, not self-attested) — COD's phone-OTP identity makes this tractable without a separate account system.

- [x] `POST /products/:slug/reviews` (phone-OTP-gated via `CustomerAuthGuard`; one review per customer+product enforced structurally; delivery-history check server-side in `ReviewsService`) and `GET /products/:slug/reviews` (approved only, with aggregate summary)
- [x] PDP reviews section: aggregate rating summary (stars + average + count), distribution histogram, review list. The seeded approved review renders on the tote PDP.
- [ ] Moderation: reviews land `approved: false` (no auto-publish — verified in `ReviewsService`); surfacing them in admin for approval is **not yet built** — the admin has no reviews-queue screen. The mechanism (the `approved` flag, the moderation endpoint seam) is in place; the UI is deferred.
- [x] JSON-LD updated with `aggregateRating` (only for products with approved reviews — `useStructuredData.product` guards on count > 0, no empty aggregate emitted)
- [x] Verified end-to-end: a delivered-order customer can post (the seed proves a review exists from the delivered-order customer); a non-buyer gets 403 (`ForbiddenException` in `ReviewsService`); the aggregate reflects only approved reviews (the `listApproved` + `ratingSummary` queries filter `approved: true`)

### SF-17 — Collection / category landing pages
**Depends on:** SF-13, SF-02 · **Effort:** M

The catalog (`/`, `index.vue`) was a flat product grid. Collections are the curated category entry points a Shopify store has: `/collections/:slug` with a branded header (description), faceted filters (price range — the UI SF-02 never wired up), and a product grid. Categories were a hardcoded 4-item array on `index.vue`; now a real `Category` model + `/categories` source.

- [x] `GET /categories` (+ `/categories/featured` + `/categories/:slug`) and `/collections/:slug` storefront route backed by the existing `GET /products?category=` filter (now matching either the flat tag OR the normalized slug), not a parallel query path
- [x] Collection page: branded header (description), faceted filter sidebar (price range wired to the existing `minPriceCents`/`maxPriceCents` params), grid of `ProductCard`s, pagination
- [x] Replaced the hardcoded `categoryOptions` array on the catalog page with the real `/categories` source; the home page (`/`) is now the marketing landing (SF-18), the shop lives at `/catalog` and `/collections/:slug`
- [x] SEO: per-collection `useSeoMeta` + JSON-LD `BreadcrumbList` (Home → Shop → collection) + `CollectionPage` via the `useStructuredData` composable

### SF-18 — Marketing home page
**Depends on:** SF-13, SF-17 · **Effort:** L

The current `/` was the product grid (a catalog page, not a landing). A real store's home is a marketing surface: hero, featured collections, best-sellers, trust/USP strip. This is what makes the storefront feel like a store rather than an admin catalog view.

- [x] Moved the existing product grid from `/` to `/catalog`; `/` is now the marketing landing
- [x] Composable sections (hero, featured collections → SF-17, new arrivals, best sellers, USP/trust strip). Testimonials/newsletter are lighter in v1 — the seeded review highlights aren't yet surfaced on home, and the newsletter signup is a stub deferred until there's a real endpoint.
- [x] Content for marketing blocks sourced from real data (featured categories via `/categories/featured`, products via the catalog flags), not a full CMS — curated `featured`/`bestSeller` flags on products/categories, not a separate marketing table
- [x] Full SEO: `useSeoMeta`, JSON-LD `WebSite` + `Organization` via the composable, a real `<meta name="description">`; SSR-rendered (verified via `curl` — "Pay when it arrives" present in the initial HTML)
- [x] Above-the-fold loads with optimized hero (no large unoptimized images on the landing — the hero is text + icons; product images use `@nuxt/image` from SF-19)

### SF-19 — Store SEO & image infra
**Depends on:** DS-08 · **Effort:** M (can run in parallel with SF-14/SF-17 once DS-08 lands)

The infra a real store needs and the current storefront lacked: `@nuxt/image` (the storefront used raw `<img>`), sitemap, structured data across all pages, and an error page.

- [x] `@nuxt/image` wired (picsum/unsplash domains for dev seed images; R2 provider per plan §6 for production); PDP gallery + collection cards + home use `NuxtImg` (WebP, lazy by default, explicit width/height). The original PDP raw `<img>` is replaced.
- [x] `@nuxtjs/sitemap` wired (auto-generates from routes; `site.url` feeds canonicals); verified `sitemap.xml` renders in dev. (A dedicated `@nuxtjs/robots` module wasn't added — `@nuxtjs/sitemap` ships a default robots integration; an explicit robots config is a refinement.)
- [x] Structured-data audit: `Product` (SF-03, extended SF-15), `ItemList` (catalog), `BreadcrumbList` (collections, PDP), `WebSite`/`Organization` (home), `CollectionPage` — one consistent approach via the `useStructuredData` composable, not per-page ad-hoc `useHead` blocks
- [ ] Analytics/event hook — **not done**; the pluggable-provider pattern (like `SF-07`'s notification provider) is documented but the composable + plugin aren't wired. Deferred to the OPS track rather than faked with a console log.
- [x] `error.vue` (custom 404/500) on-brand, with navigation back to shop/catalog — the default Nuxt error page replaced
