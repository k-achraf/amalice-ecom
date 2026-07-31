import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import {
  AdjustStockSchema,
  CreateProductSchema,
  CreateProductOfferSchema,
  UpdateProductOfferSchema,
  UpdateWilayaShippingRatesSchema,
  AddOrderItemSchema,
  CreateProductUpsellSchema,
  UpdateProductUpsellSchema,
  OrderState,
  type AdjustStock,
  type CreateProduct
} from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { AdminCatalogService } from './admin-catalog.service'
import { AdminOrdersService } from './admin-orders.service'
import { AdminStatsService } from './admin-stats.service'
import { AdminUsersService } from './admin-users.service'
import { AdminProductManagementService } from './admin-product-management.service'
import { AdminShippingService } from './admin-shipping.service'
import { JwtAuthGuard } from '../identity/admin-auth/jwt-auth.guard'
import { RolesGuard } from '../identity/admin-auth/roles.guard'
import { Roles } from '../identity/admin-auth/roles.decorator'
import type { AdminJwtPayload } from '../identity/admin-auth/jwt-payload.interface'
import { AuditService, type AuditActor } from '../common/audit.service'
import { OrderItemsService } from '../order-items/order-items.service'

// The admin-facing API surface. Every route is JwtAuthGuard + role-gated
// (client-side nav hiding is UX only — plan §ADM-02). The actor for audit
// logging is the admin user from the verified JWT. Prefix /admin so it's
// cleanly separable from public routes in middleware/rate-limit config.

class CreateProductDto extends createZodDto(CreateProductSchema) {}
class AdjustStockDto extends createZodDto(AdjustStockSchema) {}
class CreateProductOfferDto extends createZodDto(CreateProductOfferSchema) {}
class UpdateProductOfferDto extends createZodDto(UpdateProductOfferSchema) {}
class UpdateWilayaShippingRatesDto extends createZodDto(UpdateWilayaShippingRatesSchema) {}
class AddOrderItemDto extends createZodDto(AddOrderItemSchema) {}
class CreateProductUpsellDto extends createZodDto(CreateProductUpsellSchema) {}
class UpdateProductUpsellDto extends createZodDto(UpdateProductUpsellSchema) {}

interface AuthedRequest extends Request {
  user: AdminJwtPayload
}

