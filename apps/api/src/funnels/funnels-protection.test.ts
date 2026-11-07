import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { IncomingHttpHeaders } from 'node:http'
import {
  FunnelProtectionSchema,
  autoBlacklistAction,
  computeOrderRisk,
  defaultFunnelProtection,
  ipInList,
  ipMatches,
  isAlgerianMobile,
  isBotUserAgent,
  isCaptchaActive,
  isRepeatedDigitPhone,
  parseFunnelProtection,
  riskLevelFor,
  type FunnelOrder,
  type FunnelProtection
} from '@amalice/shared'
import { FunnelProtectionService } from './funnels-protection.service'

const BROWSER_UA = 'Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

// ---- pure helpers --------------------------------------------------------

test('defaults: an empty settings object is valid and keeps the safe baseline', () => {
  const d = defaultFunnelProtection()
  assert.equal(d.bots.honeypot, true)
  assert.equal(d.bots.minFillSeconds, 3)
  assert.equal(d.limits.phoneMax, 0)
  assert.equal(d.phone.otp, false)
  assert.equal(d.risk.autoWarnReturns, 2)
  assert.equal(d.risk.autoBlockReturns, 3)
  assert.equal(d.risk.blockAtScore, 0)
  assert.deepEqual(parseFunnelProtection(null), d)
  assert.deepEqual(parseFunnelProtection({ bots: { minFillSeconds: 999 } }), d, 'invalid stored value falls back to defaults')
})

test('phone checks', () => {
  assert.equal(isAlgerianMobile('+213674756914'), true)
  assert.equal(isAlgerianMobile('+213574756914'), true)
  assert.equal(isAlgerianMobile('+213274756914'), false)
  assert.equal(isAlgerianMobile('+21367475691'), false)
  assert.equal(isAlgerianMobile('+33674756914'), false)
  for (const p of ['+213555555555', '+213666666666', '+213612121212', '+213600000000']) assert.equal(isRepeatedDigitPhone(p), true, p)
  for (const p of ['+213674756914', '+213550123456']) assert.equal(isRepeatedDigitPhone(p), false, p)
})

test('IP rules: exact address and CIDR', () => {
  assert.equal(ipMatches('41.200.1.5', '41.200.1.5'), true)
  assert.equal(ipMatches('41.200.1.6', '41.200.1.5'), false)
  assert.equal(ipMatches('41.200.99.9', '41.200.0.0/16'), true)
  assert.equal(ipMatches('41.201.0.1', '41.200.0.0/16'), false)
  assert.equal(ipMatches('::ffff:41.200.1.5', '41.200.1.5'), true)
  assert.equal(ipMatches('1.2.3.4', '0.0.0.0/0'), true)
  assert.equal(ipMatches('1.2.3.4', 'garbage/8'), false)
  assert.equal(ipInList(undefined, ['1.2.3.4']), false)
  assert.equal(ipInList('1.2.3.4', ['9.9.9.9', '1.2.3.0/24']), true)
})

test('bot user agents', () => {
  assert.equal(isBotUserAgent(BROWSER_UA), false)
  assert.equal(isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/430.0]'), false)
  assert.equal(isBotUserAgent('Mozilla/5.0 (Linux; Android 10; CUBOT NOTE 7) AppleWebKit/537.36 Chrome/100 Mobile Safari/537.36'), false)
  for (const ua of [undefined, '', 'curl/8.0.1', 'python-requests/2.31.0', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Mozilla/5.0 HeadlessChrome/120.0.0.0 Safari/537.36', 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)']) {
    assert.equal(isBotUserAgent(ua), true, String(ua))
  }
})

