import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import {
  CreateProductAdTestSchema,
  CreateProductSourcingRequestSchema,
  CreateSourcedProductLinkSchema,
  CreateSourcedProductMediaSchema,
  CreateSourcedProductSchema,
  LinkSourcedProductSchema,
  ReorderSourcedProductMediaSchema,
  UpdateProductAdTestSchema,
  UpdateProductSourcingRequestSchema,
  UpdateSourcedProductLinkSchema,
  UpdateSourcedProductMediaSchema,
  UpdateSourcedProductSchema
} from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { SourcedProductsService } from './sourced-products.service'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import type { AuditActor } from '../common/audit.service'

class CreateSourcedProductDto extends createZodDto(CreateSourcedProductSchema) {}
class UpdateSourcedProductDto extends createZodDto(UpdateSourcedProductSchema) {}
class LinkSourcedProductDto extends createZodDto(LinkSourcedProductSchema) {}
class CreateProductAdTestDto extends createZodDto(CreateProductAdTestSchema) {}
class UpdateProductAdTestDto extends createZodDto(UpdateProductAdTestSchema) {}
class CreateProductSourcingRequestDto extends createZodDto(CreateProductSourcingRequestSchema) {}
class UpdateProductSourcingRequestDto extends createZodDto(UpdateProductSourcingRequestSchema) {}
class CreateSourcedProductMediaDto extends createZodDto(CreateSourcedProductMediaSchema) {}
class UpdateSourcedProductMediaDto extends createZodDto(UpdateSourcedProductMediaSchema) {}
class ReorderSourcedProductMediaDto extends createZodDto(ReorderSourcedProductMediaSchema) {}
class CreateSourcedProductLinkDto extends createZodDto(CreateSourcedProductLinkSchema) {}
class UpdateSourcedProductLinkDto extends createZodDto(UpdateSourcedProductLinkSchema) {}

interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

@ApiTags('sourcing-products')
@Controller('admin/sourcing/products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin', 'OpsManager')
export class SourcedProductsController {
  constructor(private readonly sourcedProducts: SourcedProductsService) {}

  @Get()
  list() {
    return this.sourcedProducts.list()
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.sourcedProducts.get(id)
  }

  @Post()
  create(@Body() body: CreateSourcedProductDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.sourcedProducts.create(body, actor)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateSourcedProductDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.sourcedProducts.update(id, body, actor)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.sourcedProducts.remove(id, actor)
  }

  @Post(':id/link')
  link(@Param('id') id: string, @Body() body: LinkSourcedProductDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.sourcedProducts.link(id, body, actor)
  }

  @Post(':id/ad-tests')
  createAdTest(@Param('id') id: string, @Body() body: CreateProductAdTestDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.sourcedProducts.createAdTest(id, body, actor)
  }

  @Patch('ad-tests/:testId')
  updateAdTest(@Param('testId') testId: string, @Body() body: UpdateProductAdTestDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.sourcedProducts.updateAdTest(testId, body, actor)
  }

  @Delete('ad-tests/:testId')
  removeAdTest(@Param('testId') testId: string, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.sourcedProducts.removeAdTest(testId, actor)
  }

  @Post(':id/requests')
  createRequest(@Param('id') id: string, @Body() body: CreateProductSourcingRequestDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.sourcedProducts.createRequest(id, body, actor)
  }

  @Patch('requests/:requestId')
  updateRequest(@Param('requestId') requestId: string, @Body() body: UpdateProductSourcingRequestDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.sourcedProducts.updateRequest(requestId, body, actor)
  }

  @Delete('requests/:requestId')
  removeRequest(@Param('requestId') requestId: string, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.sourcedProducts.removeRequest(requestId, actor)
  }

  // ---- Media (images/videos) ----
  // URLs are uploaded first via the existing generic POST /admin/upload or
  // /admin/upload-from-url (UploadController), then recorded here.

  @Post(':id/media')
  addMedia(@Param('id') id: string, @Body() body: CreateSourcedProductMediaDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.sourcedProducts.addMedia(id, body, actor)
  }

  @Patch('media/:mediaId')
  updateMedia(@Param('mediaId') mediaId: string, @Body() body: UpdateSourcedProductMediaDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.sourcedProducts.updateMedia(mediaId, body, actor)
  }

  @Delete('media/:mediaId')
  removeMedia(@Param('mediaId') mediaId: string, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.sourcedProducts.removeMedia(mediaId, actor)
  }

  @Post(':id/media/reorder')
  reorderMedia(@Param('id') id: string, @Body() body: ReorderSourcedProductMediaDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.sourcedProducts.reorderMedia(id, body, actor)
  }

  // ---- Links (where this product is listed elsewhere) ----

  @Post(':id/links')
  addLink(@Param('id') id: string, @Body() body: CreateSourcedProductLinkDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.sourcedProducts.addLink(id, body, actor)
  }

  @Patch('links/:linkId')
  updateLink(@Param('linkId') linkId: string, @Body() body: UpdateSourcedProductLinkDto, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.sourcedProducts.updateLink(linkId, body, actor)
  }

  @Delete('links/:linkId')
  removeLink(@Param('linkId') linkId: string, @Req() req: AuthedRequest) {
    const actor: AuditActor = { id: req.user.sub, email: req.user.email }
    return this.sourcedProducts.removeLink(linkId, actor)
  }
}
