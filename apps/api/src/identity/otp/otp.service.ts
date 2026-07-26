import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { randomInt } from 'node:crypto'
import { RedisService } from '../../redis/redis.service'
import { PrismaService } from '../../prisma/prisma.service'
import { OTP_PROVIDER, type OtpProvider } from './otp-provider.interface'
import type { Env } from '../../config/env.validation'

const redisKey = (phone: string) => `otp:${phone}`

@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    @Inject(OTP_PROVIDER) private readonly provider: OtpProvider
  ) {}

  async requestOtp(phone: string): Promise<void> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
    const ttl = this.config.get('OTP_TTL_SECONDS', { infer: true })
    await this.redis.set(redisKey(phone), code, 'EX', ttl)
    await this.provider.send(phone, code)
  }

  async verifyOtp(phone: string, code: string): Promise<{ token: string; customer: { id: string; phone: string } }> {
    const stored = await this.redis.get(redisKey(phone))
    if (!stored || stored !== code) {
      throw new UnauthorizedException('Invalid or expired code')
    }
    // One-time use — a code can't be replayed after a successful verify.
    await this.redis.del(redisKey(phone))

    const customer = await this.prisma.customer.upsert({
      where: { phone },
      update: {},
      create: { phone }
    })

    const token = await this.jwt.signAsync(
      { sub: customer.id, phone: customer.phone },
      { secret: this.config.get('OTP_SECRET', { infer: true }), expiresIn: '30m' }
    )

    return { token, customer: { id: customer.id, phone: customer.phone } }
  }
}
