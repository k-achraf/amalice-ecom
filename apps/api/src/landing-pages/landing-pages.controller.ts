import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import {
  GenerateLandingPageSchema,
  ImproveLandingPageDescriptionSchema,
  RegenerateLandingPageSectionSchema,
  UpdateLandingPageSchema,
  type PublicLandingPage
} from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { LandingPagesService } from './landing-pages.service'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import type { AuditActor } from '../common/audit.service'

class GenerateLandingPageDto extends createZodDto(GenerateLandingPageSchema) {}
class UpdateLandingPageDto extends createZodDto(UpdateLandingPageSchema) {}
class RegenerateLandingPageSectionDto extends createZodDto(RegenerateLandingPageSectionSchema) {}
class ImproveLandingPageDescriptionDto extends createZodDto(ImproveLandingPageDescriptionSchema) {}

interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

// Admin surface (SuperAdmin/OpsManager, same roles as product image
// management in upload.controller.ts) plus one public read for the
// storefront's /lp/:productSlug/:number page. AI generation calls are
// throttled tighter than default — each one costs real (if free-tier) API
// quota and takes real wall-clock time, unlike a cheap local read. A product
// can have multiple landing pages — routes are id-addressable
// (.../landing-pages/:id) once a page exists, product-scoped
// (.../products/:productId/landing-pages) only for listing and creating a
// new one.
@ApiTags('landing-pages')
@Controller()
export class LandingPagesController {
  constructor(private readonly landingPages: LandingPagesService) {}

  // "Improve with AI" on the generation form's "description to generate
  // from" field — not product-scoped (pure text in/out, no DB access), so
  // it lives ahead of the product-scoped routes below and works before a
  // landing page (or even this generation attempt) is ever created.
  @Post('admin/landing-pages/improve-description')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  @Throttle({ default: { limit: 10, ttl: 5 * 60 * 1000 } })
  improveDescription(@Body() body: ImproveLandingPageDescriptionDto) {
    return this.landingPages.improveDescription(body)
  }

  @Get('admin/products/:productId/landing-pages')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  list(@Param('productId') productId: string) {
    return this.landingPages.list(productId)
  }

  @Post('admin/products/:productId/landing-pages')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  @Throttle({ default: { limit: 5, ttl: 5 * 60 * 1000 } })
  async generate(@Param('productId') productId: string, @Body() body: GenerateLandingPageDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.landingPages.generate(productId, body, actor)
  }

  @Get('admin/landing-pages/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  async get(@Param('id') id: string) {
    const row = await this.landingPages.getById(id)
    if (!row) throw new NotFoundException('Landing page not found')
    return row
  }

  @Post('admin/landing-pages/:id/sections/:sectionId/regenerate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  @Throttle({ default: { limit: 10, ttl: 5 * 60 * 1000 } })
  async regenerateSection(
    @Param('id') id: string,
    @Param('sectionId') sectionId: string,
    @Body() body: RegenerateLandingPageSectionDto,
    @Req() req: AuthedRequest
  ) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.landingPages.regenerateSection(id, sectionId, actor, body.instructions)
  }

  @Put('admin/landing-pages/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  async update(@Param('id') id: string, @Body() body: UpdateLandingPageDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.landingPages.update(id, body, actor)
  }

  @Delete('admin/landing-pages/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin', 'OpsManager')
  async remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    await this.landingPages.remove(id, actor)
    return { ok: true }
  }

  // Public — the storefront's standalone /lp/:productSlug/:number page (no
  // header/nav, just the stitched image + a lead form). Only ever returns
  // something for a completed, enabled landing page; no admin/generation
  // internals leak through.
  @Get('landing-pages/:productSlug/:number')
  async getPublic(@Param('productSlug') productSlug: string, @Param('number') numberParam: string): Promise<PublicLandingPage> {
    const number = Number(numberParam)
    if (!Number.isInteger(number) || number < 1) throw new NotFoundException('Landing page not found')
    const landingPage = await this.landingPages.getPublicByProductSlugAndNumber(productSlug, number)
    if (!landingPage) throw new NotFoundException('Landing page not found')
    return landingPage
  }
}
