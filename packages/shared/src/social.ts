import { z } from 'zod'

// Social publishing: the store's own Facebook Pages / Instagram business
// accounts are linked once (Apps → Social pages) and any product can then be
// posted to them from the product editor's Social tab. Page tokens never leave
// the API (stored encrypted).

export const SOCIAL_PLATFORMS = ['Facebook', 'Instagram'] as const
export const SocialPlatformSchema = z.enum(SOCIAL_PLATFORMS)
export type SocialPlatform = z.infer<typeof SocialPlatformSchema>

// What the pasted token needs to be able to do.
export const SOCIAL_REQUIRED_SCOPES = ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'] as const
export const SOCIAL_INSTAGRAM_SCOPES = ['instagram_basic', 'instagram_content_publish'] as const

export const ConnectSocialSchema = z.object({
  accessToken: z.string().trim().min(20).max(1000)
})
export type ConnectSocial = z.infer<typeof ConnectSocialSchema>

export const PublishProductSocialSchema = z.object({
  accountIds: z.array(z.string().min(1).max(100)).min(1).max(20),
  // Caption override; empty = the generated caption.
  message: z.string().trim().max(2200).optional()
})
export type PublishProductSocial = z.infer<typeof PublishProductSocialSchema>

export const SocialCaptionQuerySchema = z.object({
  language: z.enum(['ar', 'fr']).default('ar')
})
export type SocialCaptionQuery = z.infer<typeof SocialCaptionQuerySchema>

export interface SocialAccountView {
  id: string
  platform: SocialPlatform
  name: string
  // Instagram @username when known.
  handle: string | null
  status: 'Active' | 'Expired'
  connectedAt: string
}

export interface SocialStatus {
  accounts: SocialAccountView[]
  // Permissions Meta says the token is missing for publishing (empty = fine).
  missingScopes: string[]
}

export interface SocialPostView {
  id: string
  accountId: string
  platform: SocialPlatform
  accountName: string
  status: 'Published' | 'Failed'
  externalUrl: string | null
  error: string | null
  createdAt: string
}

export interface SocialPublishResult {
  posts: SocialPostView[]
}

export interface SocialCaption {
  message: string
  link: string
  hasImage: boolean
}
