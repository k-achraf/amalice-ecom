# packages/shared

Zod schemas + derived TS types — the single source of truth for any shape crossing the `apps/api` ↔ `apps/admin`/`apps/storefront` boundary. Built with `unbuild`, consumed as `@amalice/shared` (workspace dependency) by every other package.

## Structure

One file per domain in `src/`, all re-exported from `src/index.ts`: `order`, `product`, `customer`, `shipment`, `auth`, `catalog`, `reconciliation`, `store-settings`, `location` (Wilaya/Commune), `apps` (integration registry), `landing-page`, `offer`, `shipping`, `shipping-company`, `upsell`, `google-sheets`, `sourcing`, `server-performance`, `funnel` (funnel/step schemas + the static `FUNNEL_TEMPLATES` catalog — add a template there and its id to `FUNNEL_TEMPLATE_IDS`), `funnel-landing` (landing-page settings of a funnel's Landing step + the static `LANDING_TEMPLATES` catalog — add one there and its id to `LANDING_TEMPLATE_IDS`; the admin preview and the future storefront renderer both key off its `layout`).

## Conventions

- **Define the shape here first**, then thread it through `apps/api` (validated via `nestjs-zod` at the controller boundary) and whichever Nuxt app(s) consume it. Don't redeclare the same shape as a local interface/DTO in a controller or component — that's exactly the drift this package exists to prevent.
- Export both the Zod schema and its inferred type (`z.infer<typeof XSchema>`) — API code validates with the schema, frontend code types with the inferred type.
- A schema change here is a contract change across three apps — after editing, typecheck all three (`pnpm typecheck` at the root) before considering the change done, not just the app you were originally working in.
- Keep domain files independent where possible; cross-references (e.g. `order.ts` referencing a product id) should stay as primitive ids, not nested imports of another domain's full schema, unless the API genuinely nests that data in its response.

## Dev

```bash
pnpm --filter @amalice/shared build       # unbuild — required after schema changes before other apps see them in a stale dist
pnpm --filter @amalice/shared typecheck
```

If you edit a schema and a consuming app's typecheck doesn't pick up the change, rebuild this package first — the consumers import from `dist/`, not `src/`, directly.
