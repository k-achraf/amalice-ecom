import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common'

// Client for the ECOTRACK public API (documented in the repo's
// `ECOTRACK API.postman_collection.json`). DHD, Swift Express, Anderson and
// 48 Hr Express are all white-labels of it, so this one client serves every
// shipping company — only the base URL and token differ. Every request
// authenticates with an `api_token` QUERY parameter (not a header).
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

// "Commandes" section of the collection — field names/shapes are taken from its
// documented request params and example responses. All of "Ajouter une
// commande"'s params are query-string, not a JSON body, despite being a POST.
export interface DhdOrderPayload {
  reference?: string
  nom_client: string
  telephone: string
  telephone_2?: string
  adresse: string
  code_postal?: string
  commune: string
  // Wilaya's numeric code (1-58), as a string — matches Wilaya.id's own
  // convention (DHD's wilaya_id and our Wilaya.id are the same natural key).
  code_wilaya: string
  // Whole DZD, not cents. Callers must divide our *Cents fields by 100.
  montant: string
  remarque?: string
  produit?: string
  // Whether the parcel is prepared from stock the courier holds for this shop —
  // always '0' here, we ship our own already-picked parcel.
  stock?: '0' | '1'
  quantite?: string
  produit_a_recuperer?: string
  boutique?: string
  // 1 = Livraison, 2 = Échange, 3 = Pickup, 4 = Recouvrement. This platform's
  // COD flow uses Livraison and Échange.
  type: '1' | '2' | '3' | '4'
  // 0 = home delivery, 1 = stop desk.
  stop_desk?: '0' | '1'
  weight?: string
  fragile?: '0' | '1'
  gps_link?: string
}

export interface DhdCreateOrderResult {
  tracking: string
}

// "Ajouter plusieurs commandes" takes {"orders": {"0": {...}, "1": {...}}} and
// answers {"results": {"<reference>": {success, tracking} | {field: [errors]}}}
// — keyed by the order's `reference` (not the index), per the collection's
// example. createOrders() normalizes that into this shape.
export interface DhdBulkCreateResult {
  byReference: Record<string, { tracking?: string; errors?: string[] }>
}

export interface DhdLabelResult {
  data: Buffer
  contentType: string
}

export interface DhdLocationWilaya {
  wilaya_id: number
  wilaya_name: string
}

export interface DhdLocationCommune {
  nom: string
  wilaya_id: number
  code_postal: string | null
  has_stop_desk: number
  // 0 = the courier switched this commune off (it is listed but not delivered to).
  is_active?: number
}

// One entry of a parcel's delivery history (driver remarks, failed-attempt
// reasons, postponements...). Field names are the courier's own; every one is
// optional because the collection documents the shape only by example.
export interface DhdTrackingActivity {
  reason?: string | null
  details?: string | null
  station?: string | null
  driver?: string | null
  date?: string | null
  time?: string | null
  postponed_to?: string | null
  activity?: string | null
  // get/tracking/info (single parcel) names the operation `status` instead of `activity`.
  status?: string | null
  // 'operation' = a step of the parcel's journey (picked, dispatched_to_driver, ...);
  // 'attempt' = a delivery attempt with its reason / postponement (deliveryAttempts).
  kind?: 'operation' | 'attempt'
}

