import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BadGatewayException } from '@nestjs/common'
import { buildCategoryRows, categoryRiskLevel, competitorPriceStats, matchCategory, suggestFunnelTests, type FunnelStats } from '@amalice/shared'
import { MetaAdCopyService } from './meta-ad-copy.service'

const product = {
  name: 'Mixeur Pro 500',
  description: 'Mixeur de cuisine 500 watts avec bol en verre de 1.5 litre.',
  keyBenefits: ['Bol en verre', 'Moteur 500 watts'],
  category: 'Cuisine',
  priceCents: 450000
}

function service(responses: unknown[]) {
  const calls: string[] = []
  const prisma = { product: { findUnique: async () => product } }
  const ai = {
    async generateObject(input: { prompt: string }) {
      calls.push(input.prompt)
      return responses.shift()
    }
  }
  return { svc: new MetaAdCopyService(prisma as never, ai as never), calls }
}

const NAMES = ['alpha', 'bravo', 'charlie', 'delta', 'echo']
const clean = (n: number) => ({
  angle: `Angle ${NAMES[n]}`,
  primaryText: `Un mixeur de cuisine de 500 watts avec un bol en verre, pratique au quotidien pour ${NAMES[n]}.`,
  headlines: [`Mixeur 500 watts ${NAMES[n]}`, `Bol en verre ${NAMES[n]}`, `Cuisine facile ${NAMES[n]}`],
  description: 'Paiement à la livraison'
})
const withClaim = { ...clean(4), primaryText: 'Profitez de 30% de réduction et livraison gratuite sur ce mixeur.' }

test('ad copy: valid angles pass through', async () => {
  const { svc } = service([{ angles: [clean(1), clean(2), clean(3)] }])
  const res = await svc.generate({ productId: 'p', language: 'fr', angleCount: 3 })
  assert.equal(res.angles.length, 3)
  assert.equal(res.rejected, 0)
})

test('ad copy: invented discount / numbers are rejected and re-asked with the problem', async () => {
  const { svc, calls } = service([{ angles: [clean(1), withClaim, clean(3)] }, { angles: [clean(2)] }])
  const res = await svc.generate({ productId: 'p', language: 'fr', angleCount: 3 })
  assert.equal(res.angles.length, 3)
  assert.equal(res.rejected, 1)
  assert.ok(!res.angles.some((a) => /30|gratuit/i.test(a.primaryText)))
  assert.match(calls[1]!, /previous attempt had these problems/)
})

test('ad copy: a claim that is in the product data is allowed', async () => {
  const prisma = { product: { findUnique: async () => ({ ...product, description: `${product.description} Garantie 2 ans.` }) } }
  const ai = { generateObject: async () => ({ angles: [{ ...clean(1), primaryText: 'Un mixeur de cuisine 500 watts avec garantie 2 ans, simple à utiliser.' }, clean(2)] }) }
  const res = await new MetaAdCopyService(prisma as never, ai as never).generate({ productId: 'p', language: 'fr', angleCount: 2 })
  assert.equal(res.angles.length, 2)
})

test('ad copy: gives up with an error when nothing valid comes back', async () => {
  const { svc } = service([{ angles: [withClaim] }, { angles: [withClaim] }, { angles: [withClaim] }])
  await assert.rejects(() => svc.generate({ productId: 'p', language: 'fr', angleCount: 2 }), BadGatewayException)
})

test('ad copy: Arabic output with Latin words not in the product data is rejected', async () => {
  const ar = { ...clean(1), primaryText: 'خلاط مطبخ قوي مع bowl زجاجي', headlines: ['خلاط قوي', 'وعاء زجاجي'], description: 'الدفع عند الاستلام' }
  const { svc } = service([{ angles: [ar] }, { angles: [ar] }, { angles: [ar] }])
  await assert.rejects(() => svc.generate({ productId: 'p', language: 'ar', angleCount: 2 }), BadGatewayException)
})