test('risk thresholds and auto rule limits are configurable', () => {
  assert.equal(riskLevelFor(40), 'Medium')
  assert.equal(riskLevelFor(40, { mediumFrom: 50, highFrom: 80 }), 'Low')
  assert.equal(riskLevelFor(85, { mediumFrom: 50, highFrom: 80 }), 'High')
  const base = { history: { delivered: 0, returned: 1, cancelled: 0, unreachable: 0, total: 1, last24h: 0 }, wilaya: null, commune: null, phoneBlacklist: null, addressBlacklist: null, isDuplicate: false }
  assert.equal(computeOrderRisk(base).level, 'Low')
  assert.equal(computeOrderRisk(base, { mediumFrom: 20, highFrom: 90 }).level, 'Medium')
  assert.equal(autoBlacklistAction(2), 'Warn')
  assert.equal(autoBlacklistAction(3), 'Block')
  assert.equal(autoBlacklistAction(5, { warnAt: 0, blockAt: 0 }), null)
  assert.equal(autoBlacklistAction(1, { warnAt: 1, blockAt: 4 }), 'Warn')
  assert.equal(autoBlacklistAction(4, { warnAt: 1, blockAt: 4 }), 'Block')
})

test('captcha only counts once both keys exist', () => {
  const p = defaultFunnelProtection()
  assert.equal(isCaptchaActive(p), false)
  p.bots.captcha.enabled = true
  p.bots.captcha.siteKey = 'site'
  assert.equal(isCaptchaActive(p), false)
  p.bots.captcha.secretKey = 'secret'
  assert.equal(isCaptchaActive(p), true)
})

// ---- the guard, against in-memory stand-ins --------------------------------

interface Counts {
  phone?: number
  ip?: number
  visitor?: number
  views?: number
}

function makeGuard(counts: Counts = {}, redis: Record<string, string> = {}) {
  const logged: { reason: string; phone: string | null }[] = []
  const prisma = {
    order: { count: async () => counts.phone ?? 0 },
    orderAttribution: { count: async (args: { where: { ipAddress?: string; visitorId?: string } }) => (args.where.ipAddress ? (counts.ip ?? 0) : (counts.visitor ?? 0)) },
    pageViewEvent: { count: async () => counts.views ?? 0 },
    funnelBlockedAttempt: { create: async ({ data }: { data: { reason: string; phone: string | null } }) => void logged.push({ reason: data.reason, phone: data.phone }), deleteMany: async () => ({}) }
  }
  const store = new Map(Object.entries(redis))
  const fakeRedis = { get: async (k: string) => store.get(k) ?? null, del: async (k: string) => void store.delete(k) }
  const service = new FunnelProtectionService(prisma as never, fakeRedis as never, { enqueue: async () => ({}) } as never)
  return { service, logged }
}

const order = (over: Partial<FunnelOrder> = {}): FunnelOrder =>
  ({
    fields: { name: 'Mohamed Benali', phone: '0674756914' },
    wilayaId: '16',
    shippingType: 'Home',
    quantity: 1,
    formLoadedAt: Date.now() - 20_000,
    tracking: { attribution: { visitorId: 'visitor-1' } },
    ...over
  }) as FunnelOrder

const req = (over: { ip?: string; userAgent?: string; headers?: IncomingHttpHeaders } = {}) => ({ ip: '41.100.1.1', userAgent: BROWSER_UA, headers: {}, ...over })
const withProtection = (patch: (p: FunnelProtection) => void) => {
  const p = defaultFunnelProtection()
  patch(p)
  return { id: 'f1', protection: p }
}

async function refusedWith(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (err) {
    return (err as Error).message
  }
  return ''
}

test('a normal order passes the default rules', async () => {
  const { service, logged } = makeGuard()
  const r = await service.guard({ id: 'f1', protection: null }, order(), req())
  assert.equal(r.silent, false)
  assert.equal(r.phone, '+213674756914')
  assert.equal(logged.length, 0)
})

test('honeypot: silent success and a logged attempt', async () => {
  const { service, logged } = makeGuard()
  const r = await service.guard({ id: 'f1', protection: null }, order({ website: 'http://spam.example' }), req())
  assert.equal(r.silent, true)
  assert.deepEqual(logged.map((l) => l.reason), ['Honeypot'])
})