const ACTIVITY_LABELS: Record<string, string> = {
  order_information_received_by_carrier: 'Order registered by the sender',
  notification_on_order: 'Notification on the order',
  picked: 'Picked up by the courier',
  accepted_by_carrier: 'Received at the sorting center',
  dispatched_to_driver: 'Dispatched to the driver',
  attempt_delivery: 'Delivery attempt',
  return_asked: 'Return initiated',
  return_in_transit: 'Return in transit',
  return_received: 'Return received by the sender',
  livred: 'Delivered',
  encaissed: 'Cash collected',
  payed: 'Payment made'
}
export function activityLabel(code: string | null | undefined): string | null {
  if (!code) return null
  const key = code.toLowerCase().trim()
  return ACTIVITY_LABELS[key] ?? key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

// The documented vocabulary of a parcel's operations (get/tracking/info): which of OUR shipping
// stages each means. Used only when the batch status read doesn't know a parcel (e.g. archived).
// attempt_delivery says nothing about the outcome, so it is skipped.
const ACTIVITY_TO_STAGE: Record<string, 'HandedToCourier' | 'OutForDelivery' | 'ReturnedToOrigin' | 'Delivered'> = {
  picked: 'HandedToCourier',
  accepted_by_carrier: 'HandedToCourier',
  dispatched_to_driver: 'OutForDelivery',
  return_asked: 'ReturnedToOrigin',
  return_in_transit: 'ReturnedToOrigin',
  return_received: 'ReturnedToOrigin',
  livred: 'Delivered',
  encaissed: 'Delivered',
  payed: 'Delivered'
}
export function stageFromActivity(activity: DhdTrackingActivity[]): 'HandedToCourier' | 'OutForDelivery' | 'ReturnedToOrigin' | 'Delivered' | null {
  for (let i = activity.length - 1; i >= 0; i--) {
    const code = (activity[i]!.status ?? activity[i]!.activity ?? '').toLowerCase().trim()
    const stage = ACTIVITY_TO_STAGE[code]
    if (stage) return stage
  }
  return null
}

export interface DhdTrackingInfo {
  status: string | null
  order_id: string | null
  desk_phone: string | null
  desk_commune: string | null
  desk_map_link: string | null
  desk_address: string | null
  driver_name: string | null
  driver_phone: string | null
  activity: DhdTrackingActivity[]
}

export interface DhdListedOrder {
  tracking: string
  reference: string | null
  status: string | null
  montant: string | null
  // Whole DZD strings, as quoted by the courier.
  tarif_prestation: string | null
  tarif_retour: string | null
  payment_id: number | null
  return_id: number | null
}

export interface DhdOrdersPage {
  currentPage: number
  lastPage: number
  data: DhdListedOrder[]
}

export interface DhdParcelUpdate {
  remarque: string
  station: string
  livreur: string
  created_at: string
  tracking: string
}

// The courier's validation messages are French. Known ones are translated so
// agents see what to fix; anything else passes through unchanged.
const COURIER_MESSAGES: [RegExp, string][] = [
  [/commune mal [ée]crite,? ou d[ée]sactiv[ée]e/i, 'Commune name not recognised (or disabled) by the courier'],
  [/wilaya mal [ée]crite,? ou d[ée]sactiv[ée]e/i, 'Wilaya not recognised (or disabled) by the courier'],
  [/commande non modifiable|ne peut pas [êe]tre modifi/i, 'The order can no longer be modified at the courier'],
  [/retour ne peut pas/i, 'A return cannot be requested for this order'],
  [/The given data was invalid\.?/i, 'Invalid data']
]
export function translateCourierMessage(message: string): string {
  const required = message.match(/Le champ (.+?) est obligatoire/i)
  if (required) return `${required[1]} is required.`
  for (const [pattern, text] of COURIER_MESSAGES) if (pattern.test(message)) return text
  return message
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

  // The courier allows 50 requests/minute per account and answers 429 beyond
  // that. Every call goes through this sliding window (kept a little under the
  // cap) so bulk dispatches and the status poller can't trip it, and a 429 that
  // still happens is retried after a pause instead of failing the operation.
  private static readonly RATE_LIMIT = 45
  private static readonly WINDOW_MS = 60_000
  private readonly windows = new Map<string, number[]>()

  private async acquire(key: string): Promise<void> {
    for (;;) {
      const now = Date.now()
      const stamps = (this.windows.get(key) ?? []).filter((t) => now - t < DhdApiService.WINDOW_MS)
      if (stamps.length < DhdApiService.RATE_LIMIT) {
        stamps.push(now)
        this.windows.set(key, stamps)
        return
      }
      this.windows.set(key, stamps)
      await new Promise((resolve) => setTimeout(resolve, Math.max(250, DhdApiService.WINDOW_MS - (now - stamps[0]!) + 50)))
    }
  }

  private async request(baseUrl: string, path: string, apiToken: string, init: RequestInit, extraQuery?: Record<string, string | undefined>): Promise<Response> {
    const key = `${baseUrl}|${apiToken}`
    let response: Response | undefined
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.acquire(key)
      try {
        response = await fetch(this.url(baseUrl, path, apiToken, extraQuery), init)
      } catch (error) {
        throw new BadGatewayException(`Could not reach the courier: ${(error as Error).message}`)
      }
      if (response.status !== 429) break
      const retryAfter = Number(response.headers.get('retry-after'))
      await new Promise((resolve) => setTimeout(resolve, (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 10) * 1000))
    }
    if (!response || response.status === 429) {
      throw new BadGatewayException('The courier is rate-limiting requests (max 50/minute). Try again in a minute.')
    }
    if (response.status === 401 || response.status === 403) {
      throw new BadRequestException('The courier rejected this API token.')
    }
    return response
  }

  // Parses the courier's `{success:false, error, message}` business-rejection
  // shape (HTTP 200, but the operation itself was refused) and its
  // `{message, errors}` HTTP-422 validation shape into one consistent
  // BadRequestException, so every method reports failures the same way.
  private async parseOrThrow<T>(response: Response, context: string): Promise<T> {
    if (response.status === 422) {
      const body = (await response.json().catch(() => null)) as { message?: string; errors?: Record<string, string[]> } | null
      const detail = body?.errors ? Object.values(body.errors).flat().map(translateCourierMessage).join(' ') : body?.message ? translateCourierMessage(body.message) : undefined
      throw new BadRequestException(`The courier rejected ${context}${detail ? `: ${detail}` : ''}`)
    }
    if (!response.ok) {
      throw new BadGatewayException(`The courier returned HTTP ${response.status} while ${context}.`)
    }
    const body = (await response.json().catch(() => null)) as ({ success?: boolean; message?: string } & T) | null
    if (!body) throw new BadGatewayException(`The courier returned an unreadable response while ${context}.`)
    if (body.success === false) {
      throw new BadRequestException(`The courier rejected ${context}${body.message ? `: ${translateCourierMessage(body.message)}` : ''}`)
    }
    return body
  }

  // Confirms the token is accepted before we ever persist it as "linked".
  async validateToken(baseUrl: string, apiToken: string): Promise<void> {
    const response = await this.request(baseUrl, '/api/v1/validate/token', apiToken, {})
    if (!response.ok) {
      throw new BadGatewayException(`The courier returned HTTP ${response.status} while validating the token.`)
    }
    // An invalid token is answered with HTTP 200 and {success:false, message:'INVALID_TOKEN' | 'TOKEN_NOT_ALLOWED'}.
    const body = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null
    if (body?.success === false) {
      throw new BadRequestException(body.message === 'TOKEN_NOT_ALLOWED' ? 'API access is disabled for this courier account.' : 'The courier rejected this API token.')
    }
  }

  // GET /api/v1/get/fees — "Tarifs des prestations".
  async getFees(baseUrl: string, apiToken: string): Promise<DhdFeesResponse> {
    const response = await this.request(baseUrl, '/api/v1/get/fees', apiToken, {})
    if (!response.ok) {
      throw new BadGatewayException(`The courier returned HTTP ${response.status} while fetching tariffs.`)
    }
    const body = (await response.json().catch(() => null)) as DhdFeesResponse | null
    if (!body || !Array.isArray(body.livraison)) {
      throw new BadGatewayException('The courier returned an unexpected tariffs response.')
    }
    return body
  }

  // POST /api/v1/create/order — "Ajouter une commande". Success is
  // `{success:true, tracking}`; a business rejection comes back as HTTP 200
  // with `{success:false, message}` or a 422, both thrown as BadRequest.
  async createOrder(baseUrl: string, apiToken: string, payload: DhdOrderPayload): Promise<DhdCreateOrderResult> {
    const response = await this.request(baseUrl, '/api/v1/create/order', apiToken, { method: 'POST' }, payload as unknown as Record<string, string | undefined>)
    const body = await this.parseOrThrow<{ tracking: string }>(response, 'creating the order')
    if (!body.tracking) throw new BadGatewayException('The courier did not return a tracking reference.')
    return { tracking: body.tracking }
  }

  // POST /api/v1/create/orders — "Ajouter plusieurs commandes", max 100/request.
  async createOrders(baseUrl: string, apiToken: string, orders: DhdOrderPayload[]): Promise<DhdBulkCreateResult> {
    if (orders.length > 100) throw new BadRequestException('The courier accepts at most 100 orders per request.')
    const body = { orders: Object.fromEntries(orders.map((o, i) => [String(i), o])) }
    const response = await this.request(baseUrl, '/api/v1/create/orders', apiToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const raw = await this.parseOrThrow<{ results?: Record<string, unknown> }>(response, 'creating multiple orders')
    const byReference: DhdBulkCreateResult['byReference'] = {}
    for (const [key, value] of Object.entries(raw.results ?? {})) {
      if (typeof value === 'string') byReference[key] = { tracking: value }
      else if (value && typeof value === 'object' && (value as { success?: boolean }).success === true) {
        byReference[key] = { tracking: (value as { tracking?: string }).tracking }
      } else if (value && typeof value === 'object') {
        byReference[key] = {
          errors: Object.values(value as Record<string, unknown>)
            .flat()
            .filter((e): e is string => typeof e === 'string')
            .map(translateCourierMessage)
        }
      }
    }
    return { byReference }
  }

  // POST /api/v1/update/order — "Modifier une commande". Only before the order
  // has been shipped (valid/order). The update endpoint names some fields
  // differently from create (client/tel/tel2/product vs nom_client/telephone/
  // telephone_2/produit), so they are mapped here.
  async updateOrder(baseUrl: string, apiToken: string, tracking: string, payload: Partial<Omit<DhdOrderPayload, 'code_wilaya'>> & { wilaya?: string }): Promise<void> {
    const { nom_client, telephone, telephone_2, produit, ...rest } = payload
    const mapped: Record<string, string | undefined> = {
      tracking,
      ...(rest as unknown as Record<string, string | undefined>),
      client: nom_client,
      tel: telephone,
      tel2: telephone_2,
      product: produit
    }
    const response = await this.request(baseUrl, '/api/v1/update/order', apiToken, { method: 'POST' }, mapped)
    await this.parseOrThrow(response, 'updating the order')
  }

  // DELETE /api/v1/delete/order — "Supprimer une commande" (before shipping only).
  async deleteOrder(baseUrl: string, apiToken: string, tracking: string): Promise<void> {
    const response = await this.request(baseUrl, '/api/v1/delete/order', apiToken, { method: 'DELETE' }, { tracking })
    await this.parseOrThrow(response, 'deleting the order')
  }

  // POST /api/v1/valid/order — "Expedier une commande". A created order sits
  // unconfirmed until this is called, which is what schedules pickup/transit.
  // After it the order can no longer be modified or deleted.
  // ask_collection=1 requests the courier's own pickup from the shop.
  async shipOrder(baseUrl: string, apiToken: string, tracking: string, askCollection: boolean): Promise<void> {
    const response = await this.request(baseUrl, '/api/v1/valid/order', apiToken, { method: 'POST' }, { tracking, ask_collection: askCollection ? '1' : '0' })
    await this.parseOrThrow(response, 'confirming the shipment')
  }

  // POST /api/v1/valid/returns — "Valider la réception des retours" (bulk).
  async validateReturns(baseUrl: string, apiToken: string, trackings: string[]): Promise<void> {
    const response = await this.request(baseUrl, '/api/v1/valid/returns', apiToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackings })
    })
    const body = await this.parseOrThrow<{ returned?: string }>(response, 'validating returns')
    // 200 with {"returned":"fail"} = no eligible parcel (already received, not
    // yet transferred, or not ours): not an HTTP error, but nothing happened.
    if (body.returned === 'fail') {
      throw new BadRequestException('The courier did not accept the return: the parcel is already received, not yet transferred, or not eligible.')
    }
  }

  // GET /api/v1/get/order/label — "Télécharger l'étiquette" (raw PDF bytes).
  async getLabel(baseUrl: string, apiToken: string, tracking: string): Promise<DhdLabelResult> {
    const response = await this.request(baseUrl, '/api/v1/get/order/label', apiToken, {}, { tracking })
    if (!response.ok) {
      throw new BadGatewayException(`The courier returned HTTP ${response.status} while fetching the label.`)
    }
    const data = Buffer.from(await response.arrayBuffer())
    return { data, contentType: response.headers.get('content-type') ?? 'application/pdf' }
  }

  // ---- Configuration ----------------------------------------------------

  // GET /api/v1/get/wilayas — wilayas the courier actually delivers to.
  async getWilayas(baseUrl: string, apiToken: string): Promise<DhdLocationWilaya[]> {
    const response = await this.request(baseUrl, '/api/v1/get/wilayas', apiToken, {})
    if (!response.ok) throw new BadGatewayException(`The courier returned HTTP ${response.status} while fetching wilayas.`)
    const body = (await response.json().catch(() => null)) as unknown
    return Array.isArray(body) ? (body as DhdLocationWilaya[]) : []
  }

  // GET /api/v1/get/communes — communes the courier delivers to, with postal
  // code and whether a stop desk exists there. Answered as an object keyed by
  // index ("0": {...}), not an array.
  async getCommunes(baseUrl: string, apiToken: string, wilayaId?: number): Promise<DhdLocationCommune[]> {
    const response = await this.request(baseUrl, '/api/v1/get/communes', apiToken, {}, { wilaya_id: wilayaId?.toString() })
    if (!response.ok) throw new BadGatewayException(`The courier returned HTTP ${response.status} while fetching communes.`)
    const body = (await response.json().catch(() => null)) as unknown
    if (Array.isArray(body)) return body as DhdLocationCommune[]
    return body && typeof body === 'object' ? (Object.values(body) as DhdLocationCommune[]) : []
  }

  // ---- Tracking -----------------------------------------------------------

  // trackings/info answers an object keyed by tracking number WITHOUT a `data` wrapper
  // ({"ECV…": {OrderInfo, status, activity, deliveryAttempts}}); get/orders/status wraps the same
  // entries in {data: {...}}. Both are read; entries that are not objects (messages) are ignored.
  private entriesOf(body: unknown): Record<string, Record<string, unknown>> {
    if (!body || typeof body !== 'object') return {}
    const obj = body as Record<string, unknown>
    const source = obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data) ? (obj.data as Record<string, unknown>) : obj
    const out: Record<string, Record<string, unknown>> = {}
    for (const [tracking, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) out[tracking] = value as Record<string, unknown>
    }
    return out
  }

  // Reads one parcel's entry. Two shapes exist:
  //  - trackings/info: {OrderInfo{driver_name, driver_phone,…}, status:"En livraison",
  //    activity:[{date,time,status:<operation code>,station,scanLocation}],
  //    deliveryAttempts:[{created_at,driver,station,text_tentative,postponed_to,done_by}]}
  //  - orders/status: {status, order_id, desk_*, activity:[{reason,details,station,driver,date,time,postponed_to}]}
  private toTrackingInfo(raw: Record<string, unknown>): DhdTrackingInfo {
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
    const info = raw.OrderInfo && typeof raw.OrderInfo === 'object' ? (raw.OrderInfo as Record<string, unknown>) : {}
    const activity: DhdTrackingActivity[] = []
    for (const item of Array.isArray(raw.activity) ? (raw.activity as Record<string, unknown>[]) : []) {
      if (!item || typeof item !== 'object') continue
      if (str(item.reason)) {
        activity.push({ ...(item as DhdTrackingActivity), kind: 'attempt' })
      } else {
        activity.push({
          kind: 'operation',
          activity: str(item.status) ?? str(item.activity),
          date: str(item.date),
          time: str(item.time),
          station: str(item.station),
          details: str(item.scanLocation) ? `Scan location: ${item.scanLocation as string}` : null
        })
      }
    }
    for (const attempt of Array.isArray(raw.deliveryAttempts) ? (raw.deliveryAttempts as Record<string, unknown>[]) : []) {
      if (!attempt || typeof attempt !== 'object') continue
      const created = str(attempt.created_at) ?? ''
      const [date, time] = created.includes(' ') ? created.split(' ') : created.includes('T') ? created.split('T') : [created || null, null]
      activity.push({
        kind: 'attempt',
        reason: str(attempt.text_tentative) ?? 'Delivery attempt',
        details: str(attempt.done_by) ? `By ${attempt.done_by as string}` : null,
        station: str(attempt.station),
        driver: str(attempt.driver),
        date: date ?? null,
        time: time ?? null,
        postponed_to: str(attempt.postponed_to)
      })
    }
    activity.sort((a, b) => `${a.date ?? ''} ${a.time ?? ''}`.localeCompare(`${b.date ?? ''} ${b.time ?? ''}`))
    return {
      status: str(raw.status),
      order_id: str(raw.order_id),
      desk_phone: str(raw.desk_phone),
      desk_commune: str(raw.desk_commune),
      desk_map_link: str(raw.desk_map_link),
      desk_address: str(raw.desk_address),
      driver_name: str(info.driver_name) ?? str(raw.driver_name) ?? str(raw.driver),
      driver_phone: str(info.driver_phone) ?? str(raw.driver_phone),
      activity
    }
  }

  // GET /api/v1/get/trackings/info — status + operation history for up to 100
  // parcels per request. Returns a map keyed by tracking number; trackings the
  // courier doesn't know are simply absent.
  async getTrackingsInfo(baseUrl: string, apiToken: string, trackings: string[]): Promise<Record<string, DhdTrackingInfo>> {
    const result: Record<string, DhdTrackingInfo> = {}
    for (let i = 0; i < trackings.length; i += 100) {
      await this.fetchTrackingsChunk(baseUrl, apiToken, trackings.slice(i, i + 100), result)
    }
    return result
  }

  // A 422 means the courier rejected the request, typically because ONE tracking in it is unknown
  // to it (deleted there). Treating that as "none are known" would hide every other parcel of the
  // chunk from every refresh, so a rejected chunk is halved until the unknown ones are isolated.
  private async fetchTrackingsChunk(baseUrl: string, apiToken: string, chunk: string[], result: Record<string, DhdTrackingInfo>): Promise<void> {
    if (!chunk.length) return
    const query = Object.fromEntries(chunk.map((t, idx) => [`trackings[${idx}]`, t]))
    const response = await this.request(baseUrl, '/api/v1/get/trackings/info', apiToken, {}, query)
    if (response.status === 422) {
      if (chunk.length === 1) return
      const mid = Math.ceil(chunk.length / 2)
      await this.fetchTrackingsChunk(baseUrl, apiToken, chunk.slice(0, mid), result)
      await this.fetchTrackingsChunk(baseUrl, apiToken, chunk.slice(mid), result)
      return
    }
    if (!response.ok) throw new BadGatewayException(`The courier returned HTTP ${response.status} while fetching tracking info.`)
    const body = (await response.json().catch(() => null)) as unknown
    for (const [tracking, raw] of Object.entries(this.entriesOf(body))) result[tracking] = this.toTrackingInfo(raw)
  }

  // GET /api/v1/get/tracking/info — "Suivi et historique des operations sur une
  // commande": status + operation history of ONE parcel. The collection only shows
  // its error example, so both a bare object and a {data:{...}} wrapper are read.
  async getTrackingInfo(baseUrl: string, apiToken: string, tracking: string): Promise<DhdTrackingInfo | null> {
    const response = await this.request(baseUrl, '/api/v1/get/tracking/info', apiToken, {}, { tracking })
    if (response.status === 422) return null
    if (!response.ok) throw new BadGatewayException(`The courier returned HTTP ${response.status} while fetching tracking info.`)
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return null
    const raw = (body.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>) : body) as Record<string, unknown>
    // A wrapper keyed by tracking number: take the entry.
    const entry = raw[tracking] && typeof raw[tracking] === 'object' ? (raw[tracking] as Record<string, unknown>) : raw
    return 'status' in entry || 'activity' in entry ? this.toTrackingInfo(entry) : null
  }

  // GET /api/v1/get/orders/status — "Filtre des commandes par status": the same
  // per-parcel detail as trackings/info, restricted to parcels currently in one of
  // the given statuses (max 100 trackings per request).
  async getOrdersByStatus(baseUrl: string, apiToken: string, trackings: string[], statuses: string[]): Promise<Record<string, DhdTrackingInfo>> {
    const result: Record<string, DhdTrackingInfo> = {}
    for (let i = 0; i < trackings.length; i += 100) {
      const chunk = trackings.slice(i, i + 100)
      const response = await this.request(baseUrl, '/api/v1/get/orders/status', apiToken, {}, { trackings: chunk.join(','), status: statuses.join(',') })
      if (response.status === 422) continue
      if (!response.ok) throw new BadGatewayException(`The courier returned HTTP ${response.status} while filtering orders by status.`)
      const body = (await response.json().catch(() => null)) as unknown
      for (const [tracking, raw] of Object.entries(this.entriesOf(body))) result[tracking] = this.toTrackingInfo(raw)
    }
    return result
  }

  // GET /api/v1/get/orders — in-process orders with current status and the
  // courier's fees for each (tarif_prestation / tarif_retour). 40 per page,
  // last 90 days unless a range is given; archived orders are excluded.
  async getOrders(baseUrl: string, apiToken: string, args: { page?: number; startDate?: string; endDate?: string; tracking?: string }): Promise<DhdOrdersPage> {
    const response = await this.request(baseUrl, '/api/v1/get/orders', apiToken, {}, {
      page: String(args.page ?? 1),
      start_date: args.startDate,
      end_date: args.endDate,
      tracking: args.tracking
    })
    if (response.status === 422) return { currentPage: 1, lastPage: 1, data: [] }
    if (!response.ok) throw new BadGatewayException(`The courier returned HTTP ${response.status} while listing orders.`)
    const body = (await response.json().catch(() => null)) as { current_page?: number; last_page?: number; data?: Record<string, unknown>[] } | null
    const str = (v: unknown) => (v == null || v === '' ? null : String(v))
    return {
      currentPage: body?.current_page ?? 1,
      lastPage: body?.last_page ?? 1,
      data: (body?.data ?? []).map((o) => ({
        tracking: String(o.tracking),
        reference: str(o.reference),
        status: str(o.status),
        montant: str(o.montant),
        tarif_prestation: str(o.tarif_prestation),
        tarif_retour: str(o.tarif_retour),
        payment_id: typeof o.payment_id === 'number' ? o.payment_id : null,
        return_id: typeof o.return_id === 'number' ? o.return_id : null
      }))
    }
  }

  // GET /api/v1/get/maj — remarks added to a parcel by the driver and/or us.
  async getUpdates(baseUrl: string, apiToken: string, tracking: string): Promise<DhdParcelUpdate[]> {
    const response = await this.request(baseUrl, '/api/v1/get/maj', apiToken, {}, { tracking })
    if (response.status === 422) return []
    if (!response.ok) throw new BadGatewayException(`The courier returned HTTP ${response.status} while fetching parcel updates.`)
    const body = (await response.json().catch(() => null)) as unknown
    return Array.isArray(body) ? (body as DhdParcelUpdate[]) : []
  }

  // POST /api/v1/add/maj — a remark for the delivery company (e.g. "call
  // before 17:00"), only meaningful after the order has been shipped.
  async addUpdate(baseUrl: string, apiToken: string, tracking: string, content: string): Promise<void> {
    const response = await this.request(baseUrl, '/api/v1/add/maj', apiToken, { method: 'POST' }, { tracking, content })
    await this.parseOrThrow(response, 'adding the update')
  }

  // POST /api/v1/ask/for/order/return — ask the courier to bring back a parcel
  // that is out for delivery. The courier may ignore the request.
  async askReturn(baseUrl: string, apiToken: string, tracking: string): Promise<void> {
    const response = await this.request(baseUrl, '/api/v1/ask/for/order/return', apiToken, { method: 'POST' }, { tracking })
    await this.parseOrThrow(response, 'requesting the return')
  }
}
