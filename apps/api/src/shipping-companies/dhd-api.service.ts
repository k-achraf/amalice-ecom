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

@Injectable()
export class DhdApiService {
  private url(baseUrl: string, path: string, apiToken: string, extraQuery?: Record<string, string>): string {
    const url = new URL(path, baseUrl)
    url.searchParams.set('api_token', apiToken)
    for (const [key, value] of Object.entries(extraQuery ?? {})) url.searchParams.set(key, value)
    return url.toString()
  }

  // Confirms the token is accepted by DHD before we ever persist it as
  // "linked" — a bad/expired token should fail loudly at link time, not
  // silently at the next sync.
  async validateToken(baseUrl: string, apiToken: string): Promise<void> {
    let response: Response
    try {
      response = await fetch(this.url(baseUrl, '/api/v1/validate/token', apiToken))
    } catch (error) {
      throw new BadGatewayException(`Could not reach DHD: ${(error as Error).message}`)
    }
    if (response.status === 401 || response.status === 403) {
      throw new BadRequestException('DHD rejected this API token.')
    }
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
    let response: Response
    try {
      response = await fetch(this.url(baseUrl, '/api/v1/get/fees', apiToken))
    } catch (error) {
      throw new BadGatewayException(`Could not reach DHD: ${(error as Error).message}`)
    }
    if (response.status === 401 || response.status === 403) {
      throw new BadRequestException('DHD rejected this API token.')
    }
    if (!response.ok) {
      throw new BadGatewayException(`DHD returned HTTP ${response.status} while fetching tariffs.`)
    }
    const body = (await response.json().catch(() => null)) as DhdFeesResponse | null
    if (!body || !Array.isArray(body.livraison)) {
      throw new BadGatewayException('DHD returned an unexpected tariffs response.')
    }
    return body
  }
}
