import { BadGatewayException, BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common'
import {
  META_ACCOUNT_STATUS_LABELS,
  META_ADS_SCOPES,
  type ConnectMeta,
  type ConnectMetaToken,
  type SaveMetaAppCredentials,
  type MetaAppCredentialsView,
  type MetaAccountOverview,
  type MetaAdAccountView,
  type MetaAdSetsResponse,
  type MetaAnalyticsBreakdowns,
  type MetaAnalyticsChild,
  type MetaAnalyticsEntity,
  type MetaAnalyticsLevel,
  type MetaAnalyticsQuery,
  type MetaAnalyticsResponse,
  type MetaOrderStats,
  type MetaProfitabilityQuery,
  type MetaProfitabilityResponse,
  type MetaProfitabilityRow,
  type SetMetaExchangeRate,
  type MetaBreakdownRow,
  type MetaAdsResponse,
  type MetaAdsStatus,
  type MetaCampaignsQuery,
  type MetaCampaignsResponse,
  type MetaInsightsQuery,
  type MetaOAuthUrlQuery
} from '@amalice/shared'
import { AuditService, type AuditActor } from '../common/audit.service'
import { PrismaService } from '../prisma/prisma.service'
import { RedisService } from '../redis/redis.service'
import type { MetaAdAccount, MetaConnection } from '../generated/prisma/client'
import { MetaCredentialsService, type MetaAppCredentials } from './meta-credentials.service'
import { MetaGraphError, MetaGraphService } from './meta-graph.service'
import {
  ANALYTICS_FIELDS,
  mergeRaw,
  prettyLabel,
  resolveRange,
  toDay,
  toTotals,
  rangeBoundsUtc,
  type DateRange,
  type RawAnalytics
} from './meta-analytics.util'
import {
  addOrder,
  buildMatcher,
  emptyAcc,
  finalize,
  sumAccs,
  type AttributionHints,
  type Chain,
  type EntityIndex,
  type OrderAcc
} from './meta-orders.util'
import { fromMinorUnits, INSIGHT_FIELDS, toMetrics, type RawInsights } from './meta-insights.util'

const CACHE_TTL_SECONDS = 60
const MAX_ACCOUNT_PAGES = 10

interface GraphList<T> { data: T[]; paging?: { cursors?: { after?: string }; next?: string } }
interface GraphAdAccount {
  id: string
  name?: string
  currency?: string
  timezone_name?: string
  account_status?: number
  amount_spent?: string
  balance?: string
  business?: { name?: string }
}
interface GraphCampaign {
  id: string
  name: string
  status: string
  effective_status: string
  objective?: string
  daily_budget?: string
  lifetime_budget?: string
  start_time?: string
  stop_time?: string
  created_time?: string
  insights?: { data?: RawInsights[] }
}

interface GraphAdSet {
  id: string
  name: string
  status: string
  effective_status: string
  optimization_goal?: string
  daily_budget?: string
  lifetime_budget?: string
  start_time?: string
  end_time?: string
  insights?: { data?: RawInsights[] }
}
interface GraphAd {
  id: string
  name: string
  status: string
  effective_status: string
  creative?: { thumbnail_url?: string }
  insights?: { data?: RawInsights[] }
}

interface GraphEntity {
  id: string
  name?: string
  status?: string
  effective_status?: string
  objective?: string
  optimization_goal?: string
  daily_budget?: string
  lifetime_budget?: string
  start_time?: string
  stop_time?: string
  end_time?: string
  account_id?: string
  creative?: { thumbnail_url?: string; title?: string; body?: string }
  campaign?: { id: string; name?: string }
  adset?: { id: string; name?: string }
  targeting?: { age_min?: number; age_max?: number; genders?: number[]; geo_locations?: { countries?: string[]; regions?: { name?: string }[]; cities?: { name?: string }[] } }
}

const ENTITY_FIELDS: Record<MetaAnalyticsLevel, string> = {
  campaign: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,account_id',
  adset: 'id,name,status,effective_status,optimization_goal,daily_budget,lifetime_budget,start_time,end_time,account_id,campaign{id,name},targeting{age_min,age_max,genders,geo_locations}',
  ad: 'id,name,status,effective_status,account_id,creative{thumbnail_url,title,body},adset{id,name},campaign{id,name}'
}

const ANALYTICS_CACHE_SECONDS = 120
const AGE_ORDER = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+']

// "instagram|instagram_reels" -> "Instagram · Reels" (the position often repeats the platform name).
function placementLabel(key: string): string {
  const [publisher = '', position = ''] = key.split('|')
  const stripped = position.startsWith(`${publisher}_`) ? position.slice(publisher.length + 1) : position
  return `${prettyLabel(publisher)} · ${prettyLabel(stripped)}`
}

function targetingSummary(t: GraphEntity['targeting']): string | null {
  if (!t) return null
  const parts: string[] = []
  if (t.age_min || t.age_max) parts.push(`Ages ${t.age_min ?? 18}-${t.age_max ?? '65+'}`)
  if (t.genders?.length === 1) parts.push(t.genders[0] === 1 ? 'Men' : 'Women')
  const geo = t.geo_locations
  const places = [...(geo?.countries ?? []), ...(geo?.regions?.map((r) => r.name ?? '') ?? []), ...(geo?.cities?.map((c) => c.name ?? '') ?? [])].filter(Boolean)
  if (places.length) parts.push(places.slice(0, 4).join(', ') + (places.length > 4 ? ` +${places.length - 4}` : ''))
  return parts.length ? parts.join(' · ') : null
}

// Graph ids are plain numbers; anything else never reaches a query.
const GRAPH_ID = /^\d{1,30}$/

@Injectable()
export class MetaAdsService {
  private readonly logger = new Logger(MetaAdsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: MetaGraphService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly credentials: MetaCredentialsService
  ) {}

  // Needed only for "Connect with Facebook"; pasting an access token works without a Meta app saved here.
  private async requireApp(): Promise<MetaAppCredentials> {
    const creds = await this.credentials.get()
    if (!creds) throw new ConflictException('Add your Meta app (App ID and App secret) first, or connect with an access token instead.')
    return creds
  }

  // Calls Graph with a stored connection's token; appsecret_proof only for tokens issued to our own app (OAuth).
  private async call<T>(connection: MetaConnection, path: string, params: Record<string, string | number | undefined>, token: string): Promise<T> {
    const proofSecret = connection.method === 'oauth' ? (await this.credentials.get())?.appSecret : undefined
    return this.graph.get<T>(path, params, token, proofSecret)
  }

  // ---- connection ----

  async status(adminUserId: string): Promise<MetaAdsStatus> {
    const connection = await this.prisma.metaConnection.findUnique({ where: { adminUserId } })
    const app = await this.credentials.get()
    return {
      configured: !!app,
      app: app && { appId: app.appId, appName: app.appName, source: app.source },
      connection: connection && {
        fbUserId: connection.fbUserId,
        fbUserName: connection.fbUserName,
        scopes: connection.scopes,
        status: connection.status,
        tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
        selectedAdAccountId: connection.selectedAdAccountId,
        connectedAt: connection.createdAt.toISOString(),
        method: connection.method === 'token' ? 'token' : 'oauth'
      }
    }
  }

  async oauthUrl(query: MetaOAuthUrlQuery): Promise<{ url: string }> {
    const app = await this.requireApp()
    return { url: this.graph.dialogUrl(app, query.redirectUri, query.state, META_ADS_SCOPES) }
  }

  async connect(adminUserId: string, input: ConnectMeta, actor: AuditActor): Promise<MetaAdsStatus> {
    const app = await this.requireApp()
    let token: string
    let expiresInSeconds: number | null
    let me: { id: string; name?: string }
    let granted: string[]
    try {
      ;({ token, expiresInSeconds } = await this.graph.exchangeCode(app, input.code, input.redirectUri))
      me = await this.graph.get<{ id: string; name?: string }>('me', { fields: 'id,name' }, token, app.appSecret)
      const permissions = await this.graph.get<GraphList<{ permission: string; status: string }>>('me/permissions', {}, token, app.appSecret)
      granted = permissions.data.filter((p) => p.status === 'granted').map((p) => p.permission)
    } catch (error) {
      throw this.translate(error, 'Could not complete the Meta login. Try connecting again.')
    }
    if (!granted.includes('ads_read')) {
      throw new BadRequestException('The "Ads" permission was not granted. Connect again and allow access to your ad accounts.')
    }

    const data = {
      fbUserId: me.id,
      fbUserName: me.name ?? null,
      accessTokenEnc: this.credentials.encrypt(token),
      scopes: granted,
      tokenExpiresAt: expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : null,
      status: 'Active' as const,
      method: 'oauth'
    }
    const connection = await this.prisma.metaConnection.upsert({
      where: { adminUserId },
      create: { adminUserId, ...data },
      update: data
    })
    await this.audit.log({ actor, action: 'Create', entity: 'MetaConnection', entityId: connection.id, metadata: { fbUserId: me.id } })
    await this.syncAccounts(adminUserId)
    return this.status(adminUserId)
  }

  // Simplest connection: the user pastes an access token (Graph API Explorer user token, or a
  // Business Manager System User token). No Facebook Login / redirect URI setup is involved.
  async connectToken(adminUserId: string, input: ConnectMetaToken, actor: AuditActor): Promise<MetaAdsStatus> {
    let token = input.accessToken.trim()
    let expiresAt: Date | null = null
    let me: { id: string; name?: string }
    let granted: string[] = []
    try {
      me = await this.graph.get<{ id: string; name?: string }>('me', { fields: 'id,name' }, token)
      // Verifies the token can actually read ad accounts, with Meta's own message if not.
      await this.graph.get('me/adaccounts', { fields: 'id', limit: 1 }, token)
      try {
        const permissions = await this.graph.get<GraphList<{ permission: string; status: string }>>('me/permissions', {}, token)
        granted = permissions.data.filter((p) => p.status === 'granted').map((p) => p.permission)
      } catch {
        // System-user tokens may not expose this; reading ad accounts above already proved access.
      }
    } catch (error) {
      if (error instanceof MetaGraphError && !error.isRateLimit) {
        throw new BadRequestException(error.isAuthError ? 'Meta rejected this access token. Generate a new one and paste it again.' : `Meta could not use this token: ${error.message}`)
      }
      throw this.translate(error, 'Could not check the access token.')
    }

    // With a Meta app saved, turn a short-lived user token into a ~60 day one and read its real expiry.
    const app = await this.credentials.get()
    if (app) {
      const extended = await this.graph.extendToken(app, token)
      if (extended) {
        token = extended.token
        expiresAt = extended.expiresInSeconds ? new Date(Date.now() + extended.expiresInSeconds * 1000) : null
      } else {
        expiresAt = (await this.graph.tokenExpiry(app, token))?.expiresAt ?? null
      }
    }

    const data = {
      fbUserId: me.id,
      fbUserName: me.name ?? null,
      accessTokenEnc: this.credentials.encrypt(token),
      scopes: granted,
      tokenExpiresAt: expiresAt,
      status: 'Active' as const,
      method: 'token'
    }
    const connection = await this.prisma.metaConnection.upsert({ where: { adminUserId }, create: { adminUserId, ...data }, update: data })
    await this.audit.log({ actor, action: 'Create', entity: 'MetaConnection', entityId: connection.id, metadata: { fbUserId: me.id, method: 'token' } })
    await this.syncAccounts(adminUserId)
    return this.status(adminUserId)
  }

  // ---- Meta app credentials (for "Connect with Facebook") ----

  async saveAppCredentials(input: SaveMetaAppCredentials, actor: AuditActor): Promise<MetaAppCredentialsView> {
    const appSecret = input.appSecret ?? (await this.credentials.savedSecretFor(input.appId))
    if (!appSecret) throw new BadRequestException('Enter the App secret.')
    let name: string | null
    try {
      ;({ name } = await this.graph.appInfo(input.appId, appSecret))
    } catch (error) {
      throw new BadRequestException(error instanceof MetaGraphError ? `Meta rejected these credentials: ${error.message}` : 'Could not check the credentials with Meta.')
    }
    await this.credentials.save(input.appId, appSecret, name)
    await this.audit.log({ actor, action: 'Update', entity: 'MetaAppCredentials', entityId: 'singleton', metadata: { appId: input.appId } })
    return { appId: input.appId, appName: name, source: 'database' }
  }

  async clearAppCredentials(actor: AuditActor): Promise<{ ok: true }> {
    await this.credentials.clear()
    await this.audit.log({ actor, action: 'Delete', entity: 'MetaAppCredentials', entityId: 'singleton' })
    return { ok: true }
  }

  async disconnect(adminUserId: string, actor: AuditActor): Promise<{ ok: true }> {
    const connection = await this.prisma.metaConnection.findUnique({ where: { adminUserId } })
    if (!connection) return { ok: true }
    // Best effort: revoke our app's permissions on Meta's side too (only for logins made through our own app).
    try {
      if (connection.method !== 'oauth') throw new Error('not an oauth connection')
      const token = this.credentials.decrypt(connection.accessTokenEnc)
      await fetch(`https://graph.facebook.com/${this.graph.version}/me/permissions?access_token=${encodeURIComponent(token)}`, { method: 'DELETE', signal: AbortSignal.timeout(10_000) })
    } catch {
      // The token may already be dead; local removal is what matters.
    }
    await this.prisma.metaConnection.delete({ where: { id: connection.id } })
    await this.audit.log({ actor, action: 'Delete', entity: 'MetaConnection', entityId: connection.id, metadata: { fbUserId: connection.fbUserId } })
    return { ok: true }
  }

  // ---- ad accounts ----

  async syncAccounts(adminUserId: string): Promise<MetaAdAccountView[]> {
    const { connection, token } = await this.activeConnection(adminUserId)
    const found: GraphAdAccount[] = []
    try {
      let after: string | undefined
      for (let page = 0; page < MAX_ACCOUNT_PAGES; page++) {
        const res = await this.call<GraphList<GraphAdAccount>>(
          connection,
          'me/adaccounts',
          { fields: 'id,name,currency,timezone_name,account_status,amount_spent,balance,business{name}', limit: 100, after },
          token
        )
        found.push(...res.data)
        after = res.paging?.next ? res.paging.cursors?.after : undefined
        if (!after) break
      }
    } catch (error) {
      throw await this.handleGraphError(connection, error)
    }

    const now = new Date()
    await this.prisma.$transaction([
      ...found.map((a) => {
        const data = {
          name: a.name ?? a.id,
          currency: a.currency ?? null,
          timezoneName: a.timezone_name ?? null,
          accountStatus: a.account_status ?? 1,
          businessName: a.business?.name ?? null,
          amountSpent: a.amount_spent ?? null,
          balance: a.balance ?? null,
          syncedAt: now
        }
        return this.prisma.metaAdAccount.upsert({
          where: { connectionId_accountId: { connectionId: connection.id, accountId: a.id } },
          create: { connectionId: connection.id, accountId: a.id, ...data },
          update: data
        })
      }),
      this.prisma.metaAdAccount.deleteMany({ where: { connectionId: connection.id, accountId: { notIn: found.map((a) => a.id) } } })
    ])
    // Drop a selection that no longer exists.
    if (connection.selectedAdAccountId && !found.some((a) => a.id === connection.selectedAdAccountId)) {
      await this.prisma.metaConnection.update({ where: { id: connection.id }, data: { selectedAdAccountId: null } })
    }
    return this.listAccounts(adminUserId)
  }

  async listAccounts(adminUserId: string): Promise<MetaAdAccountView[]> {
    const connection = await this.prisma.metaConnection.findUnique({ where: { adminUserId }, include: { adAccounts: { orderBy: { name: 'asc' } } } })
    if (!connection) throw new ConflictException('Connect your Meta account first.')
    return connection.adAccounts.map((a) => this.toAccountView(a))
  }

  async selectAccount(adminUserId: string, accountId: string): Promise<{ selectedAdAccountId: string }> {
    const { connection } = await this.ownedAccount(adminUserId, accountId)
    await this.prisma.metaConnection.update({ where: { id: connection.id }, data: { selectedAdAccountId: accountId } })
    return { selectedAdAccountId: accountId }
  }

  // ---- campaigns + insights (always live from Meta, 60s cache) ----

  async campaigns(adminUserId: string, accountId: string, query: MetaCampaignsQuery): Promise<MetaCampaignsResponse> {
    const { connection, token, account } = await this.ownedAccount(adminUserId, accountId)
    const key = `meta:campaigns:${connection.id}:${accountId}:${query.datePreset}:${query.status ?? '-'}:${query.after ?? '-'}`
    const cached = query.refresh ? null : await this.cacheGet<MetaCampaignsResponse>(key)
    if (cached) return cached

    let res: GraphList<GraphCampaign>
    try {
      res = await this.call<GraphList<GraphCampaign>>(
        connection,
        `${accountId}/campaigns`,
        {
          fields: `id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,insights.date_preset(${query.datePreset}){${INSIGHT_FIELDS}}`,
          limit: 25,
          after: query.after,
          effective_status: query.status ? JSON.stringify([query.status]) : undefined
        },
        token
      )
    } catch (error) {
      throw await this.handleGraphError(connection, error)
    }

    const currency = account.currency
    const result: MetaCampaignsResponse = {
      currency,
      items: res.data.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        effectiveStatus: c.effective_status,
        objective: c.objective ?? null,
        dailyBudget: fromMinorUnits(c.daily_budget, currency),
        lifetimeBudget: fromMinorUnits(c.lifetime_budget, currency),
        startTime: c.start_time ?? null,
        stopTime: c.stop_time ?? null,
        createdTime: c.created_time ?? null,
        insights: toMetrics(c.insights?.data?.[0])
      })),
      next: res.paging?.next ? (res.paging.cursors?.after ?? null) : null,
      fetchedAt: new Date().toISOString()
    }
    await this.cacheSet(key, result)
    return result
  }

  // Ad sets of one campaign. Scoped to the ad account (filtering on campaign.id), so an id from another account returns nothing.
  async adSets(adminUserId: string, accountId: string, campaignId: string, query: MetaCampaignsQuery): Promise<MetaAdSetsResponse> {
    if (!GRAPH_ID.test(campaignId)) throw new BadRequestException('Invalid campaign id')
    const { connection, token, account } = await this.ownedAccount(adminUserId, accountId)
    const key = `meta:adsets:${connection.id}:${accountId}:${campaignId}:${query.datePreset}:${query.status ?? '-'}:${query.after ?? '-'}`
    const cached = query.refresh ? null : await this.cacheGet<MetaAdSetsResponse>(key)
    if (cached) return cached

    let list: GraphList<GraphAdSet>
    let parent: { id: string; name?: string; account_id?: string }
    try {
      ;[list, parent] = await Promise.all([
        this.call<GraphList<GraphAdSet>>(
          connection,
          `${accountId}/adsets`,
          {
            fields: `id,name,status,effective_status,optimization_goal,daily_budget,lifetime_budget,start_time,end_time,insights.date_preset(${query.datePreset}){${INSIGHT_FIELDS}}`,
            filtering: JSON.stringify([{ field: 'campaign.id', operator: 'EQUAL', value: campaignId }, ...(query.status ? [{ field: 'effective_status', operator: 'IN', value: [query.status] }] : [])]),
            limit: 25,
            after: query.after
          },
          token
        ),
        this.call<{ id: string; name?: string; account_id?: string }>(connection, campaignId, { fields: 'id,name,account_id' }, token)
      ])
    } catch (error) {
      throw await this.handleGraphError(connection, error)
    }
    if (parent.account_id && `act_${parent.account_id}` !== accountId) throw new NotFoundException('Campaign not found in this ad account.')

    const currency = account.currency
    const result: MetaAdSetsResponse = {
      currency,
      parent: { id: campaignId, name: parent.name ?? campaignId },
      items: list.data.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        effectiveStatus: s.effective_status,
        optimizationGoal: s.optimization_goal ?? null,
        dailyBudget: fromMinorUnits(s.daily_budget, currency),
        lifetimeBudget: fromMinorUnits(s.lifetime_budget, currency),
        startTime: s.start_time ?? null,
        endTime: s.end_time ?? null,
        insights: toMetrics(s.insights?.data?.[0])
      })),
      next: list.paging?.next ? (list.paging.cursors?.after ?? null) : null,
      fetchedAt: new Date().toISOString()
    }
    await this.cacheSet(key, result)
    return result
  }

  // Ads of one ad set (with the creative's thumbnail), scoped to the ad account like adSets().
  async ads(adminUserId: string, accountId: string, adsetId: string, query: MetaCampaignsQuery): Promise<MetaAdsResponse> {
    if (!GRAPH_ID.test(adsetId)) throw new BadRequestException('Invalid ad set id')
    const { connection, token, account } = await this.ownedAccount(adminUserId, accountId)
    const key = `meta:ads:${connection.id}:${accountId}:${adsetId}:${query.datePreset}:${query.status ?? '-'}:${query.after ?? '-'}`
    const cached = query.refresh ? null : await this.cacheGet<MetaAdsResponse>(key)
    if (cached) return cached

    let list: GraphList<GraphAd>
    let parent: { id: string; name?: string; account_id?: string; campaign?: { id: string; name?: string } }
    // Read through the ad set's own `ads` edge: Meta resolves it directly. The account-wide
    // `act_x/ads?filtering=adset.id` form scans every ad of the account, which on a big account
    // runs past the proxy timeout (the page then fails with no readable error). Account
    // ownership is still checked below against the ad set's account_id.
    const filtering = query.status ? JSON.stringify([{ field: 'effective_status', operator: 'IN', value: [query.status] }]) : undefined
    const insightsField = `insights.date_preset(${query.datePreset}){${INSIGHT_FIELDS}}`
    // The creative thumbnail and the nested insights are the heavy / permission-sensitive parts: if Meta
    // rejects the full request, retry with less rather than leaving the page unusable.
    const fieldSets = [
      `id,name,status,effective_status,creative{thumbnail_url},${insightsField}`,
      `id,name,status,effective_status,${insightsField}`,
      'id,name,status,effective_status'
    ]
    const startedAt = Date.now()
    const fetchAds = async (): Promise<GraphList<GraphAd>> => {
      let lastError: unknown
      for (const fields of fieldSets) {
        // Each Graph call can take up to 20 s; stop retrying early enough that the whole request
        // stays under a typical reverse-proxy timeout (60 s) and the page gets a real error.
        if (Date.now() - startedAt > 25_000) break
        try {
          return await this.call<GraphList<GraphAd>>(connection, `${adsetId}/ads`, { fields, filtering, limit: 25, after: query.after }, token)
        } catch (error) {
          if (!(error instanceof MetaGraphError) || error.isAuthError || error.isRateLimit) throw error
          this.logger.warn(`Meta ads request failed after ${Date.now() - startedAt} ms (${error.code ?? 'no code'}: ${error.message}) — retrying with fewer fields`)
          lastError = error
        }
      }
      throw lastError
    }
    const fetchParent = async () => {
      type AdSetParent = { id: string; name?: string; account_id?: string; campaign?: { id: string; name?: string } }
      try {
        return await this.call<AdSetParent>(connection, adsetId, { fields: 'id,name,account_id,campaign{id,name}' }, token)
      } catch (error) {
        if (!(error instanceof MetaGraphError) || error.isAuthError || error.isRateLimit) throw error
        return this.call<AdSetParent>(connection, adsetId, { fields: 'id,name,account_id' }, token)
      }
    }
    try {
      ;[list, parent] = await Promise.all([fetchAds(), fetchParent()])
    } catch (error) {
      throw await this.handleGraphError(connection, error)
    }
    if (parent.account_id && `act_${parent.account_id}` !== accountId) throw new NotFoundException('Ad set not found in this ad account.')

    const result: MetaAdsResponse = {
      currency: account.currency,
      parent: { id: adsetId, name: parent.name ?? adsetId },
      campaign: parent.campaign ? { id: parent.campaign.id, name: parent.campaign.name ?? parent.campaign.id } : null,
      items: list.data.map((a) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        effectiveStatus: a.effective_status,
        thumbnailUrl: a.creative?.thumbnail_url ?? null,
        insights: toMetrics(a.insights?.data?.[0])
      })),
      next: list.paging?.next ? (list.paging.cursors?.after ?? null) : null,
      fetchedAt: new Date().toISOString()
    }
    await this.cacheSet(key, result)
    return result
  }

  // Everything the analytics page shows for one campaign / ad set / ad: period totals vs the previous
  // period, daily series, audience / placement / device breakdowns and the level below. The core figures
  // must load; each breakdown is best effort (one failing doesn't blank the page). Cached for 2 minutes.
  async analytics(adminUserId: string, accountId: string, level: MetaAnalyticsLevel, id: string, query: MetaAnalyticsQuery): Promise<MetaAnalyticsResponse> {
    if (!GRAPH_ID.test(id)) throw new BadRequestException('Invalid id')
    const { connection, token, account } = await this.ownedAccount(adminUserId, accountId)
    const key = `meta:analytics:${connection.id}:${accountId}:${level}:${id}:${query.datePreset}`
    const cached = query.refresh ? null : await this.cacheGet<MetaAnalyticsResponse>(key)
    if (cached) return cached

    const ranges = resolveRange(query.datePreset, account.timezoneName)
    const timeParams = (r: DateRange | undefined) => (r ? { time_range: JSON.stringify(r) } : { date_preset: 'maximum' })
    const insights = (params: Record<string, string | number | undefined>, fields = ANALYTICS_FIELDS) =>
      this.call<GraphList<RawAnalytics>>(connection, `${id}/insights`, { fields, limit: 500, ...params }, token)
    const current = timeParams(ranges?.current)

    let entityRaw: GraphEntity
    let summary: GraphList<RawAnalytics>
    let daily: GraphList<RawAnalytics>
    let previous: GraphList<RawAnalytics> | null = null
    try {
      ;[entityRaw, summary, daily, previous] = await Promise.all([
        this.call<GraphEntity>(connection, id, { fields: ENTITY_FIELDS[level] }, token),
        insights(current),
        insights({ ...current, time_increment: 1 }),
        ranges ? insights(timeParams(ranges.previous)) : Promise.resolve(null)
      ])
    } catch (error) {
      throw await this.handleGraphError(connection, error)
    }
    if (entityRaw.account_id && `act_${entityRaw.account_id}` !== accountId) throw new NotFoundException('Not found in this ad account.')

    // Best-effort extras, in parallel.
    const childLevel = level === 'campaign' ? 'adset' : level === 'adset' ? 'ad' : null
    const [ageGender, region, placement, device, impressionDevice, childrenRes, rankingRes, previousDailyRes] = await Promise.allSettled([
      insights({ ...current, breakdowns: 'age,gender' }),
      insights({ ...current, breakdowns: 'region' }),
      insights({ ...current, breakdowns: 'publisher_platform,platform_position' }),
      insights({ ...current, breakdowns: 'device_platform' }),
      insights({ ...current, breakdowns: 'impression_device' }),
      childLevel ? insights({ ...current, level: childLevel }, `${childLevel}_id,${childLevel}_name,${ANALYTICS_FIELDS}`) : Promise.resolve(null),
      level === 'ad' ? insights(current, 'quality_ranking,engagement_rate_ranking,conversion_rate_ranking') : Promise.resolve(null),
      ranges ? insights({ ...timeParams(ranges.previous), time_increment: 1 }) : Promise.resolve(null)
    ])
    const rows = (r: PromiseSettledResult<GraphList<RawAnalytics> | null>): RawAnalytics[] => (r.status === 'fulfilled' ? (r.value?.data ?? []) : [])
    for (const r of [ageGender, region, placement, device, impressionDevice, childrenRes, rankingRes, previousDailyRes]) {
      if (r.status === 'rejected' && r.reason instanceof MetaGraphError && r.reason.isAuthError) throw await this.handleGraphError(connection, r.reason)
    }

    const group = (list: RawAnalytics[], keyOf: (r: RawAnalytics) => string, labelOf: (k: string) => string = prettyLabel): MetaBreakdownRow[] => {
      const buckets = new Map<string, RawAnalytics[]>()
      for (const r of list) {
        const k = keyOf(r)
        buckets.set(k, [...(buckets.get(k) ?? []), r])
      }
      return [...buckets].map(([k, items]) => ({ key: k, label: labelOf(k), metrics: toTotals(mergeRaw(items)) }))
    }
    const bySpend = (a: MetaBreakdownRow, b: MetaBreakdownRow) => b.metrics.spend - a.metrics.spend
    const s = (v: unknown) => String(v ?? 'unknown')

    const ageGenderRows = rows(ageGender)
    const placementRows = rows(placement)
    const breakdowns: MetaAnalyticsBreakdowns = {
      age: group(ageGenderRows, (r) => s(r.age), (k) => k).sort((a, b) => AGE_ORDER.indexOf(a.key) - AGE_ORDER.indexOf(b.key)),
      gender: group(ageGenderRows, (r) => s(r.gender)).sort(bySpend),
      ageGender: ageGenderRows.map((r) => ({ key: `${s(r.age)}|${s(r.gender)}`, label: `${s(r.age)} · ${prettyLabel(s(r.gender))}`, age: s(r.age), gender: s(r.gender), metrics: toTotals(r) })),
      region: group(rows(region), (r) => s(r.region), (k) => k).sort(bySpend).slice(0, 25),
      publisher: group(placementRows, (r) => s(r.publisher_platform)).sort(bySpend),
      placement: group(placementRows, (r) => `${s(r.publisher_platform)}|${s(r.platform_position)}`, (k) => placementLabel(k)).sort(bySpend).slice(0, 12),
      device: group(rows(device), (r) => s(r.device_platform)).sort(bySpend),
      impressionDevice: group(rows(impressionDevice), (r) => s(r.impression_device)).sort(bySpend)
    }

    const children: MetaAnalyticsChild[] = rows(childrenRes)
      .map((r) => ({ id: s(r[`${childLevel}_id`]), name: s(r[`${childLevel}_name`]), metrics: toTotals(r), orders: null as MetaOrderStats | null }))
      .sort((a, b) => b.metrics.spend - a.metrics.spend)

    // Orders tied to this entity (and to each child) through their ad attribution.
    const rate = this.rateOf(account)
    let ordersStats: MetaOrderStats | null = null
    try {
      const linked = await this.linkedOrders(connection, token, accountId, account.timezoneName, ranges?.current ?? null)
      const own = this.aggregate(linked, level).acc.get(id) ?? emptyAcc()
      ordersStats = finalize(own, rate === null ? null : (summary.data[0] ? toTotals(summary.data[0]).spend : 0) * rate)
      if (childLevel) {
        const byChild = this.aggregate(linked, childLevel).acc
        for (const c of children) c.orders = finalize(byChild.get(c.id) ?? emptyAcc(), rate === null ? null : c.metrics.spend * rate)
      }
    } catch (error) {
      if (error instanceof MetaGraphError && error.isAuthError) throw await this.handleGraphError(connection, error)
      this.logger.warn(`Order stats unavailable for ${level} ${id}: ${(error as Error).message}`)
    }

    const rankRow = rows(rankingRes)[0]
    const rank = (v: unknown) => (typeof v === 'string' && v && v !== 'UNKNOWN' ? v : null)
    const days = daily.data.map(toDay).filter((d) => d.date).sort((a, b) => a.date.localeCompare(b.date))
    const currency = account.currency
    const entity: MetaAnalyticsEntity = {
      id: entityRaw.id,
      name: entityRaw.name ?? id,
      status: entityRaw.status ?? '',
      effectiveStatus: entityRaw.effective_status ?? entityRaw.status ?? '',
      objective: entityRaw.objective ?? null,
      optimizationGoal: entityRaw.optimization_goal ?? null,
      dailyBudget: fromMinorUnits(entityRaw.daily_budget, currency),
      lifetimeBudget: fromMinorUnits(entityRaw.lifetime_budget, currency),
      startTime: entityRaw.start_time ?? null,
      endTime: entityRaw.stop_time ?? entityRaw.end_time ?? null,
      thumbnailUrl: entityRaw.creative?.thumbnail_url ?? null,
      creativeTitle: entityRaw.creative?.title ?? null,
      creativeBody: entityRaw.creative?.body ?? null,
      targeting: targetingSummary(entityRaw.targeting),
      campaign: entityRaw.campaign ? { id: entityRaw.campaign.id, name: entityRaw.campaign.name ?? entityRaw.campaign.id } : null,
      adset: entityRaw.adset ? { id: entityRaw.adset.id, name: entityRaw.adset.name ?? entityRaw.adset.id } : null
    }

    const result: MetaAnalyticsResponse = {
      level,
      currency,
      timezone: account.timezoneName,
      datePreset: query.datePreset,
      range: ranges?.current ?? (days.length ? { since: days[0]!.date, until: days[days.length - 1]!.date } : null),
      previousRange: ranges?.previous ?? null,
      entity,
      totals: summary.data[0] ? toTotals(summary.data[0]) : null,
      previous: previous?.data[0] ? toTotals(previous.data[0]) : null,
      daily: days,
      previousDaily: rows(previousDailyRes).map(toDay).filter((d) => d.date).sort((a, b) => a.date.localeCompare(b.date)),
      breakdowns,
      childLevel,
      children,
      orders: ordersStats,
      exchangeRateToDzd: rate,
      rankings: level === 'ad' && rankRow ? { quality: rank(rankRow.quality_ranking), engagement: rank(rankRow.engagement_rate_ranking), conversion: rank(rankRow.conversion_rate_ranking) } : null,
      fetchedAt: new Date().toISOString()
    }
    await this.cacheSet(key, result, ANALYTICS_CACHE_SECONDS)
    return result
  }

  // ---- orders linked to ads: rates + profit ----

  // 1 account-currency unit in DZD: 1 for a DZD account, else the rate the user entered (null = unknown).
  private rateOf(account: { currency: string | null; exchangeRateToDzd: number | null }): number | null {
    return account.currency === 'DZD' ? 1 : (account.exchangeRateToDzd ?? null)
  }

  async setExchangeRate(adminUserId: string, accountId: string, input: SetMetaExchangeRate): Promise<{ accountId: string; exchangeRateToDzd: number | null }> {
    const { connection } = await this.ownedAccount(adminUserId, accountId)
    await this.prisma.metaAdAccount.update({ where: { connectionId_accountId: { connectionId: connection.id, accountId } }, data: { exchangeRateToDzd: input.rate } })
    return { accountId, exchangeRateToDzd: input.rate }
  }

  // Pages through a Graph list (500 per page, at most 5 pages).
  private async listAll<T>(connection: MetaConnection, token: string, path: string, params: Record<string, string | number | undefined>): Promise<T[]> {
    const out: T[] = []
    let after: string | undefined
    for (let page = 0; page < 5; page++) {
      const res = await this.call<GraphList<T>>(connection, path, { ...params, limit: 500, after }, token)
      out.push(...res.data)
      after = res.paging?.next ? res.paging.cursors?.after : undefined
      if (!after) break
    }
    return out
  }

  // Every campaign / ad set / ad of the account (id, name, status, parents) — what orders get matched against. Cached 5 minutes.
  private async entityIndex(connection: MetaConnection, token: string, accountId: string): Promise<EntityIndex> {
    interface Lists {
      campaigns: { id: string; name: string; effective_status?: string }[]
      adsets: { id: string; name: string; effective_status?: string; campaign_id?: string }[]
      ads: { id: string; name: string; effective_status?: string; adset_id?: string; campaign_id?: string }[]
    }
    const key = `meta:entities:${connection.id}:${accountId}`
    let lists = await this.cacheGet<Lists>(key)
    if (!lists) {
      const [campaigns, adsets, ads] = await Promise.all([
        this.listAll<Lists['campaigns'][number]>(connection, token, `${accountId}/campaigns`, { fields: 'id,name,effective_status' }),
        this.listAll<Lists['adsets'][number]>(connection, token, `${accountId}/adsets`, { fields: 'id,name,effective_status,campaign_id' }),
        this.listAll<Lists['ads'][number]>(connection, token, `${accountId}/ads`, { fields: 'id,name,effective_status,adset_id,campaign_id' })
      ])
      lists = { campaigns, adsets, ads }
      await this.cacheSet(key, lists, 300)
    }
    return {
      campaigns: new Map(lists.campaigns.map((c) => [c.id, { name: c.name, status: c.effective_status ?? '' }])),
      adsets: new Map(lists.adsets.map((c) => [c.id, { name: c.name, status: c.effective_status ?? '', campaignId: c.campaign_id ?? null }])),
      ads: new Map(lists.ads.map((c) => [c.id, { name: c.name, status: c.effective_status ?? '', adsetId: c.adset_id ?? null, campaignId: c.campaign_id ?? null }]))
    }
  }

  // Meta-attributed orders of the period, each tied to the campaign / ad set / ad it came from.
  // `isMeta` = it clearly came from Meta ads (platform or ad ids), even if no entity matched.
  private async linkedOrders(connection: MetaConnection, token: string, accountId: string, timeZone: string | null, range: DateRange | null) {
    const index = await this.entityIndex(connection, token, accountId)
    const resolve = buildMatcher(index)
    const bounds = range ? rangeBoundsUtc(range, timeZone) : null
    const orders = await this.prisma.order.findMany({
      where: {
        isAbandoned: false,
        archived: false,
        ...(bounds && { createdAt: { gte: bounds.gte, lt: bounds.lt } }),
        attribution: { is: { OR: [{ platform: 'Meta' }, { campaignId: { not: null } }, { adsetId: { not: null } }, { adId: { not: null } }, { utmCampaign: { not: null } }] } }
      },
      select: {
        id: true,
        state: true,
        totalCents: true,
        attribution: { select: { platform: true, campaignId: true, adsetId: true, adId: true, campaignName: true, adsetName: true, adName: true, utmCampaign: true, utmTerm: true, utmContent: true } },
        items: { select: { quantity: true, productId: true } },
        shipment: { select: { carrierFeeCents: true, returnFeeCents: true } }
      }
    })

    const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))]
    const products = productIds.length ? await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, costCents: true } }) : []
    const productById = new Map(products.map((p) => [p.id, p]))

    const items: { chain: Chain; isMeta: boolean; state: string; totalCents: number; productCostCents: number; carrierFeeCents: number | null; returnFeeCents: number | null; missingCost: string[] }[] = []
    for (const o of orders) {
      const a = o.attribution as AttributionHints & { platform: string }
      const chain = resolve(a)
      const hasId = !!(a.campaignId || a.adsetId || a.adId)
      const isMeta = a.platform === 'Meta' || chain.campaignId !== null || chain.adsetId !== null || chain.adId !== null
      // An id that isn't in this ad account belongs to another one.
      if (!isMeta || (hasId && a.platform !== 'Meta' && chain.campaignId === null && chain.adsetId === null && chain.adId === null)) continue
      const missingCost: string[] = []
      let productCostCents = 0
      for (const i of o.items) {
        const p = productById.get(i.productId)
        if (p?.costCents == null) missingCost.push(p?.name ?? i.productId)
        else productCostCents += p.costCents * i.quantity
      }
      items.push({ chain, isMeta, state: o.state, totalCents: o.totalCents, productCostCents, carrierFeeCents: o.shipment?.carrierFeeCents ?? null, returnFeeCents: o.shipment?.returnFeeCents ?? null, missingCost })
    }
    return { index, items }
  }

  // Sums the linked orders per entity of one level; `unlinked` = Meta orders with no entity at that level.
  private aggregate(linked: Awaited<ReturnType<MetaAdsService['linkedOrders']>>, level: MetaAnalyticsLevel) {
    const acc = new Map<string, OrderAcc>()
    let unlinked = 0
    const key = level === 'campaign' ? 'campaignId' : level === 'adset' ? 'adsetId' : 'adId'
    for (const o of linked.items) {
      const entityId = o.chain[key]
      if (!entityId) {
        unlinked += 1
        continue
      }
      const a = acc.get(entityId) ?? emptyAcc()
      addOrder(a, o)
      acc.set(entityId, a)
    }
    return { acc, unlinked }
  }

  // Confirmation / delivery / return rates and revenue / profit per campaign, ad set or ad.
  async profitability(adminUserId: string, accountId: string, query: MetaProfitabilityQuery): Promise<MetaProfitabilityResponse> {
    const { connection, token, account } = await this.ownedAccount(adminUserId, accountId)
    const { level } = query
    const key = `meta:profit:${connection.id}:${accountId}:${level}:${query.datePreset}:${account.exchangeRateToDzd ?? '-'}`
    const cached = query.refresh ? null : await this.cacheGet<MetaProfitabilityResponse>(key)
    if (cached) return cached

    const ranges = resolveRange(query.datePreset, account.timezoneName)
    const range = ranges?.current ?? null
    const rate = this.rateOf(account)

    let linked: Awaited<ReturnType<MetaAdsService['linkedOrders']>>
    let spendRows: GraphList<RawAnalytics>
    try {
      ;[linked, spendRows] = await Promise.all([
        this.linkedOrders(connection, token, accountId, account.timezoneName, range),
        this.call<GraphList<RawAnalytics>>(
          connection,
          `${accountId}/insights`,
          { fields: `${level}_id,${level}_name,spend`, level, limit: 500, ...(range ? { time_range: JSON.stringify(range) } : { date_preset: 'maximum' }) },
          token
        )
      ])
    } catch (error) {
      throw await this.handleGraphError(connection, error)
    }

    const { acc, unlinked } = this.aggregate(linked, level)
    const spendById = new Map<string, { name: string; spend: number }>()
    for (const r of spendRows.data) spendById.set(String(r[`${level}_id`]), { name: String(r[`${level}_name`] ?? ''), spend: Number(r.spend) || 0 })

    const lookup = (id: string) => (level === 'campaign' ? linked.index.campaigns.get(id) : level === 'adset' ? linked.index.adsets.get(id) : linked.index.ads.get(id))
    const ids = new Set([...acc.keys(), ...[...spendById].filter(([, v]) => v.spend > 0).map(([id]) => id)])
    const rows: MetaProfitabilityRow[] = [...ids].map((id) => {
      const spend = spendById.get(id)?.spend ?? 0
      return {
        id,
        name: spendById.get(id)?.name || lookup(id)?.name || id,
        status: lookup(id)?.status || null,
        spendAccountCurrency: spend,
        stats: finalize(acc.get(id) ?? emptyAcc(), rate === null ? null : spend * rate)
      }
    })
    rows.sort((a, b) => (b.stats.profit ?? b.stats.revenue) - (a.stats.profit ?? a.stats.revenue))

    const totalSpend = rows.reduce((s, r) => s + r.spendAccountCurrency, 0)
    const totals = finalize(sumAccs([...acc.values()]), rate === null ? null : totalSpend * rate)

    const warnings: string[] = []
    if (rate === null) warnings.push(`Set the exchange rate of this ad account (${account.currency ?? '?'} → DZD) to see profit: ad spend is in ${account.currency ?? 'its currency'}, orders are in DZD.`)
    const deliveredItems = linked.items.filter((o) => ['Delivered', 'CashCollected', 'Reconciled', 'Settled'].includes(o.state))
    const noCost = [...new Set(deliveredItems.flatMap((o) => o.missingCost))]
    if (noCost.length) warnings.push(`${noCost.length} product(s) in delivered orders have no unit cost, so their cost counts as 0: ${noCost.slice(0, 3).join(', ')}${noCost.length > 3 ? '…' : ''}. Set it in the product's Details.`)
    const noFee = deliveredItems.filter((o) => o.carrierFeeCents === null).length
    if (noFee) warnings.push(`${noFee} delivered order(s) have no courier fee recorded, so shipping cost may be understated.`)

    const result: MetaProfitabilityResponse = {
      level,
      datePreset: query.datePreset,
      range,
      accountCurrency: account.currency,
      exchangeRateToDzd: rate,
      rows,
      totals,
      unlinkedOrders: unlinked,
      warnings,
      fetchedAt: new Date().toISOString()
    }
    await this.cacheSet(key, result, 120)
    return result
  }

  async overview(adminUserId: string, accountId: string, query: MetaInsightsQuery): Promise<MetaAccountOverview> {
    const { connection, token, account } = await this.ownedAccount(adminUserId, accountId)
    const key = `meta:overview:${connection.id}:${accountId}:${query.datePreset}`
    const cached = query.refresh ? null : await this.cacheGet<MetaAccountOverview>(key)
    if (cached) return cached

    let res: GraphList<RawInsights>
    try {
      res = await this.call<GraphList<RawInsights>>(connection, `${accountId}/insights`, { fields: INSIGHT_FIELDS, date_preset: query.datePreset }, token)
    } catch (error) {
      throw await this.handleGraphError(connection, error)
    }
    const result: MetaAccountOverview = { currency: account.currency, datePreset: query.datePreset, totals: toMetrics(res.data[0]), fetchedAt: new Date().toISOString() }
    await this.cacheSet(key, result)
    return result
  }

  // ---- helpers ----

  private toAccountView(a: MetaAdAccount): MetaAdAccountView {
    return {
      accountId: a.accountId,
      name: a.name,
      currency: a.currency,
      timezoneName: a.timezoneName,
      accountStatus: a.accountStatus,
      accountStatusLabel: META_ACCOUNT_STATUS_LABELS[a.accountStatus] ?? `Status ${a.accountStatus}`,
      businessName: a.businessName,
      amountSpent: fromMinorUnits(a.amountSpent, a.currency),
      balance: fromMinorUnits(a.balance, a.currency),
      exchangeRateToDzd: this.rateOf(a),
      syncedAt: a.syncedAt.toISOString()
    }
  }

  private async activeConnection(adminUserId: string): Promise<{ connection: MetaConnection; token: string }> {
    const connection = await this.prisma.metaConnection.findUnique({ where: { adminUserId } })
    if (!connection) throw new ConflictException('Connect your Meta account first.')
    if (connection.status === 'Expired') throw new ConflictException('Your Meta session expired. Reconnect your Meta account.')
    try {
      return { connection, token: this.credentials.decrypt(connection.accessTokenEnc) }
    } catch {
      // Encryption key changed — the stored token is unreadable.
      await this.prisma.metaConnection.update({ where: { id: connection.id }, data: { status: 'Expired' } })
      throw new ConflictException('Your Meta session could not be read. Reconnect your Meta account.')
    }
  }

  // Resolves an ad account id to one of THIS user's synced accounts — never trusts the id from the URL alone.
  private async ownedAccount(adminUserId: string, accountId: string) {
    const active = await this.activeConnection(adminUserId)
    const account = await this.prisma.metaAdAccount.findUnique({ where: { connectionId_accountId: { connectionId: active.connection.id, accountId } } })
    if (!account) throw new NotFoundException('Ad account not found. Reload your ad accounts.')
    return { ...active, account }
  }

  private translate(error: unknown, fallback: string): HttpException {
    if (error instanceof MetaGraphError) {
      if (error.isRateLimit) return new HttpException('Meta rate limit reached. Try again in a few minutes.', HttpStatus.TOO_MANY_REQUESTS)
      this.logger.warn(`Meta Graph error ${error.code ?? ''}: ${error.message}`)
      return new BadGatewayException(`${fallback} (${error.message})`)
    }
    return new BadGatewayException(fallback)
  }

  private async handleGraphError(connection: MetaConnection, error: unknown): Promise<HttpException> {
    if (error instanceof MetaGraphError && error.isAuthError) {
      await this.prisma.metaConnection.update({ where: { id: connection.id }, data: { status: 'Expired' } })
      return new ConflictException('Your Meta session expired. Reconnect your Meta account.')
    }
    return this.translate(error, 'Meta could not complete the request.')
  }

  private async cacheGet<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  }

  private async cacheSet(key: string, value: unknown, ttlSeconds = CACHE_TTL_SECONDS): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
    } catch {
      // Cache is an optimisation only.
    }
  }
}
