import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { IdentityController } from './identity.controller'
import { OtpController } from './otp/otp.controller'
import { OtpService } from './otp/otp.service'
import { OTP_PROVIDER } from './otp/otp-provider.interface'
import { ConsoleOtpProvider } from './otp/console-otp.provider'
import { CustomerAuthGuard } from './otp/customer-auth.guard'
import { AdminAuthModule } from './admin-auth/admin-auth.module'

@Module({
  // global: true — CustomerAuthGuard is provided/exported here but used via
  // @UseGuards() in OrdersModule's controller; Nest instantiates a
  // class-referenced guard using the CONTROLLER's own module context, which
  // doesn't automatically inherit IdentityModule's imports. Making JwtModule
  // global was the actual fix for a real "Nest can't resolve dependencies of
  // CustomerAuthGuard... JwtService... available in the OrdersModule module"
  // boot failure caught while wiring SF-11.
  imports: [JwtModule.register({ global: true }), AdminAuthModule],
  controllers: [IdentityController, OtpController],
  providers: [OtpService, CustomerAuthGuard, { provide: OTP_PROVIDER, useClass: ConsoleOtpProvider }],
  exports: [OtpService, CustomerAuthGuard]
})
export class IdentityModule {}
