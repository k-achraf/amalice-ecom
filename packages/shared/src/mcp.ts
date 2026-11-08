import { z } from 'zod'

// AI-agent access tokens (MCP). A token carries a list of abilities
// `<section>:<level>`; the API (JwtAuthGuard's token strategy) checks every
// request against them, so what a token can do is decided here and nowhere
// else — the MCP server and the admin UI only read this catalog.

export const MCP_LEVELS = ['read', 'write', 'delete'] as const
export type McpLevel = (typeof MCP_LEVELS)[number]

export const MCP_LEVEL_LABELS: Record<McpLevel, string> = {
  read: 'View',
  write: 'Create & edit',
  delete: 'Delete'
}

export interface McpSection {
  id: string
  label: string
  description: string
  // First path segment(s) after /admin/ that belong to this section.
  segments: readonly string[]
  // Granting this lets a token gain more power (accounts, secrets, money).
  sensitive?: boolean
}

export const MCP_SECTIONS = [
  { id: 'orders', label: 'Orders', description: 'Order list and details, status changes, notes, items, prices, deliveries', segments: ['orders', 'deliveries'] },
  { id: 'call_center', label: 'Call center', description: 'Call queues, claiming, call logs, agent reports', segments: ['call-center'] },
  { id: 'customers', label: 'Customers & blacklist', description: 'Customers and the phone/address blacklist', segments: ['customers', 'blacklist'] },
  { id: 'products', label: 'Products & media', description: 'Products, variants, images, offers, upsells, attributes, file uploads', segments: ['products', 'attributes', 'upload', 'upload-from-url'] },
  { id: 'inventory', label: 'Inventory & suppliers', description: 'Stock counts, movements, suppliers', segments: ['inventory', 'suppliers'] },
  { id: 'shipping', label: 'Shipping & fulfillment', description: 'Dispatch, tracking, couriers, tariffs, shipping rates', segments: ['fulfillment', 'shipping', 'shipping-companies'] },
  { id: 'funnels', label: 'Funnels', description: 'Funnel pages, steps, session recordings', segments: ['funnels'] },
  { id: 'landing_pages', label: 'Landing pages', description: 'Product landing pages', segments: ['landing-pages'] },
  { id: 'analytics', label: 'Analytics & stats', description: 'Dashboard, traffic, visitors', segments: ['analytics', 'stats'] },
  { id: 'reconciliation', label: 'Cash reconciliation', description: 'COD cash collection and settlements', segments: ['reconciliation'], sensitive: true },
  { id: 'pos', label: 'Point of sale', description: 'In-person sales', segments: ['pos'] },
  { id: 'sourcing', label: 'Sourcing', description: 'Product research and sourcing tracker', segments: ['sourcing'] },
  { id: 'social', label: 'Social publishing', description: 'Social accounts and posts', segments: ['social'] },
  { id: 'meta_ads', label: 'Meta ads', description: 'Ad accounts, campaigns, insights', segments: ['meta-ads'], sensitive: true },
  { id: 'integrations', label: 'Integrations', description: 'Pixels, Google Sheets and other connected apps', segments: ['apps', 'pixels', 'google-sheets'], sensitive: true },
  { id: 'reports', label: 'Reports & alerts', description: 'Telegram reports and alert settings', segments: ['reports'] },
  { id: 'ai', label: 'AI settings & assistant', description: 'AI providers/keys, models, business assistant', segments: ['ai'], sensitive: true },
  { id: 'settings', label: 'Store settings', description: 'Storefront, brand and store configuration', segments: ['settings'], sensitive: true },
  { id: 'users', label: 'Team & roles', description: 'Admin accounts and roles (can grant itself more power)', segments: ['users', 'roles'], sensitive: true },
  { id: 'audit', label: 'Audit log', description: 'Who changed what', segments: ['audit'] },
  { id: 'system', label: 'Server performance', description: 'CPU, memory and process health', segments: ['server-performance'] }
] as const satisfies readonly McpSection[]

export type McpSectionId = (typeof MCP_SECTIONS)[number]['id']
export type McpAbility = `${McpSectionId}:${McpLevel}`

export const ALL_MCP_ABILITIES: readonly McpAbility[] = MCP_SECTIONS.flatMap((s) => MCP_LEVELS.map((l) => `${s.id}:${l}` as McpAbility))

