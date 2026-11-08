import { z } from 'zod'

// Named tracking pixels managed in Apps → Pixels. A store can hold any number of Meta and TikTok pixels;
// each funnel picks which ones it fires (by id) instead of typing a pixel id by hand.
export const PIXEL_PLATFORMS = ['Meta', 'TikTok'] as const
export const PixelPlatformSchema = z.enum(PIXEL_PLATFORMS)
export type PixelPlatform = z.infer<typeof PixelPlatformSchema>

// Meta pixel ids are numeric; TikTok pixel codes are alphanumeric.
export const META_PIXEL_ID_RE = /^\d{5,20}$/
export const TIKTOK_PIXEL_CODE_RE = /^[A-Za-z0-9]{6,40}$/

export function isValidPixelCode(platform: PixelPlatform, code: string): boolean {
  return (platform === 'Meta' ? META_PIXEL_ID_RE : TIKTOK_PIXEL_CODE_RE).test(code)
}

const NameSchema = z.string().trim().min(1, 'Give the pixel a name').max(80)
const TestCodeSchema = z.union([z.string().trim().max(60), z.null()]).optional().transform((v) => (v ? v : null))

// What the admin sees: the access token is write-only (only `hasAccessToken` comes back).
export const PixelViewSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  platform: PixelPlatformSchema,
  pixelId: z.string(),
  serverEventsEnabled: z.boolean(),
  hasAccessToken: z.boolean(),
  testEventCode: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
})
export type PixelView = z.infer<typeof PixelViewSchema>

export const CreatePixelSchema = z
  .object({
    name: NameSchema,
    platform: PixelPlatformSchema,
    pixelId: z.string().trim().min(1),
    serverEventsEnabled: z.boolean().default(false),
    // Conversions API (Meta) / Events API (TikTok) token.
    accessToken: z.string().trim().min(1).nullable().optional(),
    testEventCode: TestCodeSchema
  })
  .superRefine((v, ctx) => {
    if (!isValidPixelCode(v.platform, v.pixelId)) {
      ctx.addIssue({ code: 'custom', path: ['pixelId'], message: v.platform === 'Meta' ? 'Meta pixel id is 5-20 digits' : 'TikTok pixel code is 6-40 letters/digits' })
    }
  })
export type CreatePixel = z.infer<typeof CreatePixelSchema>

// The platform can't change after creation (a Meta id is not a TikTok code). Omitted accessToken = keep, null = remove.
export const UpdatePixelSchema = z.object({
  name: NameSchema.optional(),
  pixelId: z.string().trim().min(1).optional(),
  serverEventsEnabled: z.boolean().optional(),
  accessToken: z.string().trim().min(1).nullable().optional(),
  testEventCode: TestCodeSchema
})
export type UpdatePixel = z.infer<typeof UpdatePixelSchema>

export const SendPixelTestEventSchema = z.object({ eventName: z.string().trim().min(1).max(40) })
export type SendPixelTestEvent = z.infer<typeof SendPixelTestEventSchema>
