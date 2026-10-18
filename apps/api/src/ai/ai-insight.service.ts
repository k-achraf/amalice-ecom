import { Injectable, Logger } from '@nestjs/common'
import { z } from 'zod'
import { AiService } from './ai.service'
import { AiToolsService } from './ai-tools.service'

export interface DailyFigures {
  date: string
  created: number
  confirmed: number
  cancelled: number
  delivered: number
  returned: number
  revenueDzd: number
}

const InsightSchema = z.object({
  insight: z.string().trim().min(1).max(300),
  suggestion: z.string().trim().min(1).max(220)
})

// One short AI paragraph for the daily Telegram report: the most notable thing
// in today's figures compared with the last 7 days, plus one concrete
// suggestion. Strictly best-effort — any failure (AI not configured, quota,
// network, daily cap) returns null so the report itself is always sent.
@Injectable()
export class AiInsightService {
  private readonly logger = new Logger(AiInsightService.name)

  constructor(
    private readonly ai: AiService,
    private readonly tools: AiToolsService
  ) {}

  async dailyInsight(today: DailyFigures): Promise<z.infer<typeof InsightSchema> | null> {
    if (!this.ai.isConfigured()) return null
    try {
      const week = await this.tools.salesOverview(7)
      const perDay = (n: number) => Math.round((n / 7) * 10) / 10
      return await this.ai.generateObject({
        task: 'daily-insight',
        tier: 'fast',
        temperature: 0.3,
        schema: InsightSchema,
        prompt: `You write one short insight for the owner of a cash-on-delivery store in Algeria, from its daily figures. Write in clear Modern Standard Arabic (الفصحى), no emoji, no markdown.

Today (${today.date}): new orders ${today.created}, confirmed ${today.confirmed}, cancelled ${today.cancelled}, delivered ${today.delivered} (revenue ${today.revenueDzd} DZD), returned ${today.returned}.
Last 7 days: ${week.totalOrders} orders (about ${perDay(week.totalOrders)}/day), ${week.delivered} delivered (${week.deliveredRevenueDzd} DZD), ${week.returned} returned, ${week.cancelled} cancelled (${week.cancellationRatePct}% cancellation), delivery rate ${week.deliveryRatePct}%.

Return:
- insight: ONE or two sentences on the most notable thing: a clear change versus the 7-day pace, or a risk. Use ONLY the numbers above; never invent figures, causes or events. If all numbers are tiny or flat, say that things are stable and the sample is small instead of dramatising.
- suggestion: ONE concrete, practical next action for tomorrow, grounded in the same numbers (not generic advice).`
      })
    } catch (error) {
      this.logger.warn(`Daily insight skipped: ${(error as Error).message}`)
      return null
    }
  }
}
