import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { IdentityController } from './identity.controller'
import { AdminAuthModule } from './admin-auth/admin-auth.module'

// global: true — admin-auth's JwtStrategy/guards need JwtService available
// without every consuming module importing JwtModule itself.
@Module({
  imports: [JwtModule.register({ global: true }), AdminAuthModule],
  controllers: [IdentityController]
})
export class IdentityModule {}
