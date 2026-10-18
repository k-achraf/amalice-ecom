import { BadGatewayException } from '@nestjs/common'
import { getJson, postJson } from './http'
import type { AiMessage, AiProviderAdapter, AiToolCall, ProviderRequest, ProviderResponse } from './types'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const LABEL = 'Google Gemini'

interface GeminiPart {
  text?: string
  functionCall?: { name: string; args?: Record<string, unknown> }
  [key: string]: unknown
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[]
  promptFeedback?: { blockReason?: string }
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }
}

function toContent(message: AiMessage): Record<string, unknown> {
  if (message.role === 'user') {
    return { role: 'user', parts: [{ text: message.text }, ...(message.images ?? []).map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.base64 } }))] }
  }
  if (message.role === 'assistant') {
    // Echo the model's own parts back untouched: Gemini 3 models require their
    // thought signatures to continue a tool conversation.
    const parts = Array.isArray(message.raw) ? message.raw : [...(message.text ? [{ text: message.text }] : []), ...(message.toolCalls ?? []).map((c) => ({ functionCall: { name: c.name, args: c.args } }))]
    return { role: 'model', parts }
  }
  return { role: 'user', parts: message.results.map((r) => ({ functionResponse: { name: r.name, response: { result: r.result } } })) }
}

export const geminiAdapter: AiProviderAdapter = {
  id: 'gemini',

  async chat(request: ProviderRequest): Promise<ProviderResponse> {
    const json = await postJson<GeminiResponse>({
      label: LABEL,
      model: request.model,
      url: `${API_BASE}/models/${request.model}:generateContent`,
      headers: { 'x-goog-api-key': request.apiKey },
      body: {
        contents: request.messages.map(toContent),
        ...(request.system && { systemInstruction: { parts: [{ text: request.system }] } }),
        ...(request.tools?.length && { tools: [{ functionDeclarations: request.tools }] }),
        generationConfig: { temperature: request.temperature, ...(request.json && { responseMimeType: 'application/json' }) }
      }
    })
    if (json.promptFeedback?.blockReason) throw new BadGatewayException(`The AI blocked the request: ${json.promptFeedback.blockReason}`)

    const parts = json.candidates?.[0]?.content?.parts ?? []
    const toolCalls: AiToolCall[] = parts.filter((p) => p.functionCall).map((p) => ({ name: p.functionCall!.name, args: p.functionCall!.args ?? {} }))
    const usage = json.usageMetadata
    return {
      text: parts.map((p) => p.text ?? '').join('').trim(),
      toolCalls,
      rawAssistant: toolCalls.length ? parts : undefined,
      tokens: usage?.totalTokenCount ?? (usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0)
    }
  },

  async listModels(apiKey: string): Promise<string[]> {
    const json = await getJson<{ models?: { name: string; supportedGenerationMethods?: string[] }[] }>(LABEL, `${API_BASE}/models?pageSize=200`, { 'x-goog-api-key': apiKey })
    return (json.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter((name) => /^(gemini|gemma)/.test(name) && !/(tts|image|embedding|live|audio|transcribe|robotics|computer-use)/.test(name))
      .sort()
  }
}
