import { z } from 'zod'
import { PhoneSchema } from './phone'

// Per-funnel protection: every anti-spam / fake-order knob of one funnel. The admin edits it in the
// funnel's Protection tab, the API enforces it in FunnelsPublicService.placeOrder (and RiskService for
// the risk-related part). Every field has a default, so `FunnelProtectionSchema.parse({})` is the
// behaviour a funnel gets before anyone touches the tab, and an old funnel (no stored settings) works.
// For numbers, 0 means "off" unless stated otherwise.

export const FunnelFakeActionSchema = z.enum(['ignore', 'warn', 'block'])
export type FunnelFakeAction = z.infer<typeof FunnelFakeActionSchema>

const strList = (max: number) => z.array(z.string().trim().min(1).max(64)).max(max)

export const FunnelProtectionSchema = z.object({
  // ---- bots / spam ----
  bots: z
    .object({
      // Hidden form field: a human never fills it, a form-filling bot does. Such an order is dropped silently.
      honeypot: z.boolean().default(true),
      // Orders submitted sooner than this after the form rendered are refused (0 = off). A request that
      // omits the timestamp is refused too when this is on.
      minFillSeconds: z.number().int().min(0).max(60).default(3),
      // Only a visitor who really opened the funnel page (a page view with the same visitor id) can order.
      requireVisit: z.boolean().default(false),
      // curl / python-requests / headless browsers / crawlers, and requests with no User-Agent at all.
      blockBotUserAgents: z.boolean().default(true),
      // Cloudflare Turnstile. The secret key is write-only: the API never returns it (`secretSet` says if one is saved).
      captcha: z
        .object({
          enabled: z.boolean().default(false),
          siteKey: z.string().trim().max(100).default(''),
          secretKey: z.string().trim().max(200).default(''),
          secretSet: z.boolean().default(false)
        })
        .prefault({})
    })
    .prefault({}),

  // ---- limits ----
  limits: z
    .object({
      // At most N orders per phone number within H hours.
      phoneMax: z.number().int().min(0).max(100).default(0),
      phoneHours: z.number().int().min(1).max(720).default(24),
      // At most N orders per IP address within H hours.
      ipMax: z.number().int().min(0).max(1000).default(0),
      ipHours: z.number().int().min(1).max(720).default(1),
      // At most N orders per visitor (browser id) within H hours.
      visitorMax: z.number().int().min(0).max(100).default(0),
      visitorHours: z.number().int().min(1).max(720).default(24),
      // Minimum wait between two orders from the same phone / IP / visitor.
      cooldownMinutes: z.number().int().min(0).max(1440).default(0),
      // Same phone ordering this funnel's product again within H hours is refused (0 = only flagged for review).
      duplicateBlockHours: z.number().int().min(0).max(720).default(0)
    })
    .prefault({}),

  // ---- phone ----
  phone: z
    .object({
      // Only Algerian mobile numbers (05 / 06 / 07 …).
      algerianOnly: z.boolean().default(true),
      // 0555555555, 0666666666, 0612121212 …
      rejectRepeated: z.boolean().default(true),
      // The customer must type a code sent to the phone before the order is accepted.
      otp: z.boolean().default(false)
    })
    .prefault({}),

  // ---- fake orders ----
  risk: z
    .object({
      // Refuse (Block) / flag (Warn) phones and addresses on the shared blacklist.
      useBlacklist: z.boolean().default(true),
      // Returned orders that put a phone on the blacklist automatically at its next order (0 = never).
      autoWarnReturns: z.number().int().min(0).max(20).default(2),
      autoBlockReturns: z.number().int().min(0).max(20).default(3),
      // Placeholder names ("test", "qsdfgh", only digits …) and addresses.
      fakeNameAction: FunnelFakeActionSchema.default('warn'),
      fakeAddressAction: FunnelFakeActionSchema.default('warn'),
      // Risk score from which an order is Medium / High (shown to the call center).
      mediumFrom: z.number().int().min(1).max(99).default(30),
      highFrom: z.number().int().min(1).max(100).default(60),
      // Orders scoring at least this are refused (0 = never refuse, only flag).
      blockAtScore: z.number().int().min(0).max(100).default(0),
      // Text shown to a refused customer ('' = the standard message).
      blockedMessage: z.string().trim().max(200).default('')
    })
    .prefault({}),

  // ---- network ----
  network: z
    .object({
      // Only visitors in Algeria (needs the CDN's country header, e.g. Cloudflare's CF-IPCountry; without it nobody is refused).
      algeriaOnly: z.boolean().default(false),
      // Tor exit nodes and requests that go through an open proxy (Via / Forwarded-through headers).
      blockProxies: z.boolean().default(false),
      // IPv4 addresses or CIDR ranges (e.g. 41.200.1.5, 41.200.0.0/16).
      blockedIps: strList(200).default([])
    })
    .prefault({}),

  // ---- whitelist: never restricted by any rule above ----
  whitelist: z
    .object({
      phones: strList(100).default([]),
      ips: strList(100).default([])
    })
    .prefault({})
})
export type FunnelProtection = z.infer<typeof FunnelProtectionSchema>

