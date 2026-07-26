import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { Env } from '../../config/env.validation'
import type { AdminJwtPayload } from './jwt-payload.interface'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true })
    })
  }

  // Whatever this returns becomes `request.user` — kept to exactly what
  // guards/routes need (id, email, role), not the raw JWT payload shape.
  validate(payload: AdminJwtPayload) {
    return { id: payload.sub, email: payload.email, role: payload.role }
  }
}
