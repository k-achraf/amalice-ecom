import { z } from 'zod'

// Admin "business assistant": a question in, an answer out. The answer is
// grounded in read-only data tools on the API (sales, products, wilayas, call
// center, stock) — see apps/api/src/ai/ai-assistant.service.ts. `history` is
// the earlier turns of the same chat, kept client-side.
export const AssistantMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().min(1).max(4000)
})
export type AssistantMessage = z.infer<typeof AssistantMessageSchema>

export const AskAssistantSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  history: z.array(AssistantMessageSchema).max(10).default([])
})
export type AskAssistant = z.infer<typeof AskAssistantSchema>

export const AssistantAnswerSchema = z.object({
  answer: z.string(),
  // Names of the data tools the answer was based on (shown as "Based on …").
  toolsUsed: z.array(z.string())
})
export type AssistantAnswer = z.infer<typeof AssistantAnswerSchema>
