import { BadRequestException, ForbiddenException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import type { IncomingHttpHeaders } from 'node:http'
import {
  FUNNEL_BLOCK_REASONS,
  isAlgerianMobile,
  isBotUserAgent,
  isCaptchaActive,
  isRepeatedDigitPhone,
  ipInList,
  normalizeAlgerianPhone,
  parseFunnelProtection,
  type FunnelBlockReason,
  type FunnelBlockedAttemptList,
  type FunnelBlockedAttemptView,
  type FunnelOrder,
  type FunnelProtection
} from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import { NotificationsService } from '../notifications/notifications.service'
import { BLOCKED_ORDER_MESSAGE, type RiskPolicy } from '../risk/risk.service'

export interface ProtectionRequest {
  ip?: string
  userAgent?: string
  headers?: IncomingHttpHeaders
}

export interface GuardResult {
  // The honeypot was filled: the caller answers with a fake success and creates nothing.
  silent: boolean
  riskPolicy: RiskPolicy
  phone: string
}

const ATTEMPT_RETENTION_DAYS = 30
const OTP_CODE_TTL = 5 * 60
const OTP_TOKEN_TTL = 15 * 60
const OTP_MAX_TRIES = 5
const HOUR_MS = 60 * 60 * 1000

// What the shopper reads when a rule refuses the order. The funnel's own text (risk.blockedMessage) replaces
// the vague ones; the helpful ones (bad phone, verify the phone, solve the captcha) stay specific.
const MSG = {
  generic: BLOCKED_ORDER_MESSAGE,
  tooFast: 'يرجى أخذ لحظة لمراجعة طلبك قبل إرساله.',
  phone: 'رقم الهاتف غير صالح، يرجى إدخال رقم جزائري صحيح.',
  otp: 'يرجى تأكيد رقم هاتفك بالرمز المرسل إليك قبل إرسال الطلب.',
  captcha: 'تعذر التحقق من أنك لست روبوتاً، أعد المحاولة.',
  tooMany: 'لقد تجاوزت عدد الطلبات المسموح به، يرجى المحاولة لاحقاً.',
  cooldown: 'لقد أرسلت طلباً قبل قليل، يرجى الانتظار قبل إرسال طلب جديد.',
  duplicate: 'لقد قمت بطلب هذا المنتج مسبقاً، سيتصل بك فريقنا قريباً.'
}

const headerOf = (headers: IncomingHttpHeaders | undefined, name: string): string | undefined => {
  const v = headers?.[name]
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined
}

// Enforces a funnel's Protection settings on a public order, keeps the OTP flow and the log of refused
// attempts. Everything here is a no-op for a funnel that never touched its settings, beyond the defaults
// in FunnelProtectionSchema.
@Injectable()
export class FunnelProtectionService {
  private readonly logger = new Logger(FunnelProtectionService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService
  ) {}

  riskPolicyOf(p: FunnelProtection, bypass: boolean): RiskPolicy {
    return { ...p.risk, bypass }
  }

  // ---- the order guard ------------------------------------------------------

  async guard(funnel: { id: string; protection: unknown }, input: FunnelOrder, req: ProtectionRequest): Promise<GuardResult> {
    const p = parseFunnelProtection(funnel.protection)
    const rawPhone = input.fields.phone || input.fields.phoneNumber || ''
    const phone = rawPhone ? normalizeAlgerianPhone(rawPhone) : ''

    const whitelistedPhones = p.whitelist.phones.map(normalizeAlgerianPhone)
    const whitelisted = (!!phone && whitelistedPhones.includes(phone)) || ipInList(req.ip, p.whitelist.ips)
    const riskPolicy = this.riskPolicyOf(p, whitelisted)
    if (whitelisted) return { silent: false, riskPolicy, phone }

    const refuse = async (reason: FunnelBlockReason, message: string, detail?: string): Promise<never> => {
      await this.logBlocked(funnel.id, reason, req, phone, detail)
      throw new ForbiddenException(p.risk.blockedMessage.trim() || message)
    }
    // Helpful messages (bad phone, captcha, OTP) stay as they are even when a custom refusal text is set.
    const refuseExact = async (reason: FunnelBlockReason, message: string, detail?: string): Promise<never> => {
      await this.logBlocked(funnel.id, reason, req, phone, detail)
      throw new BadRequestException(message)
    }

    // Bots
    if (p.bots.honeypot && input.website && input.website.trim()) {
      await this.logBlocked(funnel.id, 'Honeypot', req, phone)
      return { silent: true, riskPolicy, phone }
    }
    if (p.bots.blockBotUserAgents && isBotUserAgent(req.userAgent)) await refuse('BotAgent', MSG.generic, (req.userAgent ?? '').slice(0, 120))

    // Network
    if (p.network.blockedIps.length && ipInList(req.ip, p.network.blockedIps)) await refuse('IpBlocked', MSG.generic)
    const country = (headerOf(req.headers, 'cf-ipcountry') ?? headerOf(req.headers, 'cloudfront-viewer-country') ?? headerOf(req.headers, 'x-vercel-ip-country') ?? '').toUpperCase()
    if (p.network.blockProxies && (country === 'T1' || headerOf(req.headers, 'proxy-connection'))) await refuse('Proxy', MSG.generic, country === 'T1' ? 'Tor' : 'Proxy header')
    // 'XX' = the CDN could not tell; never refuse on a missing answer.
    if (p.network.algeriaOnly && country && country !== 'XX' && country !== 'DZ') await refuse('Country', MSG.generic, country)

    // A retry of an order that already went through (network error → same idempotency key) must not trip the rules below.
    const replay = await this.isReplay(input.idempotencyKey)

    // Pace: the form must have been open for a few seconds.
    if (p.bots.minFillSeconds > 0 && !replay) {
      const elapsed = input.formLoadedAt == null ? -1 : Date.now() - input.formLoadedAt
      if (input.formLoadedAt == null || (elapsed >= 0 && elapsed < p.bots.minFillSeconds * 1000)) {
        await this.logBlocked(funnel.id, 'TooFast', req, phone, input.formLoadedAt == null ? 'No timestamp' : `${Math.round(elapsed / 100) / 10}s`)
        throw new BadRequestException(MSG.tooFast)
      }
    }

    const visitorId = input.tracking?.attribution?.visitorId?.trim() || undefined
    if (p.bots.requireVisit && !replay) {
      const seen = visitorId ? await this.prisma.pageViewEvent.count({ where: { type: 'Funnel', entityId: funnel.id, visitorId } }) : 0
      if (!seen) await refuse('NoVisit', MSG.generic)
    }

    if (isCaptchaActive(p) && !replay) {
      const ok = await this.verifyTurnstile(p.bots.captcha.secretKey, input.captchaToken, req.ip)
      if (!ok) await refuseExact('Captcha', MSG.captcha)
    }

    // Phone
    if (phone) {
      if (p.phone.algerianOnly && !isAlgerianMobile(phone)) await refuseExact('InvalidPhone', MSG.phone, phone)
      if (p.phone.rejectRepeated && isRepeatedDigitPhone(phone)) await refuseExact('RepeatedPhone', MSG.phone, phone)
    }
    if (p.phone.otp && !replay) {
      const verified = !!input.otpToken && phone && (await this.redis.get(this.okKey(funnel.id, input.otpToken)).catch(() => null)) === phone
      if (!verified) await refuseExact('Otp', MSG.otp)
    }

    // Limits
    if (!replay && phone) await this.checkLimits(funnel.id, p, phone, req.ip, visitorId, refuse)

    return { silent: false, riskPolicy, phone }
  }

  private async checkLimits(
    funnelId: string,
    p: FunnelProtection,
    phone: string,
    ip: string | undefined,
    visitorId: string | undefined,
    refuse: (reason: FunnelBlockReason, message: string, detail?: string) => Promise<never>
  ): Promise<void> {
    const l = p.limits
    const baseOrder = { funnelId, isAbandoned: false }
    const since = (hours: number) => new Date(Date.now() - hours * HOUR_MS)
    const byPhone = (from: Date) => this.prisma.order.count({ where: { ...baseOrder, createdAt: { gte: from }, customer: { phone } } })
    const byIp = (from: Date) => (ip ? this.prisma.orderAttribution.count({ where: { ipAddress: ip, order: { ...baseOrder, createdAt: { gte: from } } } }) : Promise.resolve(0))
    const byVisitor = (from: Date) => (visitorId ? this.prisma.orderAttribution.count({ where: { visitorId, order: { ...baseOrder, createdAt: { gte: from } } } }) : Promise.resolve(0))

    if (l.phoneMax > 0 && (await byPhone(since(l.phoneHours))) >= l.phoneMax) await refuse('PhoneLimit', MSG.tooMany, `${l.phoneMax} / ${l.phoneHours}h`)
    if (l.ipMax > 0 && (await byIp(since(l.ipHours))) >= l.ipMax) await refuse('IpLimit', MSG.tooMany, `${l.ipMax} / ${l.ipHours}h`)
    if (l.visitorMax > 0 && (await byVisitor(since(l.visitorHours))) >= l.visitorMax) await refuse('VisitorLimit', MSG.tooMany, `${l.visitorMax} / ${l.visitorHours}h`)
    if (l.cooldownMinutes > 0) {
      const from = new Date(Date.now() - l.cooldownMinutes * 60 * 1000)
      const [a, b, c] = await Promise.all([byPhone(from), byIp(from), byVisitor(from)])
      if (a + b + c > 0) await refuse('Cooldown', MSG.cooldown, `${l.cooldownMinutes} min`)
    }
    if (l.duplicateBlockHours > 0 && (await byPhone(since(l.duplicateBlockHours))) > 0) await refuse('Duplicate', MSG.duplicate, `${l.duplicateBlockHours}h`)
  }

  // Order placed: the phone-verification token is single use.
  async consumeOtp(funnelId: string, token: string | undefined): Promise<void> {
    if (token) await this.redis.del(this.okKey(funnelId, token)).catch(() => undefined)
  }

  private async isReplay(key: string | undefined): Promise<boolean> {
    if (!key) return false
    try {
      const v = await this.redis.get(`checkout:idem:${key}`)
      return !!v && v !== 'processing'
    } catch {
      return false
    }
  }

  // Cloudflare Turnstile. A network failure on our side fails open (logged): a Cloudflare outage must not stop every sale.
  private async verifyTurnstile(secret: string, token: string | undefined, ip: string | undefined): Promise<boolean> {
    if (!token) return false
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), 4000)
    try {
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        signal: ctl.signal,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token, ...(ip && { remoteip: ip }) })
      })
      const json = (await res.json()) as { success?: boolean }
      return json.success === true
    } catch (err) {
      this.logger.warn(`Turnstile verification unavailable, letting the order through: ${(err as Error).message}`)
      return true
    } finally {
      clearTimeout(timer)
    }
  }

  // ---- phone verification (OTP) ----------------------------------------------

  private codeKey = (funnelId: string, phone: string) => `fotp:code:${funnelId}:${phone}`
  private okKey = (funnelId: string, token: string) => `fotp:ok:${funnelId}:${token}`

  async sendOtp(funnel: { id: string; protection: unknown }, rawPhone: string, req: ProtectionRequest): Promise<{ ok: true; expiresInSeconds: number }> {
    const p = parseFunnelProtection(funnel.protection)
    if (!p.phone.otp) throw new BadRequestException('Phone verification is not enabled for this funnel')
    const phone = normalizeAlgerianPhone(rawPhone)
    if (!isAlgerianMobile(phone)) throw new BadRequestException(MSG.phone)
    if (p.bots.blockBotUserAgents && isBotUserAgent(req.userAgent)) throw new ForbiddenException(MSG.generic)

    // 3 codes per phone per 10 minutes, 10 per IP per hour.
    const hit = async (key: string, ttl: number) => {
      const n = await this.redis.incr(key)
      if (n === 1) await this.redis.expire(key, ttl)
      return n
    }
    try {
      if ((await hit(`fotp:send:${funnel.id}:${phone}`, 600)) > 3) throw new HttpException(MSG.tooMany, 429)
      if (req.ip && (await hit(`fotp:ip:${funnel.id}:${req.ip}`, 3600)) > 10) throw new HttpException(MSG.tooMany, 429)
    } catch (err) {
      if (err instanceof HttpException) throw err
      throw new BadRequestException('Verification is temporarily unavailable')
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    await this.redis.set(this.codeKey(funnel.id, phone), JSON.stringify({ code, tries: 0 }), 'EX', OTP_CODE_TTL)
    await this.notifications.enqueue({ channel: 'SMS', recipient: phone, message: `رمز التحقق الخاص بك: ${code}` })
    return { ok: true, expiresInSeconds: OTP_CODE_TTL }
  }

  async verifyOtp(funnel: { id: string; protection: unknown }, rawPhone: string, code: string): Promise<{ otpToken: string }> {
    const p = parseFunnelProtection(funnel.protection)
    if (!p.phone.otp) throw new BadRequestException('Phone verification is not enabled for this funnel')
    const phone = normalizeAlgerianPhone(rawPhone)
    const key = this.codeKey(funnel.id, phone)
    const raw = await this.redis.get(key)
    if (!raw) throw new BadRequestException('انتهت صلاحية الرمز، اطلب رمزاً جديداً.')
    const stored = JSON.parse(raw) as { code: string; tries: number }
    if (stored.tries >= OTP_MAX_TRIES) {
      await this.redis.del(key)
      throw new BadRequestException('محاولات كثيرة، اطلب رمزاً جديداً.')
    }
    const a = Buffer.from(stored.code)
    const b = Buffer.from(code)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      stored.tries += 1
      const ttl = await this.redis.ttl(key)
      await this.redis.set(key, JSON.stringify(stored), 'EX', ttl > 0 ? ttl : OTP_CODE_TTL)
      throw new BadRequestException('الرمز غير صحيح.')
    }
    await this.redis.del(key)
    const token = randomBytes(16).toString('hex')
    await this.redis.set(this.okKey(funnel.id, token), phone, 'EX', OTP_TOKEN_TTL)
    return { otpToken: token }
  }

  // ---- log of refused attempts --------------------------------------------------

  async logBlocked(funnelId: string, reason: FunnelBlockReason, req: ProtectionRequest, phone: string, detail?: string): Promise<void> {
    try {
      await this.prisma.funnelBlockedAttempt.create({
        data: { funnelId, reason, phone: phone || null, ip: req.ip ?? null, userAgent: req.userAgent?.slice(0, 300) ?? null, detail: detail?.slice(0, 300) ?? null }
      })
      // Old rows are purged opportunistically (no scheduler), same approach as session recordings.
      if (Math.random() < 1 / 40) {
        await this.prisma.funnelBlockedAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - ATTEMPT_RETENTION_DAYS * 24 * HOUR_MS) } } })
      }
    } catch (err) {
      this.logger.warn(`Could not log blocked attempt (${reason}): ${(err as Error).message}`)
    }
  }

  async listBlocked(funnelId: string, page: number): Promise<FunnelBlockedAttemptList> {
    const funnel = await this.prisma.funnel.findUnique({ where: { id: funnelId }, select: { id: true } })
    if (!funnel) throw new NotFoundException('Funnel not found')
    const pageSize = 20
    const since = new Date(Date.now() - ATTEMPT_RETENTION_DAYS * 24 * HOUR_MS)
    const [rows, total, groups] = await Promise.all([
      this.prisma.funnelBlockedAttempt.findMany({ where: { funnelId }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.funnelBlockedAttempt.count({ where: { funnelId } }),
      this.prisma.funnelBlockedAttempt.groupBy({ by: ['reason'], where: { funnelId, createdAt: { gte: since } }, _count: { _all: true } })
    ])
    const known = (r: string): r is FunnelBlockReason => r in FUNNEL_BLOCK_REASONS
    const items: FunnelBlockedAttemptView[] = rows.filter((r) => known(r.reason)).map((r) => ({
      id: r.id,
      reason: r.reason as FunnelBlockReason,
      phone: r.phone,
      ip: r.ip,
      userAgent: r.userAgent,
      detail: r.detail,
      createdAt: r.createdAt.toISOString()
    }))
    const summary = groups
      .filter((g) => known(g.reason))
      .map((g) => ({ reason: g.reason as FunnelBlockReason, count: g._count._all }))
      .sort((a, b) => b.count - a.count)
    return { items, total, page, pageSize, summary }
  }
}