// ---- funnel suggestions ----

function stats(over: Partial<FunnelStats['traffic']> = {}, sales: Partial<FunnelStats['sales']> = {}): FunnelStats {
  return {
    days: 30,
    traffic: { views: 400, uniqueVisitors: 300, trackedVisits: 200, avgDurationSeconds: 40, avgScrollDepth: 60, bounceRate: 30, formStarts: 80, formVisitors: 70, formStartRate: 20, ...over },
    sales: { orders: 24, conversionRate: 8, conversionPerView: 6, grossValue: 100000, avgOrderValue: 4000, ordersWithUpsell: 5, upsellRate: 20, upsellRevenue: 5000, formDropOffRate: 30, ...sales },
    fulfilment: { confirmationRate: 80, finalDeliveryRate: 85, delivered: 10, returned: 2 } as FunnelStats['fulfilment'],
    daily: [],
    devices: [],
    sources: [],
    campaigns: [],
    wilayas: []
  }
}
const steps = [{ type: 'Landing' as const, enabled: true }, { type: 'OrderBump' as const, enabled: true }]

test('funnel: too little traffic means collect data, no test', () => {
  const r = suggestFunnelTests(stats({ uniqueVisitors: 40 }), steps)
  assert.equal(r.status, 'collect-data')
  assert.equal(r.suggestions[0]!.id, 'collect-data')
})

test('funnel: high bounce rate points at the opening first', () => {
  const r = suggestFunnelTests(stats({ bounceRate: 72 }), steps)
  assert.equal(r.status, 'ready')
  assert.equal(r.suggestions[0]!.id, 'hook')
  assert.match(r.suggestions[0]!.evidence, /72%/)
})

test('funnel: big form drop-off suggests a shorter form; no add-on step suggests a bump', () => {
  const r = suggestFunnelTests(stats({}, { formDropOffRate: 62 }), [{ type: 'Landing', enabled: true }])
  const ids = r.suggestions.map((s) => s.id)
  assert.ok(ids.includes('form'))
  assert.ok(ids.includes('add-offer'))
})

test('funnel: nothing weak → healthy, suggests price/offer test', () => {
  const r = suggestFunnelTests(stats(), steps)
  assert.equal(r.status, 'healthy')
  assert.equal(r.suggestions[0]!.id, 'price-offer')
})

// ---- sourcing helpers ----

test('competitor price stats: min / median / max ignore missing prices', () => {
  const s = competitorPriceStats([{ priceCents: 300000 }, { priceCents: null }, { priceCents: 500000 }, { priceCents: 400000 }])
  assert.deepEqual([s.count, s.withPrice, s.minCents, s.medianCents, s.maxCents], [4, 3, 300000, 400000, 500000])
  assert.equal(competitorPriceStats([]).medianCents, null)
})

test('category risk: small samples stay Unknown; high return rate is High', () => {
  assert.equal(categoryRiskLevel(5, 5, 20), 'Unknown')
  assert.equal(categoryRiskLevel(40, 20, 20), 'High')
  assert.equal(categoryRiskLevel(40, 10, 20), 'Medium')
  assert.equal(categoryRiskLevel(40, 4, 20), 'Low')
  const rows = buildCategoryRows(new Map([['Beauty', { finished: 20, returned: 8 }], ['Kitchen', { finished: 30, returned: 3 }]]), 20)
  assert.equal(rows[0]!.category, 'Beauty')
})

test('niche → category match is accent/case tolerant and partial', () => {
  assert.equal(matchCategory('kitchen', ['Kitchen', 'Beauty']), 'Kitchen')
  assert.equal(matchCategory('Cuisine ustensiles', ['Cuisine']), 'Cuisine')
  assert.equal(matchCategory('jouets', ['Kitchen']), null)
  assert.equal(matchCategory(null, ['Kitchen']), null)
})
