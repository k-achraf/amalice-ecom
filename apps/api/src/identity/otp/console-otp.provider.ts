import { Injectable, Logger } from '@nestjs/common'
import type { OtpProvider } from './otp-provider.interface'

// Dev-only stand-in — logs the code instead of sending an SMS. Swapping in a
// real provider later means implementing OtpProvider and changing one
// binding in identity.module.ts, not touching OtpService or the controller.
@Injectable()
export class ConsoleOtpProvider implements OtpProvider {
  private readonly logger = new Logger('OTP')

  async send(phone: string, code: string): Promise<void> {
    this.logger.log(`OTP for ${phone}: ${code}`)
  }
}