test('bots, speed, visit and phone format are refused and logged', async () => {
  const cases: { name: string; funnel: { id: string; protection: unknown }; input: FunnelOrder; request: ReturnType<typeof req>; reason: string }[] = [
    { name: 'bot UA', funnel: { id: 'f1', protection: null }, input: order(), request: req({ userAgent: 'curl/8.0' }), reason: 'BotAgent' },
    { name: 'too fast', funnel: { id: 'f1', protection: null }, input: order({ formLoadedAt: Date.now() - 500 }), request: req(), reason: 'TooFast' },
    { name: 'no timestamp', funnel: { id: 'f1', protection: null }, input: order({ formLoadedAt: undefined }), request: req(), reason: 'TooFast' },
    { name: 'no visit', funnel: withProtection((p) => (p.bots.requireVisit = true)), input: order(), request: req(), reason: 'NoVisit' },
    { name: 'bad phone', funnel: { id: 'f1', protection: null }, input: order({ fields: { name: 'Amine K', phone: '0212345678' } }), request: req(), reason: 'InvalidPhone' },
    { name: 'repeated phone', funnel: { id: 'f1', protection: null }, input: order({ fields: { name: 'Amine K', phone: '0666666666' } }), request: req(), reason: 'RepeatedPhone' },
    { name: 'blocked ip', funnel: withProtection((p) => (p.network.blockedIps = ['41.100.0.0/16'])), input: order(), request: req(), reason: 'IpBlocked' },
    { name: 'outside Algeria', funnel: withProtection((p) => (p.network.algeriaOnly = true)), input: order(), request: req({ headers: { 'cf-ipcountry': 'FR' } }), reason: 'Country' },
    { name: 'desktop', funnel: withProtection((p) => (p.network.blockDesktop = true)), input: order(), request: req({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }), reason: 'Desktop' },
    { name: 'tor', funnel: withProtection((p) => (p.network.blockProxies = true)), input: order(), request: req({ headers: { 'cf-ipcountry': 'T1' } }), reason: 'Proxy' }
  ]
  for (const c of cases) {
    const { service, logged } = makeGuard()
    const message = await refusedWith(service.guard(c.funnel, c.input, c.request))
    assert.ok(message, `${c.name} should be refused`)
    assert.deepEqual(logged.map((l) => l.reason), [c.reason], c.name)
  }
})

test('block desktop lets phones through', async () => {
  await makeGuard().service.guard(withProtection((p) => (p.network.blockDesktop = true)), order(), req())
})

test('Algeria-only never refuses when the CDN gives no country (or DZ)', async () => {
  const { service } = makeGuard()
  const funnel = withProtection((p) => (p.network.algeriaOnly = true))
  await service.guard(funnel, order(), req())
  await service.guard(funnel, order(), req({ headers: { 'cf-ipcountry': 'DZ' } }))
  await service.guard(funnel, order(), req({ headers: { 'cf-ipcountry': 'XX' } }))
})

test('limits: per phone / IP / visitor, cooldown and duplicate window', async () => {
  const cases: { name: string; counts: Counts; patch: (p: FunnelProtection) => void; reason: string }[] = [
    { name: 'phone', counts: { phone: 2 }, patch: (p) => (p.limits.phoneMax = 2), reason: 'PhoneLimit' },
    { name: 'ip', counts: { ip: 5 }, patch: (p) => (p.limits.ipMax = 5), reason: 'IpLimit' },
    { name: 'visitor', counts: { visitor: 1 }, patch: (p) => (p.limits.visitorMax = 1), reason: 'VisitorLimit' },
    { name: 'cooldown', counts: { ip: 1 }, patch: (p) => (p.limits.cooldownMinutes = 10), reason: 'Cooldown' },
    { name: 'duplicate', counts: { phone: 1 }, patch: (p) => (p.limits.duplicateBlockHours = 48), reason: 'Duplicate' }
  ]
  for (const c of cases) {
    const { service, logged } = makeGuard(c.counts)
    assert.ok(await refusedWith(service.guard(withProtection(c.patch), order(), req())), c.name)
    assert.deepEqual(logged.map((l) => l.reason), [c.reason], c.name)
  }
  // Under the limit → allowed.
  const { service } = makeGuard({ phone: 1, ip: 2, visitor: 0 })
  await service.guard(withProtection((p) => ((p.limits.phoneMax = 2), (p.limits.ipMax = 3))), order(), req())
})

