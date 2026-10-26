import { AdminInventoryService } from './admin-inventory.service'
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
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
import { Throttle } from '@nestjs/throttler'
import {
  AdjustStockSchema, SupplierInputSchema, StocktakeSchema,
  CreateProductSchema,
  CreateProductOfferSchema,
  UpdateProductOfferSchema,
  UpdateWilayaShippingRatesSchema,
  AddOrderItemSchema,
  UpdateOrderItemSchema,
  CreateProductUpsellSchema,
  UpdateProductUpsellSchema,
  UpdateOrderNotesSchema,
  LogCallSchema,
  BulkDeleteOrdersSchema,
  CALL_CENTER_WORK_STATES,
  CALL_CENTER_VIEW_STATES,
  UpdateOrderPriceSchema,
  TransitionOrderSchema,
  UpdateOrderCustomerInfoSchema,
  OrderState,
  TIMELINE_CATEGORIES,
  DELIVERY_STAGES,
  type DeliveryStage,
  type TimelineCategory,
  ProductListQuerySchema,
  GenerateProductContentSchema,
  CreateBlacklistEntrySchema,
  UpdateBlacklistEntrySchema,
  BlacklistTypeSchema,
  BlacklistActionSchema,
  RiskLevelSchema,
  type AdjustStock,
  type CreateProduct
} from '@amalice/shared'
import { createZodDto } from 'nestjs-zod'
import type { Request } from 'express'
import { AdminCatalogService } from './admin-catalog.service'
import { AdminOrdersService } from './admin-orders.service'
import { AdminCallCenterService } from './admin-call-center.service'
import { AdminDeleteService } from './admin-delete.service'
import { AdminOrderTimelineService } from './admin-order-timeline.service'
import { AdminDeliveriesService } from './admin-deliveries.service'
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
import { RiskService } from '../risk/risk.service'
import { AddressNormalizerService } from '../ai/address-normalizer.service'
import { DeliveryTriageService } from '../ai/delivery-triage.service'

// The admin-facing API surface. Every route is JwtAuthGuard + role-gated
// (client-side nav hiding is UX only — plan §ADM-02). The actor for audit
// logging is the admin user from the verified JWT. Prefix /admin so it's
// cleanly separable from public routes in middleware/rate-limit config.

