import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { MetaProfitabilityQuerySchema, SetMetaExchangeRateSchema, MetaAnalyticsLevelSchema, MetaAnalyticsQuerySchema, ConnectMetaSchema, ConnectMetaTokenSchema, SaveMetaAppCredentialsSchema, MetaCampaignsQuerySchema, MetaInsightsQuerySchema, MetaOAuthUrlQuerySchema } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import type { AuditActor } from '../common/audit.service'
import { MetaAdsService } from './meta-ads.service'

class MetaOAuthUrlQueryDto extends createZodDto(MetaOAuthUrlQuerySchema) {}
class ConnectMetaDto extends createZodDto(ConnectMetaSchema) {}
class ConnectMetaTokenDto extends createZodDto(ConnectMetaTokenSchema) {}
class SaveMetaAppCredentialsDto extends createZodDto(SaveMetaAppCredentialsSchema) {}
class MetaCampaignsQueryDto extends createZodDto(MetaCampaignsQuerySchema) {}
class MetaInsightsQueryDto extends createZodDto(MetaInsightsQuerySchema) {}
class MetaAnalyticsQueryDto extends createZodDto(MetaAnalyticsQuerySchema) {}
class MetaProfitabilityQueryDto extends createZodDto(MetaProfitabilityQuerySchema) {}
class SetMetaExchangeRateDto extends createZodDto(SetMetaExchangeRateSchema) {}

interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

const actorFrom = (req: AuthedRequest): AuditActor => ({ id: req.user.sub, email: req.user.email })

function accountIdOf(raw: string): string {
  if (!/^act_\d{1,30}$/.test(raw)) throw new BadRequestException('Invalid ad account id')
  return raw
}

// Meta Ads admin section. Each admin user links their OWN Facebook account:
// every call here is scoped to the caller's connection (req.user.sub).
@ApiTags('meta-ads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin', 'OpsManager')
@Controller('admin/meta-ads')
export class MetaAdsController {
  constructor(private readonly metaAds: MetaAdsService) {}

  @Get('status')
  status(@Req() req: AuthedRequest) {
    return this.metaAds.status(req.user.sub)
  }

  @Get('oauth-url')
  oauthUrl(@Query() query: MetaOAuthUrlQueryDto) {
    return this.metaAds.oauthUrl(query)
  }

  @Post('connect')
  @Throttle({ default: { limit: 10, ttl: 60 * 1000 } })
  connect(@Body() body: ConnectMetaDto, @Req() req: AuthedRequest) {
    return this.metaAds.connect(req.user.sub, body, actorFrom(req))
  }

  // The simplest way to link an account: paste an access token (no Facebook Login setup).
  @Post('connect-token')
  @Throttle({ default: { limit: 10, ttl: 60 * 1000 } })
  connectToken(@Body() body: ConnectMetaTokenDto, @Req() req: AuthedRequest) {
    return this.metaAds.connectToken(req.user.sub, body, actorFrom(req))
  }

  // The Meta developer app behind "Connect with Facebook" is shared by everyone, so SuperAdmin only.
  @Put('app-credentials')
  @Roles('SuperAdmin')
  saveAppCredentials(@Body() body: SaveMetaAppCredentialsDto, @Req() req: AuthedRequest) {
    return this.metaAds.saveAppCredentials(body, actorFrom(req))
  }

  @Delete('app-credentials')
  @Roles('SuperAdmin')
  clearAppCredentials(@Req() req: AuthedRequest) {
    return this.metaAds.clearAppCredentials(actorFrom(req))
  }

  @Delete('connection')
  disconnect(@Req() req: AuthedRequest) {
    return this.metaAds.disconnect(req.user.sub, actorFrom(req))
  }

  @Get('accounts')
  accounts(@Req() req: AuthedRequest) {
    return this.metaAds.listAccounts(req.user.sub)
  }

  @Post('accounts/sync')
  @Throttle({ default: { limit: 10, ttl: 60 * 1000 } })
  syncAccounts(@Req() req: AuthedRequest) {
    return this.metaAds.syncAccounts(req.user.sub)
  }

  @Post('accounts/:accountId/select')
  selectAccount(@Param('accountId') accountId: string, @Req() req: AuthedRequest) {
    return this.metaAds.selectAccount(req.user.sub, accountIdOf(accountId))
  }

  @Get('accounts/:accountId/campaigns')
  campaigns(@Param('accountId') accountId: string, @Query() query: MetaCampaignsQueryDto, @Req() req: AuthedRequest) {
    return this.metaAds.campaigns(req.user.sub, accountIdOf(accountId), query)
  }

  @Get('accounts/:accountId/campaigns/:campaignId/adsets')
  adSets(@Param('accountId') accountId: string, @Param('campaignId') campaignId: string, @Query() query: MetaCampaignsQueryDto, @Req() req: AuthedRequest) {
    return this.metaAds.adSets(req.user.sub, accountIdOf(accountId), campaignId, query)
  }

  @Get('accounts/:accountId/adsets/:adsetId/ads')
  ads(@Param('accountId') accountId: string, @Param('adsetId') adsetId: string, @Query() query: MetaCampaignsQueryDto, @Req() req: AuthedRequest) {
    return this.metaAds.ads(req.user.sub, accountIdOf(accountId), adsetId, query)
  }

  // Full analytics of one campaign / ad set / ad (level = campaign | adset | ad).
  @Get('accounts/:accountId/analytics/:level/:id')
  analytics(@Param('accountId') accountId: string, @Param('level') level: string, @Param('id') id: string, @Query() query: MetaAnalyticsQueryDto, @Req() req: AuthedRequest) {
    const parsed = MetaAnalyticsLevelSchema.safeParse(level)
    if (!parsed.success) throw new BadRequestException('Level must be campaign, adset or ad')
    return this.metaAds.analytics(req.user.sub, accountIdOf(accountId), parsed.data, id, query)
  }

  // Confirmation / delivery / return rates and revenue / profit of the orders linked to each campaign, ad set or ad.
  @Get('accounts/:accountId/profitability')
  profitability(@Param('accountId') accountId: string, @Query() query: MetaProfitabilityQueryDto, @Req() req: AuthedRequest) {
    return this.metaAds.profitability(req.user.sub, accountIdOf(accountId), query)
  }

  // 1 unit of the account currency in DZD (profit needs it to put ad spend and orders on the same currency).
  @Put('accounts/:accountId/exchange-rate')
  setExchangeRate(@Param('accountId') accountId: string, @Body() body: SetMetaExchangeRateDto, @Req() req: AuthedRequest) {
    return this.metaAds.setExchangeRate(req.user.sub, accountIdOf(accountId), body)
  }

  @Get('accounts/:accountId/overview')
  overview(@Param('accountId') accountId: string, @Query() query: MetaInsightsQueryDto, @Req() req: AuthedRequest) {
    return this.metaAds.overview(req.user.sub, accountIdOf(accountId), query)
  }
}
