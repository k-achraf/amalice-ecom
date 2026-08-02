import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common'

// DHD (platform.dhd-dz.com) is an Ecotrack white-label — its public API
// authenticates every request with an `api_token` QUERY parameter (not a
// header), confirmed against the published Postman docs
// (documenter.getpostman.com/view/14517169/Tz5je15g): the token-validation
// endpoint itself is documented as `GET {{url}}/api/v1/validate/token?api_token={{api_token}}`.
export interface DhdFeeRow {
  wilaya_id: number
  tarif: string
  tarif_stopdesk: string
}

export interface DhdFeesResponse {
  livraison: DhdFeeRow[]
  pickup?: DhdFeeRow[]
  echnage?: DhdFeeRow[]
  recouvrement?: DhdFeeRow[]
  retours?: DhdFeeRow[]
}

// "Commandes" section of the ECOTRACK Postman collection (root repo file
// `ECOTRACK API.postman_collection.json`) — every field name/shape below is
// taken directly from that collection's documented request query params and
// example responses, not guessed. All of "Ajouter une commande"'s params are
// query-string, not a JSON body, despite being a POST — same DHD convention
// as api_token.
export interface DhdOrderPayload {
  reference?: string
  nom_client: string
  telephone: string
  telephone_2?: string
  adresse: string
  code_postal?: string
  commune: string
  // Wilaya's numeric code (1-58), as a string — matches Wilaya.id's own
  // convention (see ShippingCompaniesService.syncTariffs's comment: DHD's
  // wilaya_id and our Wilaya.id are the same natural key).
  code_wilaya: string
  // Whole DZD, not cents — DHD's convention throughout (see syncTariffs's
  // "DHD quotes tarifs in whole DZD" comment). Callers must divide our
  // *Cents fields by 100 before calling.
  montant: string
  remarque?: string
  produit?: string
  // Whether the parcel is prepared from stock DHD already holds for this
  // shop (dropship-style) — always '0' for this platform, since we ship our
  // own already-picked parcel, not DHD-warehoused stock.
  stock?: '0' | '1'
  quantite?: string
  produit_a_recuperer?: string
  boutique?: string
  // 1 = Livraison (delivery) — the only type this platform's COD flow uses;
  // 2 = Échange, 3 = Pickup, 4 = Recouvrement are DHD capabilities this app
  // has no corresponding business flow for.
  type: '1' | '2' | '3' | '4'
  // 0 = home delivery, 1 = stop desk — maps from Order.shippingType.
  stop_desk?: '0' | '1'
  weight?: string
  fragile?: '0' | '1'
  gps_link?: string
}

export interface DhdCreateOrderResult {
  tracking: string
}

// "Ajouter plusieurs commandes" takes an object keyed by numeric-string
// indices ({"0": {...}, "1": {...}}), not a JSON array — that's the actual
// documented request shape, so createOrders() takes a plain array and
// converts it internally rather than exposing DHD's odd wire format to
// callers.
export interface DhdBulkCreateResult {
  // Keyed by the reference/index DHD echoes back; value is either a tracking
  // string (success) or a field-error map (validation failure for that one
  // order) — the collection's only captured example is the all-errors case,
  // so both shapes are modeled defensively.
  results: Record<string, string | Record<string, string[]>>
}

export interface DhdLabelResult {
  data: Buffer
  contentType: string
}

@Injectable()
export class DhdApiService {
  private url(baseUrl: string, path: string, apiToken: string, extraQuery?: Record<string, string | undefined>): string {
    const url = new URL(path, baseUrl)
    url.searchParams.set('api_token', apiToken)
    for (const [key, value] of Object.entries(extraQuery ?? {})) {
      if (value !== undefined) url.searchParams.set(key, value)
    }
    return url.toString()
  }

  private async request(baseUrl: string, path: string, apiToken: string, init: RequestInit, extraQuery?: Record<string, string | undefined>): Promise<Response> {
    let response: Response
    try {
      response = await fetch(this.url(baseUrl, path, apiToken, extraQuery), init)
    } catch (error) {
      throw new BadGatewayException(`Could not reach DHD: ${(error as Error).message}`)
    }
    if (response.status === 401 || response.status === 403) {
      throw new BadRequestException('DHD rejected this API token.')
    }
    return response
  }

  // Parses DHD's `{success:false, error, message}` business-rejection shape
  // (HTTP 200, but the operation itself was refused — e.g. an unsupported
  // wilaya) and its `{message, errors}` HTTP-422 validation-error shape into
  // one consistent BadRequestException, so every Commandes method below
  // reports failures the same way regardless of which shape DHD used.
  private async parseOrThrow<T>(response: Response, context: string): Promise<T> {
    if (response.status === 422) {
      const body = (await response.json().catch(() => null)) as { message?: string; errors?: Record<string, string[]> } | null
      const detail = body?.errors ? Object.values(body.errors).flat().join(' ') : body?.message
      throw new BadRequestException(`DHD rejected ${context}${detail ? `: ${detail}` : ''}`)
    }
    if (!response.ok) {
      throw new BadGatewayException(`DHD returned HTTP ${response.status} while ${context}.`)
    }
    const body = (await response.json().catch(() => null)) as ({ success?: boolean; message?: string } & T) | null
    if (!body) throw new BadGatewayException(`DHD returned an unreadable response while ${context}.`)
    if (body.success === false) {
      throw new BadRequestException(`DHD rejected ${context}${body.message ? `: ${body.message}` : ''}`)
    }
    return body
  }

