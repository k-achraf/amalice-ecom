import { BadGatewayException, Injectable } from '@nestjs/common'

// Minimal Telegram Bot API client — sendMessage only.
@Injectable()
export class TelegramService {
  async send(botToken: string, chatId: string, text: string): Promise<void> {
    let response: Response
    try {
      response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
      })
    } catch (error) {
      throw new BadGatewayException(`Could not reach Telegram: ${(error as Error).message}`)
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { description?: string }
      throw new BadGatewayException(`Telegram error: ${body.description ?? `HTTP ${response.status}`}`)
    }
  }
}

export const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
