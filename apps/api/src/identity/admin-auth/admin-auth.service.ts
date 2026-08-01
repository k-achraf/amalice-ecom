import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../../prisma/prisma.service'
import type { Env } from '../../config/env.validation'
import type { AdminJwtPayload } from './jwt-payload.interface'

// The admin SPA has no silent-refresh flow (see auth.ts's own comment on
// this) — a 401 just clears the session and bounces to /login. With the
// original 15m TTL that meant staff got logged out mid-task during normal
// use; 12h (a full shift) avoids that without going as far as the 7-day
// refresh token's window.
const ACCESS_TOKEN_TTL = '12h'
const REFRESH_TOKEN_TTL = '7d'

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>
  ) {}

  async login(email: string, password: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { email }, include: { role: true } })
    // Same "invalid credentials" message whether the email doesn't exist or
    // the password is wrong — distinguishing the two lets an attacker
    // enumerate valid admin emails. A deactivated account returns the same
    // message (not "account deactivated") for the same enumeration reason.
    if (!admin || !admin.active || !(await bcrypt.compare(password, admin.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials')
    }
    return this.issueTokens({ sub: admin.id, email: admin.email, role: admin.role.name })
  }

  async refresh(refreshToken: string) {
    let payload: AdminJwtPayload
    try {
      payload = await this.jwt.verifyAsync<AdminJwtPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true })
      })
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token')
    }

    const admin = await this.prisma.adminUser.findUnique({ where: { id: payload.sub }, include: { role: true } })
    if (!admin) throw new UnauthorizedException('Invalid or expired refresh token')

    return this.issueTokens({ sub: admin.id, email: admin.email, role: admin.role.name })
  }

  private async issueTokens(payload: AdminJwtPayload) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_SECRET', { infer: true }),
        expiresIn: ACCESS_TOKEN_TTL
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: REFRESH_TOKEN_TTL
      })
    ])
    return { accessToken, refreshToken }
  }
}