  // Confirms the token is accepted by DHD before we ever persist it as
  // "linked" — a bad/expired token should fail loudly at link time, not
  // silently at the next sync.
  async validateToken(baseUrl: string, apiToken: string): Promise<void> {
    const response = await this.request(baseUrl, '/api/v1/validate/token', apiToken, {})
    if (!response.ok) {
      throw new BadGatewayException(`DHD returned HTTP ${response.status} while validating the token.`)
    }
  }

  // GET /api/v1/get/fees — "Tarifs des prestations". Only `livraison`
  // (delivery) is used by ShippingCompaniesService today; the other four
  // service categories DHD returns (pickup, échange, recouvrement, retours)
  // are fetched too since the response is a single call, but aren't parsed
  // by name here — callers that need them can read the raw response.
  async getFees(baseUrl: string, apiToken: string): Promise<DhdFeesResponse> {
    const response = await this.request(baseUrl, '/api/v1/get/fees', apiToken, {})
    if (!response.ok) {
      throw new BadGatewayException(`DHD returned HTTP ${response.status} while fetching tariffs.`)
    }
    const body = (await response.json().catch(() => null)) as DhdFeesResponse | null
    if (!body || !Array.isArray(body.livraison)) {
      throw new BadGatewayException('DHD returned an unexpected tariffs response.')
    }
    return body
  }

  // POST /api/v1/create/order — "Ajouter une commande". Success response is
  // `{success:true, tracking:"ECQ..."}`; a business rejection (e.g. no
  // delivery to the selected wilaya) comes back as HTTP 200 with
  // `{success:false, error, message}`, which parseOrThrow turns into a
  // BadRequestException the same as a 422 validation failure.
  async createOrder(baseUrl: string, apiToken: string, payload: DhdOrderPayload): Promise<DhdCreateOrderResult> {
    const response = await this.request(baseUrl, '/api/v1/create/order', apiToken, { method: 'POST' }, payload as unknown as Record<string, string | undefined>)
    const body = await this.parseOrThrow<{ tracking: string }>(response, 'creating the order')
    if (!body.tracking) throw new BadGatewayException('DHD did not return a tracking reference.')
    return { tracking: body.tracking }
  }

  // POST /api/v1/create/orders — "Ajouter plusieurs commandes". Body is a
  // JSON object keyed by numeric-string index (see DhdBulkCreateResult's
  // comment), built from the array callers pass in.
  async createOrders(baseUrl: string, apiToken: string, orders: DhdOrderPayload[]): Promise<DhdBulkCreateResult> {
    const body = { orders: Object.fromEntries(orders.map((o, i) => [String(i), o])) }
    const response = await this.request(baseUrl, '/api/v1/create/orders', apiToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    return this.parseOrThrow<DhdBulkCreateResult>(response, 'creating multiple orders')
  }

  // POST /api/v1/update/order — "Modifier une commande". Only DHD orders
  // that haven't already been picked up are modifiable — a "Commande non
  // modifiable" business rejection surfaces via parseOrThrow the same as
  // any other DHD refusal.
  async updateOrder(baseUrl: string, apiToken: string, tracking: string, payload: Partial<Omit<DhdOrderPayload, 'code_wilaya'>> & { wilaya?: string }): Promise<void> {
    const response = await this.request(
      baseUrl,
      '/api/v1/update/order',
      apiToken,
      { method: 'POST' },
      { tracking, ...(payload as unknown as Record<string, string | undefined>) }
    )
    await this.parseOrThrow(response, 'updating the order')
  }

  // DELETE /api/v1/delete/order — "Supprimer une commande".
  async deleteOrder(baseUrl: string, apiToken: string, tracking: string): Promise<void> {
    const response = await this.request(baseUrl, '/api/v1/delete/order', apiToken, { method: 'DELETE' }, { tracking })
    await this.parseOrThrow(response, 'deleting the order')
  }

  // POST /api/v1/valid/order — "Expedier une commande". This is DHD's
  // dispatch/confirm step — a created order sits unconfirmed until this is
  // called, which is what actually schedules it for pickup/transit.
  // ask_collection=1 requests DHD's own pickup from the shop; 0 means the
  // shop will drop the parcel off itself.
  async shipOrder(baseUrl: string, apiToken: string, tracking: string, askCollection: boolean): Promise<void> {
    const response = await this.request(
      baseUrl,
      '/api/v1/valid/order',
      apiToken,
      { method: 'POST' },
      { tracking, ask_collection: askCollection ? '1' : '0' }
    )
    await this.parseOrThrow(response, 'dispatching the order')
  }

  // POST /api/v1/valid/returns — "Valider la réception des retours". Bulk:
  // confirms physical receipt of one or more returned parcels back at the
  // shop, by tracking reference.
  async validateReturns(baseUrl: string, apiToken: string, trackings: string[]): Promise<void> {
    const response = await this.request(baseUrl, '/api/v1/valid/returns', apiToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackings })
    })
    await this.parseOrThrow(response, 'validating returns')
  }

  // GET /api/v1/get/order/label — "Télécharger l'étiquette". The collection
  // has no captured example response (no JSON shape to parse) — this
  // returns the raw binary (PDF) so the controller can stream it straight
  // through as a file download.
  async getLabel(baseUrl: string, apiToken: string, tracking: string): Promise<DhdLabelResult> {
    const response = await this.request(baseUrl, '/api/v1/get/order/label', apiToken, {}, { tracking })
    if (!response.ok) {
      throw new BadGatewayException(`DHD returned HTTP ${response.status} while fetching the label.`)
    }
    const data = Buffer.from(await response.arrayBuffer())
    return { data, contentType: response.headers.get('content-type') ?? 'application/pdf' }
  }
}