test('a retry of an order that already went through skips the limits', async () => {
  const key = '11111111-1111-4111-8111-111111111111'
  const { service } = makeGuard({ phone: 5 }, { [`checkout:idem:${key}`]: 'order-1' })
  await service.guard(withProtection((p) => (p.limits.phoneMax = 1)), order({ idempotencyKey: key }), req())
  const pending = makeGuard({ phone: 5 }, { [`checkout:idem:${key}`]: 'processing' })
  assert.ok(await refusedWith(pending.service.guard(withProtection((p) => (p.limits.phoneMax = 1)), order({ idempotencyKey: key }), req())))
})

test('OTP: an order needs a token issued for the same phone', async () => {
  const funnel = withProtection((p) => (p.phone.otp = true))
  const none = makeGuard()
  assert.ok(await refusedWith(none.service.guard(funnel, order(), req())))
  assert.deepEqual(none.logged.map((l) => l.reason), ['Otp'])
  const ok = makeGuard({}, { 'fotp:ok:f1:tok': '+213674756914' })
  await ok.service.guard(funnel, order({ otpToken: 'tok' }), req())
  const other = makeGuard({}, { 'fotp:ok:f1:tok': '+213555123456' })
  assert.ok(await refusedWith(other.service.guard(funnel, order({ otpToken: 'tok' }), req())))
})

test('whitelist: never restricted, risk never refuses', async () => {
  const funnel = withProtection((p) => {
    p.limits.phoneMax = 1
    p.bots.requireVisit = true
    p.whitelist.phones = ['0674756914']
    p.risk.blockAtScore = 1
  })
  const { service } = makeGuard({ phone: 9 })
  const r = await service.guard(funnel, order(), req({ userAgent: 'curl/8' }))
  assert.equal(r.riskPolicy.bypass, true)
  const byIp = withProtection((p) => ((p.limits.phoneMax = 1), (p.whitelist.ips = ['41.100.0.0/16'])))
  const r2 = await makeGuard({ phone: 9 }).service.guard(byIp, order(), req())
  assert.equal(r2.riskPolicy.bypass, true)
})

test('custom refusal text replaces the vague message, helpful ones stay', async () => {
  const funnel = withProtection((p) => ((p.risk.blockedMessage = 'Contact us on WhatsApp'), (p.network.blockedIps = ['41.100.1.1'])))
  assert.equal(await refusedWith(makeGuard().service.guard(funnel, order(), req())), 'Contact us on WhatsApp')
  const phoneMsg = await refusedWith(makeGuard().service.guard(funnel, order({ fields: { name: 'Amine K', phone: '0212345678' } }), req({ ip: '9.9.9.9' })))
  assert.notEqual(phoneMsg, 'Contact us on WhatsApp')
})

test('schema: ranges are enforced', () => {
  assert.equal(FunnelProtectionSchema.safeParse({ limits: { phoneMax: -1 } }).success, false)
  assert.equal(FunnelProtectionSchema.safeParse({ bots: { minFillSeconds: 61 } }).success, false)
  assert.equal(FunnelProtectionSchema.safeParse({ risk: { fakeNameAction: 'explode' } }).success, false)
  assert.equal(FunnelProtectionSchema.safeParse({ network: { blockedIps: Array.from({ length: 201 }, () => '1.1.1.1') } }).success, false)
})
