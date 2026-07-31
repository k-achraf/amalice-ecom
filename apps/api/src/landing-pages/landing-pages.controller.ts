import { Body, Controller, Get, NotFoundException, Param, Post, Put, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { GenerateLandingPageSchema, UpdateLandingPageSchema, type PublicLandingPage } from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { LandingPagesService } from './landing-pages.service'
import { PrismaService } from '../prisma/prisma.service'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import type { AuditActor } from '../common/audit.service'

class GenerateLandingPageDto extends createZodDto(GenerateLandingPageSchema) {}
class UpdateLandingPageDto extends createZodDto(UpdateLandingPageSchema) {}

interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

// Admin surface (SuperAdmin/OpsManager, same roles as product image
// management in upload.controller.ts) plus one public read for the
// storefront PDP. AI generation calls are throttled tighter than default —
// each one costs real (if free-tier) API quota and takes real wall-clock
// time, unlike a cheap local read.
@ApiTags('landing-pages')
@Controller()
export class LandingPagesController {
  constructor(
    private readonly landingPages: LandingPagesService,
    private readonly prisma: PrismaService
  ) {}

  @Get('admin/products/:productId/landing-page')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  async get(@Param('productId') productId: string) {
    return this.landingPages.get(productId)
  }

  @Post('admin/products/:productId/landing-page/generate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  @Throttle({ default: { limit: 5, ttl: 5 * 60 * 1000 } })
  async generate(@Param('productId') productId: string, @Body() body: GenerateLandingPageDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.landingPages.generate(productId, body, actor)
  }

  @Post('admin/products/:productId/landing-page/sections/:sectionId/regenerate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  @Throttle({ default: { limit: 10, ttl: 5 * 60 * 1000 } })
  async regenerateSection(
    @Param('productId') productId: string,
    @Param('sectionId') sectionId: string,
    @Req() req: AuthedRequest
  ) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.landingPages.regenerateSection(productId, sectionId, actor)
  }

  @Put('admin/products/:productId/landing-page')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  async setEnabled(@Param('productId') productId: string, @Body() body: UpdateLandingPageDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.landingPages.setEnabled(productId, body.enabled, actor)
  }

  // Public — the storefront PDP fetches this by slug to decide whether to
  // render the generated long image instead of the normal gallery. Only
  // ever returns something when a completed, enabled landing page exists;
  // no admin/generation internals leak through.
  @Get('products/:slug/landing-page')
  async getPublic(@Param('slug') slug: string): Promise<PublicLandingPage | null> {
    const product = await this.prisma.product.findUnique({ where: { slug }, select: { id: true } })
    if (!product) throw new NotFoundException('Product not found')
    const landingPage = await this.landingPages.get(product.id)
    if (!landingPage?.enabled || landingPage.status !== 'Completed' || !landingPage.finalImageUrl) return null
    return { finalImageUrl: landingPage.finalImageUrl }
  }
}
