import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { RequestOtpSchema, VerifyOtpSchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import { OtpService } from './otp.service'

class RequestOtpDto extends createZodDto(RequestOtpSchema) {}
class VerifyOtpDto extends createZodDto(VerifyOtpSchema) {}

@ApiTags('auth')
@Controller('auth/otp')
export class OtpController {
  constructor(private readonly otp: OtpService) {}

  @Post('request')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Overrides the 'default' throttler's limit for just this route (not a
  // separate named throttler — see app.module.ts for why) — this is the
  // single highest-leverage anti-fraud control in the whole platform (plan
  // §7, §11); it deserves a much tighter budget than ordinary browsing.
  @Throttle({ default: { limit: 5, ttl: 5 * 60 * 1000 } })
  async request(@Body() body: RequestOtpDto): Promise<void> {
    await this.otp.requestOtp(body.phone)
    // Never echo the code in the response, even on failure paths — that
    // would turn the endpoint into a way to read codes without receiving
    // the SMS. 204 either way; ConsoleOtpProvider logs it server-side for
    // local dev.
  }

  @Post('verify')
  @Throttle({ default: { limit: 10, ttl: 5 * 60 * 1000 } })
  async verify(@Body() body: VerifyOtpDto) {
    return this.otp.verifyOtp(body.phone, body.code)
  }
}
