import { z } from 'zod'

// Every phone field crossing the API boundary used to be plain `z.e164()` —
// which VALIDATES E.164 ("+213674756914") but REJECTS anything else,
// including the raw local Algerian format ("0674756914") that both the
// checkout/lead-form <input type="tel"> fields and the abandoned-cart
// capture actually collect from customers. That mismatch was the root
// cause of two related bugs: (1) `/orders/:id/upsell?phone=0674756914`
// 400ing (TrackOrderQuerySchema's z.e164() rejecting the raw phone the
// storefront had stored and was echoing back), and (2) orders getting
// inserted twice — OrdersService.createLeadOrder only updates an existing
// abandoned-cart row in place if `abandonedOrder.customer.phone === phone`
// (exact string equality); without normalization, any difference in how
// the same number was typed/stored between the abandoned capture and the
// final submit silently fails that match and creates a second order+
// customer instead of converting the first.
//
// normalizeAlgerianPhone converts common local/international variants to a
// single canonical E.164 form so both problems disappear: every phone field
// (checkout, lead-form, track/upsell/history queries) should use PhoneSchema
// below instead of z.e164() directly, so whatever format a customer typed
// gets canonicalized identically on every read and write.
export function normalizeAlgerianPhone(raw: string): string {
  const digits = raw.trim().replace(/[\s().-]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  if (digits.startsWith('0')) return `+213${digits.slice(1)}`
  if (digits.startsWith('213')) return `+${digits}`
  return `+${digits}`
}

// Transforms THEN validates as E.164 — an unrecognizable input still fails
// with a clear validation error rather than silently passing through bad
// data.
export const PhoneSchema = z.string().transform(normalizeAlgerianPhone).pipe(z.e164())

// Display-only counterpart to normalizeAlgerianPhone — customers land in the
// system via checkout, the lead form, and abandoned-cart capture, each of
// which may have received the number as "+213666666666", "213666666666",
// "0666666666", or a bare "666666666" (missing the leading 0 entirely).
// Storage stays canonical E.164 (see normalizeAlgerianPhone above); this is
// what the admin call-center views (Call Center queue, Drop Queue) format
// with instead, so every agent sees the exact same "0xxxxxxxxx" local shape
// regardless of how the number originally arrived. Never validates/throws —
// an unrecognized shape is returned with a best-effort leading 0 rather than
// blocking the page over a display nicety.
export function formatPhoneLocal(raw: string): string {
  if (!raw) return raw
  let digits = raw.trim().replace(/[\s().-]/g, '')
  if (digits.startsWith('+213')) digits = digits.slice(4)
  else if (digits.startsWith('00213')) digits = digits.slice(5)
  else if (digits.startsWith('213') && digits.length > 9) digits = digits.slice(3)
  else if (digits.startsWith('+')) digits = digits.slice(1)
  else if (digits.startsWith('0')) digits = digits.slice(1)
  return `0${digits}`
}
