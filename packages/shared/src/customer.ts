import { z } from 'zod'
import { PhoneSchema } from './phone'

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
  // E.164 (normalized via PhoneSchema) — the phone number is the primary
  // identity (order lookup, review eligibility), not an optional contact
  // field.
  phone: PhoneSchema,
  name: z.string().min(1).max(200).optional()
})
export type Customer = z.infer<typeof CustomerSchema>