export function defaultFunnelProtection(): FunnelProtection {
  return FunnelProtectionSchema.parse({})
}

// Turnstile only counts once both keys are saved (a half-filled setup must never lock customers out).
export function isCaptchaActive(p: FunnelProtection): boolean {
  const c = p.bots.captcha
  return c.enabled && !!c.siteKey && (!!c.secretKey || c.secretSet)
}

// Stored value → settings (a missing / unreadable value falls back to the defaults).
export function parseFunnelProtection(raw: unknown): FunnelProtection {
  const parsed = FunnelProtectionSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : defaultFunnelProtection()
}

// ---- Why an order attempt was refused ----
export const FUNNEL_BLOCK_REASONS = {
  Honeypot: 'Honeypot field filled',
  TooFast: 'Form submitted too fast',
  NoVisit: 'No real page visit',
  BotAgent: 'Bot / script User-Agent',
  Captcha: 'Captcha failed',
  InvalidPhone: 'Invalid phone number',
  RepeatedPhone: 'Repeated-digit phone number',
  Otp: 'Phone not verified',
  PhoneLimit: 'Too many orders from this phone',
  IpLimit: 'Too many orders from this IP',
  VisitorLimit: 'Too many orders from this visitor',
  Cooldown: 'Ordered again too soon',
  Duplicate: 'Duplicate order',
  Country: 'Outside Algeria',
  Proxy: 'Proxy / Tor',
  IpBlocked: 'IP blocked',
  Blacklist: 'Blacklisted phone / address',
  FakeName: 'Fake-looking name',
  FakeAddress: 'Fake-looking address',
  HighRisk: 'Risk score too high'
} as const
export type FunnelBlockReason = keyof typeof FUNNEL_BLOCK_REASONS

export interface FunnelBlockedAttemptView {
  id: string
  reason: FunnelBlockReason
  phone: string | null
  ip: string | null
  userAgent: string | null
  detail: string | null
  createdAt: string
}

export interface FunnelBlockedAttemptList {
  items: FunnelBlockedAttemptView[]
  total: number
  page: number
  pageSize: number
  // Last 30 days, most frequent first.
  summary: { reason: FunnelBlockReason; count: number }[]
}

// ---- Phone verification (OTP) on the public funnel API ----
export const FunnelOtpSendSchema = z.object({ phone: PhoneSchema })
export type FunnelOtpSend = z.infer<typeof FunnelOtpSendSchema>

export const FunnelOtpVerifySchema = z.object({ phone: PhoneSchema, code: z.string().trim().regex(/^\d{4,8}$/) })
export type FunnelOtpVerify = z.infer<typeof FunnelOtpVerifySchema>

// ---- Pure checks shared by the API and its tests ----

const ALGERIAN_MOBILE = /^\+213[567]\d{8}$/

export function isAlgerianMobile(e164: string): boolean {
  return ALGERIAN_MOBILE.test(e164)
}

// 0555555555, 0666666666 (7+ equal digits in a row) or a number made of just two different digits (0612121212).
export function isRepeatedDigitPhone(e164: string): boolean {
  const national = e164.replace(/^\+213/, '')
  if (!/^\d+$/.test(national)) return false
  if (/(\d)\1{6,}/.test(national)) return true
  return new Set(national.slice(1)).size <= 2
}

// Tiny IPv4 matcher: exact address or CIDR. Anything else (IPv6, garbage) only matches itself, exactly.
function ipv4ToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (!m) return null
  const parts = m.slice(1).map(Number)
  if (parts.some((p) => p > 255)) return null
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0
}

export function ipMatches(ip: string, rule: string): boolean {
  const cleanIp = ip.replace(/^::ffff:/, '').trim()
  const cleanRule = rule.trim()
  if (!cleanIp || !cleanRule) return false
  const slash = cleanRule.indexOf('/')
  if (slash === -1) return cleanIp === cleanRule
  const base = ipv4ToInt(cleanRule.slice(0, slash))
  const bits = Number(cleanRule.slice(slash + 1))
  const value = ipv4ToInt(cleanIp)
  if (base === null || value === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false
  if (bits === 0) return true
  const mask = (0xffffffff << (32 - bits)) >>> 0
  return (value & mask) === (base & mask)
}

export function ipInList(ip: string | undefined, list: string[]): boolean {
  return !!ip && list.some((rule) => ipMatches(ip, rule))
}

// Crawlers, command-line clients, HTTP libraries and automation. An empty User-Agent counts as a bot too.
const BOT_UA = /(?:^|[\s/;(])bot\b|[a-z]bot\/|crawl|spider|slurp|headless|phantomjs|selenium|puppeteer|playwright|webdriver|curl\/|wget|python-requests|python-urllib|aiohttp|httpx|go-http-client|okhttp\/\d|java\/|libwww|axios|node-fetch|undici|postman|insomnia|scrapy|httpclient/i
export function isBotUserAgent(ua: string | undefined | null): boolean {
  const s = (ua ?? '').trim()
  return s.length < 10 || BOT_UA.test(s)
}