const SECTION_BY_SEGMENT = new Map<string, McpSectionId>(MCP_SECTIONS.flatMap((s) => s.segments.map((seg) => [seg, s.id] as const)))

export const McpAbilitySchema = z.enum(ALL_MCP_ABILITIES as unknown as [McpAbility, ...McpAbility[]])

export const CreateMcpTokenSchema = z.object({
  name: z.string().trim().min(1).max(80),
  abilities: z.array(McpAbilitySchema).min(1),
  // null / absent = never expires.
  expiresAt: z.string().datetime().nullish()
})
export type CreateMcpToken = z.infer<typeof CreateMcpTokenSchema>

export const UpdateMcpTokenSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  abilities: z.array(McpAbilitySchema).min(1).optional(),
  expiresAt: z.string().datetime().nullish()
})
export type UpdateMcpToken = z.infer<typeof UpdateMcpTokenSchema>

export interface McpTokenSummary {
  id: string
  name: string
  // First characters of the token, to tell tokens apart. The full token is shown once, at creation.
  prefix: string
  abilities: McpAbility[]
  createdByEmail: string | null
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
  revokedAt: string | null
}

export interface CreatedMcpToken extends McpTokenSummary {
  token: string
}

// What a token can ask about itself (GET /mcp/self).
export interface McpSelf {
  name: string
  abilities: McpAbility[]
}

export const MCP_TOKEN_PREFIX = 'amk_'

export function mcpLevelOfMethod(method: string): McpLevel | null {
  switch (method.toUpperCase()) {
    case 'GET':
    case 'HEAD':
      return 'read'
    case 'POST':
    case 'PUT':
    case 'PATCH':
      return 'write'
    case 'DELETE':
      return 'delete'
    default:
      return null
  }
}

// Express routes are case-insensitive, so compare lower-cased. Anything that
// could be read two ways (escapes, dot segments, backslashes, doubled slashes)
// is refused rather than guessed at — real admin routes never need them.
export function normalizeMcpPath(rawUrl: string): string | null {
  const path = rawUrl.split('?')[0]?.split('#')[0] ?? ''
  if (!path.startsWith('/')) return null
  if (/[%\\;]|\/\/|\/\.{1,2}(\/|$)/.test(path)) return null
  return path.toLowerCase().replace(/\/+$/, '') || '/'
}

export type McpAuthorization = { ok: true; ability: McpAbility | null } | { ok: false; reason: string }

export function authorizeMcpRequest(abilities: readonly string[], method: string, rawUrl: string): McpAuthorization {
  const path = normalizeMcpPath(rawUrl)
  if (!path) return { ok: false, reason: 'Malformed path' }
  // A token may always ask what it is allowed to do.
  if (path === '/mcp/self' && mcpLevelOfMethod(method) === 'read') return { ok: true, ability: null }
  if (path === '/mcp/endpoints' && mcpLevelOfMethod(method) === 'read') return { ok: true, ability: null }

  const [root, segment] = path.split('/').filter(Boolean)
  // Only the admin API is reachable. Auth, token management (/admin/mcp-tokens) and anything
  // not listed in a section stay closed by default.
  if (root !== 'admin' || !segment) return { ok: false, reason: 'This token can only call /admin/* endpoints' }
  const section = SECTION_BY_SEGMENT.get(segment)
  if (!section) return { ok: false, reason: `No ability covers /admin/${segment}` }
  const level = mcpLevelOfMethod(method)
  if (!level) return { ok: false, reason: `Method ${method} is not allowed` }
  const ability = `${section}:${level}` as McpAbility
  if (!abilities.includes(ability)) return { ok: false, reason: `Token lacks the "${ability}" ability` }
  return { ok: true, ability }
}

// Which section/level covers a path+method, ignoring a token's grants (used to filter endpoint lists).
export function mcpAbilityOf(method: string, rawUrl: string): McpAbility | null {
  const path = normalizeMcpPath(rawUrl)
  const level = mcpLevelOfMethod(method)
  if (!path || !level) return null
  const [root, segment] = path.split('/').filter(Boolean)
  if (root !== 'admin' || !segment) return null
  const section = SECTION_BY_SEGMENT.get(segment)
  return section ? (`${section}:${level}` as McpAbility) : null
}
