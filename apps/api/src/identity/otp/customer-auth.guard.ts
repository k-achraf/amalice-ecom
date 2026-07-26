import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import type { Env } from '../../config/env.validation'

export interface CustomerJwtPayload {
  sub: string
  phone: string
}

// Deliberately not a passport-jwt Strategy like the admin one — this is a
// single route's worth of auth (order history), signed with a different
// secret (OTP_SECRET) and payload shape than admin tokens, so it isn't
// sharing anything with JwtStrategy that would justify the extra plumbing.
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { customer?: CustomerJwtPayload }>()
    const header = request.headers.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
    if (!token) throw new UnauthorizedException('Missing token')

    try {
      const payload = await this.jwt.verifyAsync<CustomerJwtPayload>(token, {
        secret: this.config.get('OTP_SECRET', { infer: true })
      })
      request.customer = { sub: payload.sub, phone: payload.phone }
      return true
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }
  }
}