function actorFrom(req: AuthedRequest): AuditActor {
  return { id: req.user.sub, email: req.user.email }
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly orders: AdminOrdersService,
    private readonly catalog: AdminCatalogService,
    private readonly usersSvc: AdminUsersService,
    private readonly stats: AdminStatsService,
    private readonly productMgmt: AdminProductManagementService,
    private readonly shipping: AdminShippingService,
    private readonly audit: AuditService,
    private readonly orderItems: OrderItemsService
  ) {}

  // ---- ADM-09 dashboard ---------------------------------------------------
  @Get('stats')
  @Roles('SuperAdmin', 'OpsManager', 'Finance')
  dashboard() {
    return this.stats.dashboard()
  }

  @Get('stats/low-stock')
  @Roles('SuperAdmin', 'OpsManager', 'Warehouse')
  lowStock() {
    return this.catalog.lowStock()
  }

  // ---- ADM-04/05 orders ---------------------------------------------------
  @Get('orders')
  @Roles('SuperAdmin', 'OpsManager', 'Finance', 'Support')
  async listOrders(
    @Query('state') state: OrderState | undefined,
    @Query('search') search: string | undefined,
    @Query('courierId') courierId: string | undefined,
    @Query('from') fromIso: string | undefined,
    @Query('to') toIso: string | undefined,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20'
  ) {
    return this.orders.list({
      state,
      search,
      courierId,
      from: fromIso ? new Date(fromIso) : undefined,
      to: toIso ? new Date(toIso) : undefined,
      page: Number(page),
      pageSize: Number(pageSize)
    })
  }

  @Get('orders/:id')
  @Roles('SuperAdmin', 'OpsManager', 'Finance', 'Support')
  orderDetail(@Param('id') id: string) {
    return this.orders.findOne(id)
  }

  // Support included alongside SuperAdmin/OpsManager: call-center staff (the
  // Support role) need to perform the PendingCallCenter → Confirmed/
  // CallCenterNoAnswer/Cancelled transitions from their own queue page —
  // the same generic transition endpoint every other stage already uses.
  @Post('orders/:id/transition')
  @Roles('SuperAdmin', 'OpsManager', 'Support')
  transition(@Param('id') id: string, @Body() body: { to: OrderState }, @Req() req: AuthedRequest) {
    return this.orders.transition(id, body.to, actorFrom(req))
  }

  // Upsells system — call-center/admin manual add. Support included: a
  // call-center agent pitching an add-on during the confirmation call is
  // the primary use case, same reasoning as their access to transition().
  @Post('orders/:id/items')
  @Roles('SuperAdmin', 'OpsManager', 'Support')
  async addOrderItem(@Param('id') id: string, @Body() body: AddOrderItemDto, @Req() req: AuthedRequest) {
    await this.orderItems.addItem(id, body, actorFrom(req))
    // Re-fetch through AdminOrdersService so the response has the same
    // fully-joined shape (variantLabel, offer, etc.) as GET orders/:id —
    // OrderItemsService's own return value is intentionally minimal since
    // its other caller (the public upsell accept endpoint) doesn't need that.
    return this.orders.findOne(id)
  }

  // ---- ADM-07 catalog -----------------------------------------------------
  @Get('products/low-stock')
  @Roles('SuperAdmin', 'OpsManager', 'Warehouse')
  productsLowStock() {
    return this.catalog.lowStock()
  }

  @Post('products')
  @Roles('SuperAdmin', 'OpsManager')
  createProduct(@Body() body: CreateProductDto, @Req() req: AuthedRequest) {
    return this.catalog.createProduct(body as CreateProduct, actorFrom(req))
  }

  @Patch('products/:id')
  @Roles('SuperAdmin', 'OpsManager')
  updateProduct(@Param('id') id: string, @Body() body: Partial<CreateProductDto>, @Req() req: AuthedRequest) {
    return this.catalog.updateProduct(id, body as Partial<CreateProduct>, actorFrom(req))
  }

  @Post('products/:id/archive')
  @Roles('SuperAdmin', 'OpsManager')
  archive(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.catalog.archiveProduct(id, actorFrom(req))
  }

  @Post('products/:id/stock')
  @Roles('SuperAdmin', 'OpsManager', 'Warehouse')
  adjustStock(
    @Param('id') id: string,
    @Body() body: AdjustStockDto,
    @Req() req: AuthedRequest
  ) {
    return this.catalog.adjustStock(id, body as AdjustStock, actorFrom(req))
  }

  @Get('products/:id/stock-history')
  @Roles('SuperAdmin', 'OpsManager', 'Warehouse')
  stockHistory(@Param('id') id: string) {
    return this.catalog.stockHistory(id)
  }

  // ---- Full product management (variants, images, attributes) ------------

  // Full product detail for the editor — variants + options, images, attributes.
  @Get('products/:id')
  @Roles('SuperAdmin', 'OpsManager')
  productDetail(@Param('id') id: string) {
    return this.productMgmt.getProductForAdmin(id)
  }

  // Variants
  @Post('products/:id/variants')
  @Roles('SuperAdmin', 'OpsManager')
  createVariant(@Param('id') id: string, @Body() body: { sku: string; priceCents: number; stockQuantity: number; optionIds: string[] }, @Req() req: AuthedRequest) {
    return this.productMgmt.createVariant(id, body, actorFrom(req))
  }

  @Patch('products/:id/variants/:vid')
  @Roles('SuperAdmin', 'OpsManager')
  updateVariant(@Param('id') id: string, @Param('vid') vid: string, @Body() body: Record<string, unknown>, @Req() req: AuthedRequest) {
    return this.productMgmt.updateVariant(id, vid, body, actorFrom(req))
  }

  @Delete('products/:id/variants/:vid')
  @Roles('SuperAdmin', 'OpsManager')
  deleteVariant(@Param('id') id: string, @Param('vid') vid: string, @Req() req: AuthedRequest) {
    return this.productMgmt.deleteVariant(id, vid, actorFrom(req))
  }

  // Images
  @Post('products/:id/images')
  @Roles('SuperAdmin', 'OpsManager')
  addImage(@Param('id') id: string, @Body() body: { url: string; altText?: string; sortOrder?: number }, @Req() req: AuthedRequest) {
    return this.productMgmt.addImage(id, { ...body, sortOrder: body.sortOrder ?? 0 }, actorFrom(req))
  }

  @Patch('products/:id/images/:iid')
  @Roles('SuperAdmin', 'OpsManager')
  updateImage(@Param('id') id: string, @Param('iid') iid: string, @Body() body: Record<string, unknown>, @Req() req: AuthedRequest) {
    return this.productMgmt.updateImage(id, iid, body, actorFrom(req))
  }

  @Delete('products/:id/images/:iid')
  @Roles('SuperAdmin', 'OpsManager')
  deleteImage(@Param('id') id: string, @Param('iid') iid: string, @Req() req: AuthedRequest) {
    return this.productMgmt.deleteImage(id, iid, actorFrom(req))
  }

  @Post('products/:id/reorder-images')
  @Roles('SuperAdmin', 'OpsManager')
  reorderImages(@Param('id') id: string, @Body() body: { orderedIds: string[] }, @Req() req: AuthedRequest) {
    return this.productMgmt.reorderImages(id, body.orderedIds, actorFrom(req))
  }

  // Offers (buy-X bundle price / buy-X-get-Y-free / free-shipping badge)
  @Post('products/:id/offers')
  @Roles('SuperAdmin', 'OpsManager')
  createOffer(@Param('id') id: string, @Body() body: CreateProductOfferDto, @Req() req: AuthedRequest) {
    return this.productMgmt.createOffer(id, body, actorFrom(req))
  }

  @Patch('products/:id/offers/:oid')
  @Roles('SuperAdmin', 'OpsManager')
  updateOffer(@Param('id') id: string, @Param('oid') oid: string, @Body() body: UpdateProductOfferDto, @Req() req: AuthedRequest) {
    return this.productMgmt.updateOffer(id, oid, body, actorFrom(req))
  }

  @Delete('products/:id/offers/:oid')
  @Roles('SuperAdmin', 'OpsManager')
  deleteOffer(@Param('id') id: string, @Param('oid') oid: string, @Req() req: AuthedRequest) {
    return this.productMgmt.deleteOffer(id, oid, actorFrom(req))
  }

  // Upsells system — which product(s) get suggested when this one is
  // bought (see ProductUpsell's Prisma comment).
  @Get('products/:id/upsells')
  @Roles('SuperAdmin', 'OpsManager')
  listUpsells(@Param('id') id: string) {
    return this.productMgmt.listUpsells(id)
  }

  @Post('products/:id/upsells')
  @Roles('SuperAdmin', 'OpsManager')
  createUpsell(@Param('id') id: string, @Body() body: CreateProductUpsellDto, @Req() req: AuthedRequest) {
    return this.productMgmt.createUpsell(id, body, actorFrom(req))
  }

  @Patch('products/:id/upsells/:uid')
  @Roles('SuperAdmin', 'OpsManager')
  updateUpsell(@Param('id') id: string, @Param('uid') uid: string, @Body() body: UpdateProductUpsellDto, @Req() req: AuthedRequest) {
    return this.productMgmt.updateUpsell(id, uid, body, actorFrom(req))
  }

  @Delete('products/:id/upsells/:uid')
  @Roles('SuperAdmin', 'OpsManager')
  deleteUpsell(@Param('id') id: string, @Param('uid') uid: string, @Req() req: AuthedRequest) {
    return this.productMgmt.deleteUpsell(id, uid, actorFrom(req))
  }

  // ---- Shipping (per-wilaya home/desk delivery pricing) -------------------
  @Get('shipping/rates')
  @Roles('SuperAdmin', 'OpsManager')
  listShippingRates() {
    return this.shipping.listRates()
  }

  @Put('shipping/rates')
  @Roles('SuperAdmin', 'OpsManager')
  updateShippingRates(@Body() body: UpdateWilayaShippingRatesDto, @Req() req: AuthedRequest) {
    return this.shipping.updateRates(body, actorFrom(req))
  }

  // Product-attribute management (which attributes a product varies on)
  @Post('products/:id/attributes/:attrId')
  @Roles('SuperAdmin', 'OpsManager')
  applyAttribute(@Param('id') id: string, @Param('attrId') attrId: string, @Req() req: AuthedRequest) {
    return this.productMgmt.applyAttribute(id, attrId, actorFrom(req))
  }

  @Delete('products/:id/attributes/:attrId')
  @Roles('SuperAdmin', 'OpsManager')
  removeAttribute(@Param('id') id: string, @Param('attrId') attrId: string, @Req() req: AuthedRequest) {
    return this.productMgmt.removeAttribute(id, attrId, actorFrom(req))
  }

  // Store-wide attribute management
  @Get('attributes')
  @Roles('SuperAdmin', 'OpsManager')
  listAttributes() {
    return this.productMgmt.listAttributes()
  }

  @Post('attributes')
  @Roles('SuperAdmin')
  createAttribute(@Body() body: { name: string; type?: string }, @Req() req: AuthedRequest) {
    return this.productMgmt.createAttribute({ name: body.name, type: (body.type as 'Text' | 'Color' | 'Number') ?? 'Text' }, actorFrom(req))
  }

  @Post('attributes/:id/options')
  @Roles('SuperAdmin')
  addOption(@Param('id') id: string, @Body() body: { value: string; displayValue?: string; colorHex?: string }, @Req() req: AuthedRequest) {
    return this.productMgmt.addOption(id, body, actorFrom(req))
  }

  @Delete('attributes/:id')
  @Roles('SuperAdmin')
  deleteAttribute(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.productMgmt.deleteAttribute(id, actorFrom(req))
  }

  // ---- ADM-06 users & roles ----------------------------------------------
  @Get('users')
  @Roles('SuperAdmin')
  users() {
    return this.usersSvc.list()
  }

  @Get('roles')
  @Roles('SuperAdmin')
  roles() {
    return this.usersSvc.roles()
  }

  @Post('users')
  @Roles('SuperAdmin')
  createUser(@Body() body: { email: string; password: string; roleId: string }, @Req() req: AuthedRequest) {
    return this.usersSvc.create(body, actorFrom(req))
  }

  @Post('users/:id/deactivate')
  @Roles('SuperAdmin')
  deactivate(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.usersSvc.setActive(id, false, actorFrom(req))
  }

  @Post('users/:id/reactivate')
  @Roles('SuperAdmin')
  reactivate(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.usersSvc.setActive(id, true, actorFrom(req))
  }

  // ---- ADM-10 customers ---------------------------------------------------
  @Get('customers')
  @Roles('SuperAdmin', 'OpsManager', 'Finance', 'Support')
  async customers(
    @Query('search') search: string | undefined,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Req() req: AuthedRequest
  ) {
    const result = await this.stats.listCustomers({ search, page: Number(page), pageSize: Number(pageSize) })
    // PII scoping (plan §11): mask the phone except for Support/Ops, who need
    // it to contact customers. Server-enforced — the masked shape is what the
    // API returns, never a client-side hide.
    const canSeePhone = req.user.role === 'Support' || req.user.role === 'OpsManager'
    if (!canSeePhone) {
      result.items = result.items.map((c) => ({ ...c, phone: maskPhone(c.phone) }))
    }
    return result
  }

  @Get('customers/:id')
  @Roles('SuperAdmin', 'OpsManager', 'Support')
  async customerDetail(@Param('id') id: string, @Req() req: AuthedRequest) {
    const customer = await this.stats.findCustomer(id)
    if (!customer) throw new NotFoundException('Customer not found')
    const canSeePhone = req.user.role === 'Support' || req.user.role === 'OpsManager'
    if (!canSeePhone) {
      ;(customer as { phone: string }).phone = maskPhone(customer.phone)
    }
    return customer
  }

  // ---- ADM-08 audit log ---------------------------------------------------
  @Get('audit')
  @Roles('SuperAdmin', 'Finance', 'OpsManager')
  async auditLog(
    @Query('entity') entity: string | undefined,
    @Query('actorId') actorId: string | undefined,
    @Query('from') fromIso: string | undefined,
    @Query('to') toIso: string | undefined,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '50'
  ) {
    return this.audit.list({
      entity,
      actorId,
      from: fromIso ? new Date(fromIso) : undefined,
      to: toIso ? new Date(toIso) : undefined,
      page: Number(page),
      pageSize: Number(pageSize)
    })
  }
}

// Keep the last 4 digits, mask the rest — enough for a customer to confirm
// "yes that's my number" over support, not enough to harvest.
function maskPhone(phone: string): string {
  if (phone.length <= 4) return '****'
  return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4)
}