class CreateProductDto extends createZodDto(CreateProductSchema) {}
class AdjustStockDto extends createZodDto(AdjustStockSchema) {}
class SupplierDto extends createZodDto(SupplierInputSchema) {}
class StocktakeDto extends createZodDto(StocktakeSchema) {}
class CreateProductOfferDto extends createZodDto(CreateProductOfferSchema) {}
class UpdateProductOfferDto extends createZodDto(UpdateProductOfferSchema) {}
class UpdateWilayaShippingRatesDto extends createZodDto(UpdateWilayaShippingRatesSchema) {}
class AddOrderItemDto extends createZodDto(AddOrderItemSchema) {}
class UpdateOrderItemDto extends createZodDto(UpdateOrderItemSchema) {}
class CreateProductUpsellDto extends createZodDto(CreateProductUpsellSchema) {}
class UpdateProductUpsellDto extends createZodDto(UpdateProductUpsellSchema) {}
class UpdateOrderNotesDto extends createZodDto(UpdateOrderNotesSchema) {}
class UpdateOrderPriceDto extends createZodDto(UpdateOrderPriceSchema) {}
class TransitionOrderDto extends createZodDto(TransitionOrderSchema) {}
class CreateBlacklistEntryDto extends createZodDto(CreateBlacklistEntrySchema) {}
class UpdateBlacklistEntryDto extends createZodDto(UpdateBlacklistEntrySchema) {}
class LogCallDto extends createZodDto(LogCallSchema) {}
class BulkDeleteOrdersDto extends createZodDto(BulkDeleteOrdersSchema) {}
class UpdateOrderCustomerInfoDto extends createZodDto(UpdateOrderCustomerInfoSchema) {}
class ProductListQueryDto extends createZodDto(ProductListQuerySchema) {}
class GenerateProductContentDto extends createZodDto(GenerateProductContentSchema) {}

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
    private readonly callCenter: AdminCallCenterService,
    private readonly deleter: AdminDeleteService,
    private readonly timeline: AdminOrderTimelineService,
    private readonly deliveries: AdminDeliveriesService,
    private readonly catalog: AdminCatalogService,
    private readonly usersSvc: AdminUsersService,
    private readonly stats: AdminStatsService,
    private readonly productMgmt: AdminProductManagementService,
    private readonly shipping: AdminShippingService,
    private readonly audit: AuditService,
    private readonly orderItems: OrderItemsService,
    private readonly risk: RiskService,
    private readonly inventory: AdminInventoryService,
    private readonly addressNormalizer: AddressNormalizerService,
    private readonly deliveryTriage: DeliveryTriageService
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
  // CallCenterAgent included: call-center/index.vue's 4 queues (Pending/
  // NoAnswer/WrongNumber/Postponed) are just filtered calls to this same
  // endpoint — there's no separate "call-center-only" list endpoint to
  // scope them to instead. The actual "don't let them browse the full,
  // unfiltered order pipeline" boundary is the Orders nav link/page being
  // hidden from them client-side (see layouts/default.vue), same
  // client-gate-only pattern as everywhere else in this app.
  @Get('orders')
  @Roles('SuperAdmin', 'OpsManager', 'Finance', 'Support', 'CallCenterAgent')
  async listOrders(
    @Query('state') state: OrderState | undefined,
    @Query('search') search: string | undefined,
    @Query('courierId') courierId: string | undefined,
    @Query('funnelId') funnelId: string | undefined,
    @Query('riskLevel') riskLevel: string | undefined,
    @Query('from') fromIso: string | undefined,
    @Query('to') toIso: string | undefined,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20',
    @Query('abandoned') abandoned: 'only' | 'exclude' | undefined,
    @Query('archived') archived: 'only' | 'exclude' | undefined,
    @Query('sort') sort: 'oldest' | 'followup' | undefined,
    // 'callcenter' = every order that is in, or just left, the call center
    @Query('scope') scope: 'callcenter' | undefined,
    @Req() req: AuthedRequest
  ) {
    // A CallCenterAgent only ever sees the call-center queues — this is the
    // real boundary (hiding the Orders nav link is just UX).
    const agentOnly = req.user.role === 'CallCenterAgent'
    if (agentOnly && state && !CALL_CENTER_VIEW_STATES.includes(state)) {
      throw new ForbiddenException('Call-center agents can only list call-center orders')
    }
    return this.orders.list({
      state,
      states: agentOnly || scope === 'callcenter' ? CALL_CENTER_VIEW_STATES : undefined,
      sort,
      search,
      courierId,
      funnelId,
      riskLevel: riskLevel ? RiskLevelSchema.parse(riskLevel) : undefined,
      from: fromIso ? new Date(fromIso) : undefined,
      to: toIso ? new Date(toIso) : undefined,
      page: Number(page),
      pageSize: Number(pageSize),
      abandoned,
      archived
    })
  }

  // ---- Delivery details: every order sent to a shipping company ------------
  @Get('deliveries')
  @Roles('SuperAdmin', 'OpsManager', 'Finance', 'Support', 'Warehouse')
  deliveryList(
    @Query('stage') stage: string | undefined,
    @Query('company') company: string | undefined,
    @Query('search') search: string | undefined,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '25'
  ) {
    return this.deliveries.list({
      stage: DELIVERY_STAGES.includes(stage as DeliveryStage) ? (stage as DeliveryStage) : 'all',
      companyId: company || undefined,
      search: search || undefined,
      page: Math.max(Number(page) || 1, 1),
      pageSize: Math.min(Math.max(Number(pageSize) || 25, 1), 100)
    })
  }

  // ---- Order tracking -------------------------------------------------------
  // Latest operations across all orders (status changes, edits, calls, courier
  // events). Registered before orders/:id so "activity" isn't taken as an id.
  @Get('orders/activity')
  @Roles('SuperAdmin', 'OpsManager')
  orderActivity(
    @Query('before') before: string | undefined,
    @Query('limit') limit: string = '50',
    @Query('category') category: string | undefined,
    @Query('actor') actor: string | undefined
  ) {
    const parsed = before ? new Date(before) : undefined
    return this.timeline.activity({
      before: parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined,
      limit: Math.min(Math.max(Number(limit) || 50, 1), 200),
      category: TIMELINE_CATEGORIES.includes(category as TimelineCategory) ? (category as TimelineCategory) : undefined,
      actor: actor?.trim() || undefined
    })
  }

  // Everything that happened to one order, oldest first, with milestones.
  @Get('orders/:id/timeline')
  @Roles('SuperAdmin', 'OpsManager', 'Finance', 'Support', 'Warehouse', 'CallCenterAgent')
  orderTimeline(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.timeline.timeline(id, req.user.role)
  }

  // ---- Call center -------------------------------------------------------
  // Registered before orders/:id so these literal paths aren't swallowed as an :id.
  @Post('call-center/claim-next')
  @Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
  claimNext(@Req() req: AuthedRequest) {
    return this.callCenter.claimNext(actorFrom(req))
  }

  @Get('call-center/stats')
  @Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
  callCenterStats(@Req() req: AuthedRequest) {
    return this.callCenter.stats(actorFrom(req))
  }

  // Per-agent performance and conversion reporting: managers only.
  @Get('call-center/report')
  @Roles('SuperAdmin', 'OpsManager')
  callCenterReport(@Query('from') fromIso: string | undefined, @Query('to') toIso: string | undefined) {
    const to = toIso ? new Date(toIso) : new Date()
    const from = fromIso ? new Date(fromIso) : new Date(to.getTime() - 7 * 24 * 3600 * 1000)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new ForbiddenException('Invalid date range')
    return this.callCenter.report(from, to)
  }

  @Post('orders/:id/call')
  @Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
  logCall(@Param('id') id: string, @Body() body: LogCallDto, @Req() req: AuthedRequest) {
    const manager = req.user.role === 'SuperAdmin' || req.user.role === 'OpsManager'
    return this.callCenter.logCall(id, body, actorFrom(req), manager)
  }

  @Get('orders/:id/calls')
  @Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
  orderCalls(@Param('id') id: string) {
    return this.callCenter.calls(id)
  }

  @Get('orders/:id/customer-history')
  @Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
  customerHistory(@Param('id') id: string) {
    return this.callCenter.customerHistory(id)
  }

  @Post('orders/:id/lock')
  @Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
  lockOrder(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.callCenter.touchLock(id, actorFrom(req))
  }

  @Post('orders/:id/release')
  @Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
  releaseOrder(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.callCenter.release(id, actorFrom(req))
  }

  @Post('orders/:id/skip')
  @Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
  skipOrder(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.callCenter.skip(id, actorFrom(req))
  }

  // CallCenterAgent included: an order reached via their own Call Center/
  // Drop Queue pages links here for the full detail view.
  @Get('orders/:id')
  @Roles('SuperAdmin', 'OpsManager', 'Finance', 'Support', 'CallCenterAgent')
  async orderDetail(@Param('id') id: string, @Req() req: AuthedRequest) {
    const order = await this.orders.findOne(id)
    // Agents may open orders still in (or just confirmed out of) the call center.
    if (req.user.role === 'CallCenterAgent' && !CALL_CENTER_VIEW_STATES.includes(order.state)) {
      throw new ForbiddenException('This order is outside the call center')
    }
    return order
  }

  // Soft-hide (see Order.archived's Prisma comment) — scoped tighter than
  // most order actions (no Support/CallCenterAgent) since this changes
  // which orders the whole team sees by default, not just this one order's
  // own state.
  @Post('orders/:id/archive')
  @Roles('SuperAdmin', 'OpsManager')
  archiveOrder(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.orders.archiveOrder(id, actorFrom(req))
  }

  @Post('orders/:id/unarchive')
  @Roles('SuperAdmin', 'OpsManager')
  unarchiveOrder(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.orders.unarchiveOrder(id, actorFrom(req))
  }

  // Support/CallCenterAgent included alongside SuperAdmin/OpsManager:
  // call-center staff need to perform the PendingCallCenter → Confirmed/
  // CallCenterNoAnswer/Cancelled transitions from their own queue page —
  // the same generic transition endpoint every other stage already uses.
  @Post('orders/:id/transition')
  @Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
  transition(@Param('id') id: string, @Body() body: TransitionOrderDto, @Req() req: AuthedRequest) {
    return this.orders.transition(id, body.to, actorFrom(req), body.postponedUntil, req.user.role)
  }

  // Call-center notes — free text, same role set as transition() since it's
  // the same call-center queue action.
  @Patch('orders/:id/notes')
  @Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
  updateNotes(@Param('id') id: string, @Body() body: UpdateOrderNotesDto, @Req() req: AuthedRequest) {
    return this.orders.updateNotes(id, body.notes, actorFrom(req))
  }

  // Customer/address/shipping-method correction (ADM-14) — same role set as
  // updatePrice() since it's the same call-center confirmation-step action;
  // "only before Confirmed" is enforced server-side in
  // AdminOrdersService.updateCustomerInfo, not here.
  @Patch('orders/:id/customer-info')
  @Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
  updateCustomerInfo(@Param('id') id: string, @Body() body: UpdateOrderCustomerInfoDto, @Req() req: AuthedRequest) {
    return this.orders.updateCustomerInfo(id, body, actorFrom(req))
  }

  // AI address cleanup: read-only suggestion (wilaya / commune / street line
  // matched against the real wilayas + communes tables). Nothing is saved —
  // the agent applies it through PATCH orders/:id/customer-info above, which
  // enforces the pre-Confirmed window and writes the audit log.
  @Post('orders/:id/address-suggestion')
  @Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
  addressSuggestion(@Param('id') id: string) {
    return this.addressNormalizer.suggestForOrder(id)
  }

  // AI triage of the delivery company's notes (driver remarks, failed-attempt
  // reasons): category + suggested next step. Read-only; cached per set of notes.
  @Post('orders/:id/delivery-triage')
  @HttpCode(200)
  @Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  triageDelivery(@Param('id') id: string) {
    return this.deliveryTriage.triageOrder(id)
  }

  // Call-center price override (ADM-12) — same role set as transition()/
  // updateNotes() since it's the same call-center queue action; the actual
  // "only before Confirmed" enforcement lives server-side in
  // AdminOrdersService.updatePrice, not here.
  @Patch('orders/:id/price')
  @Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
  updatePrice(@Param('id') id: string, @Body() body: UpdateOrderPriceDto, @Req() req: AuthedRequest) {
    return this.orders.updatePrice(id, body, actorFrom(req))
  }

  // Upsells system — call-center/admin manual add. Support/CallCenterAgent
  // included: a call-center agent pitching an add-on during the
  // confirmation call is the primary use case, same reasoning as their
  // access to transition().
  @Post('orders/:id/items')
  @Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
  async addOrderItem(@Param('id') id: string, @Body() body: AddOrderItemDto, @Req() req: AuthedRequest) {
    await this.orderItems.addItem(id, body, actorFrom(req))
    // Re-fetch through AdminOrdersService so the response has the same
    // fully-joined shape (variantLabel, offer, etc.) as GET orders/:id —
    // OrderItemsService's own return value is intentionally minimal since
    // its other caller (the public upsell accept endpoint) doesn't need that.
    return this.orders.findOne(id)
  }

  @Patch('orders/:id/items/:itemId')
  @Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
  async updateOrderItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() body: UpdateOrderItemDto, @Req() req: AuthedRequest) {
    await this.orderItems.updateItem(id, itemId, body, actorFrom(req))
    return this.orders.findOne(id)
  }

  @Delete('orders/:id/items/:itemId')
  @Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
  async removeOrderItem(@Param('id') id: string, @Param('itemId') itemId: string, @Req() req: AuthedRequest) {
    await this.orderItems.removeItem(id, itemId, actorFrom(req))
    return this.orders.findOne(id)
  }

  // ---- ADM-07 catalog -----------------------------------------------------
  // Admin's own product listing — sees every product regardless of
  // Product.visible (unlike the storefront's public GET /products, which
  // filters hidden ones out). The inventory table must always show hidden
  // products, just badged, so they stay fully manageable.
  @Get('products')
  @Roles('SuperAdmin', 'OpsManager', 'Warehouse')
  listProducts(@Query() query: ProductListQueryDto) {
    return this.catalog.listProducts(query)
  }

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

  // "Generate with AI" (product editor's Details/Content tabs) — a real,
  // if free-tier, Gemini call, so throttled tighter than a normal PATCH.
  // Returns a draft only; nothing is written until the admin saves it via
  // updateProduct() above.
  @Post('products/:id/generate-content')
  @Roles('SuperAdmin', 'OpsManager')
  @Throttle({ default: { limit: 10, ttl: 5 * 60 * 1000 } })
  generateContent(@Param('id') id: string, @Body() body: GenerateProductContentDto, @Req() req: AuthedRequest) {
    return this.productMgmt.generateContent(id, body, actorFrom(req))
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
    const input = body as AdjustStock
    if (input.variantId) return this.inventory.adjustVariant(input.variantId, input, actorFrom(req))
    return this.catalog.adjustStock(id, input, actorFrom(req))
  }

  @Get('inventory/low-stock-variants')
  @Roles('SuperAdmin', 'OpsManager', 'Warehouse')
  lowStockVariants() {
    return this.inventory.lowStockVariants()
  }

  @Post('orders/restock-returns')
  @Roles('SuperAdmin', 'OpsManager', 'Warehouse')
  restockReturns(@Body() body: { orderIds: string[] }, @Req() req: AuthedRequest) {
    if (!Array.isArray(body?.orderIds) || !body.orderIds.length || body.orderIds.length > 200) throw new BadRequestException('orderIds required (max 200)')
    return this.orders.bulkRestock(body.orderIds, actorFrom(req))
  }

  @Get('inventory/count-sheet')
  @Roles('SuperAdmin', 'OpsManager', 'Warehouse')
  countSheet() {
    return this.inventory.countSheet()
  }

  @Post('inventory/stocktake')
  @Roles('SuperAdmin', 'OpsManager', 'Warehouse')
  stocktake(@Body() body: StocktakeDto, @Req() req: AuthedRequest) {
    return this.inventory.applyStocktake(body, actorFrom(req))
  }

  @Get('suppliers')
  @Roles('SuperAdmin', 'OpsManager', 'Warehouse')
  suppliers() {
    return this.inventory.listSuppliers()
  }

  @Post('suppliers')
  @Roles('SuperAdmin', 'OpsManager')
  createSupplier(@Body() body: SupplierDto) {
    return this.inventory.createSupplier(body)
  }

  @Patch('suppliers/:id')
  @Roles('SuperAdmin', 'OpsManager')
  updateSupplier(@Param('id') id: string, @Body() body: SupplierDto) {
    return this.inventory.updateSupplier(id, body)
  }

  @Get('suppliers/:id/history')
  @Roles('SuperAdmin', 'OpsManager', 'Warehouse')
  supplierHistory(@Param('id') id: string) {
    return this.inventory.supplierHistory(id)
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

  // ---- Permanent deletion: SuperAdmin only ----------------------------------
  // Real deletes (see AdminDeleteService) — every one is audit-logged with a
  // snapshot. Everyone else can only archive/hide.
  @Delete('orders/:id')
  @Roles('SuperAdmin')
  deleteOrder(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.deleter.deleteOrder(id, actorFrom(req))
  }

  @Post('orders/bulk-delete')
  @Roles('SuperAdmin')
  bulkDeleteOrders(@Body() body: BulkDeleteOrdersDto, @Req() req: AuthedRequest) {
    return this.deleter.deleteOrders(body.orderIds, actorFrom(req))
  }

  @Delete('products/:id')
  @Roles('SuperAdmin')
  deleteProduct(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.deleter.deleteProduct(id, actorFrom(req))
  }

  @Delete('customers/:id')
  @Roles('SuperAdmin')
  deleteCustomer(@Param('id') id: string, @Query('withOrders') withOrders: string | undefined, @Req() req: AuthedRequest) {
    return this.deleter.deleteCustomer(id, withOrders === '1' || withOrders === 'true', actorFrom(req))
  }

  @Delete('users/:id')
  @Roles('SuperAdmin')
  deleteAdminUser(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.deleter.deleteAdminUser(id, actorFrom(req))
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

  // ---- Fake / returned-order blacklist --------------------------------------
  // One list shared by every admin. Agents see the risk badge on orders but
  // only managers/support edit the list.
  @Get('blacklist')
  @Roles('SuperAdmin', 'OpsManager', 'Support')
  listBlacklist(
    @Query('type') type: string | undefined,
    @Query('action') action: string | undefined,
    @Query('search') search: string | undefined,
    @Query('released') released: string | undefined,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '20'
  ) {
    return this.risk.list({
      type: type ? BlacklistTypeSchema.parse(type) : undefined,
      action: action ? BlacklistActionSchema.parse(action) : undefined,
      search,
      includeReleased: released === '1',
      page: Number(page),
      pageSize: Number(pageSize)
    })
  }

  @Post('blacklist')
  @Roles('SuperAdmin', 'OpsManager', 'Support')
  addToBlacklist(@Body() body: CreateBlacklistEntryDto, @Req() req: AuthedRequest) {
    return this.risk.create(body, actorFrom(req))
  }

  @Patch('blacklist/:id')
  @Roles('SuperAdmin', 'OpsManager', 'Support')
  updateBlacklist(@Param('id') id: string, @Body() body: UpdateBlacklistEntryDto, @Req() req: AuthedRequest) {
    return this.risk.update(id, body, actorFrom(req))
  }

  @Delete('blacklist/:id')
  @Roles('SuperAdmin', 'OpsManager', 'Support')
  releaseBlacklist(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.risk.release(id, actorFrom(req))
  }

  // Active blacklist entries matching this order's phone / address.
  @Get('orders/:id/blacklist')
  @Roles('SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent')
  orderBlacklist(@Param('id') id: string) {
    return this.risk.entriesForOrder(id)
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
