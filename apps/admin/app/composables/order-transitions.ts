// ADM-05 — re-exported from @amalice/shared, which is now the single source
// of truth for the order lifecycle state machine (previously hand-duplicated
// here and in the API's own copy — see packages/shared/src/order.ts for why
// that drift risk was removed). Kept as a thin re-export so existing
// `~/composables/order-transitions` imports across the admin app don't all
// need to change to `@amalice/shared` directly.
export { VALID_TRANSITIONS, isValidTransition } from '@amalice/shared'
