import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Logger } from '@nestjs/common'
import { AiInsightService, type DailyFigures } from './ai-insight.service'

Logger.overrideLogger(false)

const figures: DailyFigures = { date: '2026-10-18', created: 12, confirmed: 8, cancelled: 2, delivered: 5, returned: 1, revenueDzd: 42000 }
const overview = { days: 7, totalOrders: 70, delivered: 30, deliveredRevenueDzd: 210000, returned: 5, cancelled: 8, inProgress: 27, cancellationRatePct: 11.4, deliveryRatePct: 85.7 }

function makeService(ai: { isConfigured: () => boolean; generateObject: (input: any) => Promise<unknown> }, salesOverview = async () => overview) {
  return new AiInsightService(ai as never, { salesOverview } as never)
}

test('returns null without calling the AI when it is not configured', async () => {
  let called = false
  const service = makeService({
    isConfigured: () => false,
    generateObject: async () => {
      called = true
      return {}
    }
  })
  assert.equal(await service.dailyInsight(figures), null)
  assert.equal(called, false)
})

test('returns the insight and grounds the prompt in today and the 7-day numbers', async () => {
  let prompt = ''
  const service = makeService({
    isConfigured: () => true,
    generateObject: async (input) => {
      prompt = input.prompt
      return { insight: 'i', suggestion: 's' }
    }
  })
  assert.deepEqual(await service.dailyInsight(figures), { insight: 'i', suggestion: 's' })
  assert.match(prompt, /new orders 12, confirmed 8, cancelled 2, delivered 5 \(revenue 42000 DZD\), returned 1/)
  assert.match(prompt, /70 orders \(about 10\/day\)/)
})

test('never throws: an AI failure (quota, network, cap) yields null so the report still goes out', async () => {
  const service = makeService({
    isConfigured: () => true,
    generateObject: async () => Promise.reject(new Error('quota exhausted'))
  })
  assert.equal(await service.dailyInsight(figures), null)
})

test('never throws: a data failure yields null too', async () => {
  const service = makeService({ isConfigured: () => true, generateObject: async () => ({ insight: 'i', suggestion: 's' }) }, async () => Promise.reject(new Error('db down')))
  assert.equal(await service.dailyInsight(figures), null)
})
