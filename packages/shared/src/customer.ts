import { z } from 'zod'

export const AddressSchema = z.object({
  id: z.uuid().optional(),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  region: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  // ISO 3166-1 alpha-2 (e.g. "US", "MA") — not full country names, so it
  // sorts/matches consistently across the storefront, admin, and courier
  // adapter payloads.
  country: z.string().length(2)
})
export type Address = z.infer<typeof AddressSchema>

export const CustomerSchema = z.object({
  id: z.uuid().optional(),
  // E.164 — the phone number is the primary identity for OTP-based auth
  // (plan §7, §11), not an optional contact field.
  phone: z.e164(),
  name: z.string().min(1).max(200).optional()
})
export type Customer = z.infer<typeof CustomerSchema>
