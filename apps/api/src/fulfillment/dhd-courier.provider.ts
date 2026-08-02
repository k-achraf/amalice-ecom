import { BadRequestException, Injectable, NotImplementedException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { DhdApiService, type DhdOrderPayload } from '../shipping-companies/dhd-api.service'
import { ShippingCompaniesService } from '../shipping-companies/shipping-companies.service'
import type {
  CourierProvider,
  CourierWebhookPayload,
  CreateShipmentInput,
  NormalizedCourierStatus,
  ShipmentResult
} from './courier-provider.interface'

// COU-02 — the real courier adapter, backing onto DHD's "Commandes" API
// (see dhd-api.service.ts's header comment for where the field shapes come
// from). This is the "swap the COURIER_PROVIDER binding" seam
// courier-provider.interface.ts's own header comment anticipated.
//
// Unlike MockCourierProvider, this has no in-memory state — every call
// re-resolves the default linked shipping company (Settings → Shipping
// Companies — see ShippingCompaniesService.getDefaultLinked's comment on
// what "default" means with one vs. several linked providers) and talks to
// the real DHD API.
@Injectable()
export class DhdCourierProvider implements CourierProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dhd: DhdApiService,
    private readonly shippingCompanies: ShippingCompaniesService
  ) {}

  private async company() {
    const company = await this.shippingCompanies.getDefaultLinked()
    if (company.provider !== 'Dhd') {
      throw new BadRequestException(`The default shipping company (${company.name}) isn't DHD — this adapter only speaks DHD's API.`)
    }
    return { baseUrl: company.baseUrl, apiToken: company.apiToken }
  }

  // Order.address.region stores the wilaya's NAME (see orders.service.ts's
  // createLeadOrder comment — it's populated from priceShipping's
  // authoritative wilayaName lookup at order time), but DHD's create/order
  // wants code_wilaya, a numeric code. Wilaya.id IS that code as a string
  // (see ShippingCompaniesService.syncTariffs's comment: DHD's wilaya_id and
  // our Wilaya.id are the same natural key) — resolve name -> id here.
  private async wilayaCode(regionName: string): Promise<string> {
    const wilaya = await this.prisma.wilaya.findFirst({ where: { name: regionName } })
    if (!wilaya) throw new BadRequestException(`Unknown wilaya "${regionName}" — can't resolve a DHD wilaya code for it.`)
    return wilaya.id
  }

  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    const { baseUrl, apiToken } = await this.company()
    const codeWilaya = await this.wilayaCode(input.address.region)

    const payload: DhdOrderPayload = {
      reference: input.orderId,
      nom_client: input.recipientName ?? '',
      telephone: input.recipientPhone,
      adresse: input.address.line2 ? `${input.address.line1}, ${input.address.line2}` : input.address.line1,
      commune: input.address.city,
      code_wilaya: codeWilaya,
      // DHD's montant is whole DZD, not cents (see DhdOrderPayload's comment).
      montant: String(Math.round(input.codAmountCents / 100)),
      remarque: input.notes,
      produit: input.items?.map((i) => i.name).join(',') || undefined,
      stock: '0', // never DHD-warehoused stock — we ship our own picked parcel.
      quantite: input.items?.map((i) => String(i.quantity)).join(',') || undefined,
      type: '1', // Livraison — the only DHD operation type this COD flow uses.
      stop_desk: input.stopDesk ? '1' : '0',
      weight: input.weightGrams ? String(Math.max(0.1, input.weightGrams / 1000)) : undefined
    }

    const result = await this.dhd.createOrder(baseUrl, apiToken, payload)
    return { trackingReference: result.tracking, courierStatus: 'created' }
  }

  async cancelShipment(trackingReference: string): Promise<void> {
    const { baseUrl, apiToken } = await this.company()
    await this.dhd.deleteOrder(baseUrl, apiToken, trackingReference)
  }

  // DHD's "Commandes" section (the scope of this integration) has no
  // single-order status lookup — that lives in the separate "Suivi des
  // commandes" section, not yet implemented. Status updates for a DHD
  // shipment currently only happen via the admin-triggered actions in
  // FulfillmentService (dispatchShipment/cancelShipment), not polling.
  async getStatus(): Promise<{ normalizedStatus: NormalizedCourierStatus; courierStatus: string }> {
    throw new NotImplementedException('DHD status polling needs the "Suivi des commandes" API section, not yet implemented.')
  }

  // Not reachable via FulfillmentController today (its webhook route calls
  // MockCourierProvider.parseWebhook directly, not the bound
  // COURIER_PROVIDER — see that controller's comment) — DHD's real webhook
  // payload shape isn't documented in the "Commandes" section this
  // integration is scoped to.
  parseWebhook(): CourierWebhookPayload {
    throw new NotImplementedException('DHD webhook parsing is not implemented — see this method\'s comment.')
  }
}
