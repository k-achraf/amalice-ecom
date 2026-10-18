import { Injectable } from '@nestjs/common'
import type { AskAssistant, AssistantAnswer } from '@amalice/shared'
import { AiService } from './ai.service'
import { AiToolsService } from './ai-tools.service'

const SYSTEM = `You are the business analyst assistant inside "Amalice", a cash-on-delivery e-commerce back-office for the Algerian market. The user is the store owner or a manager.

Rules:
- Answer ONLY from the data tools. For any question about numbers, orders, products, wilayas, the call center or stock, call the relevant tool first; never guess or use outside knowledge for figures. If no tool can answer, say so plainly.
- Amounts are in DZD. Say which period the numbers cover.
- Reply in the language of the question (Arabic questions get Arabic answers, in clear Modern Standard Arabic; French or English the same).
- Be concise: lead with the answer, then 2-4 short supporting points. When it helps, add one practical recommendation, clearly marked as a suggestion, not as fact.
- Small samples (a few orders) are weak evidence: say so instead of drawing strong conclusions.
- You are read-only: you cannot change orders, prices, ads or settings. Do not claim you did.`

// The admin "business assistant": the model decides which read-only data tools
// to call (AiToolsService) and writes the answer from their results.
@Injectable()
export class AiAssistantService {
  constructor(
    private readonly ai: AiService,
    private readonly tools: AiToolsService
  ) {}

  async ask(input: AskAssistant): Promise<AssistantAnswer> {
    const { text, toolsUsed } = await this.ai.runWithTools({
      task: 'assistant',
      system: SYSTEM,
      history: input.history,
      question: input.question,
      tools: this.tools.tools()
    })
    return { answer: text, toolsUsed }
  }
}
