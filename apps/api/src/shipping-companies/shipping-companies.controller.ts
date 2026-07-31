import { BadRequestException, Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ApplyShippingCompanyTariffsSchema, LinkShippingCompanySchema, ShippingCompanyProviderSchema, type ShippingCompanyProvider } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { ShippingCompaniesService } from './shipping-companies.service'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import type { AuditActor } from '../common/audit.service'

class LinkShippingCompanyDto extends createZodDto(LinkShippingCompanySchema) {}
class ApplyShippingCompanyTariffsDto extends createZodDto(ApplyShippingCompanyTariffsSchema) {}

interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

function parseProvider(provider: string): ShippingCompanyProvider {
  const parsed = ShippingCompanyProviderSchema.safeParse(provider)
  if (!parsed.success) throw new BadRequestException(`Unknown shipping company: ${provider}`)
  return parsed.data
}

// Third-party courier integrations (DHD first) — link an account with an
// api_token, sync its per-wilaya tariffs for reference, and optionally
// apply chosen wilayas into the live WilayaShippingRate. SuperAdmin/
// OpsManager only, same roles as the rest of the Shipping section.
@ApiTags('shipping-companies')
@Controller('admin/shipping-companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin', 'OpsManager')
export class ShippingCompaniesController {
  constructor(private readonly shippingCompanies: ShippingCompaniesService) {}

  @Get()
  list() {
    return this.shippingCompanies.list()
  }

  @Post(':provider/link')
  link(@Param('provider') provider: string, @Body() body: LinkShippingCompanyDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.shippingCompanies.link(parseProvider(provider), body, actor)
  }

  @Post(':provider/unlink')
  unlink(@Param('provider') provider: string, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.shippingCompanies.unlink(parseProvider(provider), actor)
  }

  @Post(':provider/default')
  setDefault(@Param('provider') provider: string, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.shippingCompanies.setDefault(parseProvider(provider), actor)
  }

  @Post(':provider/sync')
  sync(@Param('provider') provider: string, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.shippingCompanies.syncTariffs(parseProvider(provider), actor)
  }

  @Get(':provider/tariffs')
  tariffs(@Param('provider') provider: string) {
    return this.shippingCompanies.listTariffs(parseProvider(provider))
  }

  @Post(':provider/tariffs/apply')
  applyTariffs(@Param('provider') provider: string, @Body() body: ApplyShippingCompanyTariffsDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.shippingCompanies.applyTariffsToRates(parseProvider(provider), body, actor)
  }
}
