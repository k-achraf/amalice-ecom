import { BadGatewayException, BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  SOCIAL_INSTAGRAM_SCOPES,
  SOCIAL_REQUIRED_SCOPES,
  type ConnectSocial,
  type PublishProductSocial,
  type SocialAccountView,
  type SocialCaption,
  type SocialPostView,
  type SocialPublishResult,
  type SocialStatus
} from '@amalice/shared'
import type { Env } from '../config/env.validation'
import { AuditService, type AuditActor } from '../common/audit.service'
import { PrismaService } from '../prisma/prisma.service'
import type { SocialAccount, SocialPost } from '../generated/prisma/client'
import { MetaCredentialsService } from '../meta-ads/meta-credentials.service'
import { MetaGraphError, MetaGraphService } from '../meta-ads/meta-graph.service'

interface GraphPage {
  id: string
  name: string
  access_token?: string
  instagram_business_account?: { id: string; username?: string }
}

const CAPTION_LIMIT = 2200
const DESCRIPTION_LIMIT = 600

const stripHtml = (html: string): string =>
  html
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: MetaGraphService,
    private readonly credentials: MetaCredentialsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>
  ) {}

  // ---- accounts ----

  async status(): Promise<SocialStatus> {
    const accounts = await this.prisma.socialAccount.findMany({ orderBy: [{ platform: 'asc' }, { name: 'asc' }] })
    return { accounts: accounts.map((a) => this.toAccountView(a)), missingScopes: [] }
  }

  // Pasted token (user token or Business Manager system-user token): lists the Pages it manages with their
  // Page tokens, plus each Page's linked Instagram business account. Page tokens derived from a long-lived
  // user token do not expire, so they are stored as-is (encrypted).
  async connect(input: ConnectSocial, actor: AuditActor): Promise<SocialStatus> {
    const userToken = input.accessToken.trim()
    let pages: GraphPage[]
    let granted: string[] = []
    try {
      const res = await this.graph.get<{ data: GraphPage[] }>('me/accounts', { fields: 'id,name,access_token,instagram_business_account{id,username}', limit: 100 }, userToken)
      pages = res.data
      try {
        const permissions = await this.graph.get<{ data: { permission: string; status: string }[] }>('me/permissions', {}, userToken)
        granted = permissions.data.filter((p) => p.status === 'granted').map((p) => p.permission)
      } catch {
        // System-user tokens may not expose this; the Pages list above already proved access.
      }
    } catch (error) {
      if (error instanceof MetaGraphError) {
        throw new BadRequestException(error.isAuthError ? 'Meta rejected this access token. Generate a new one and paste it again.' : `Meta could not use this token: ${error.message}`)
      }
      throw new BadGatewayException('Could not check the access token with Meta.')
    }
    const usable = pages.filter((p) => p.access_token)
    if (!usable.length) {
      throw new BadRequestException('This token manages no Facebook Pages. Make sure pages_show_list and pages_manage_posts were granted and that you picked your Pages.')
    }
    const missing = granted.length ? SOCIAL_REQUIRED_SCOPES.filter((s) => !granted.includes(s)) : []
    if (missing.includes('pages_manage_posts')) {
      throw new BadRequestException(`The token is missing the permission: ${missing.join(', ')}.`)
    }
    const canInstagram = !granted.length || SOCIAL_INSTAGRAM_SCOPES.every((s) => granted.includes(s))
    for (const page of usable) {
      const token = this.credentials.encrypt(page.access_token as string)
      await this.upsertAccount('Facebook', page.id, page.name, null, token)
      const ig = page.instagram_business_account
      if (ig && canInstagram) await this.upsertAccount('Instagram', ig.id, ig.username ?? page.name, ig.username ?? null, token)
    }
    await this.audit.log({ actor, action: 'Create', entity: 'SocialAccount', entityId: 'connect', metadata: { pages: usable.map((p) => p.name) } })
    return { ...(await this.status()), missingScopes: missing }
  }

  private upsertAccount(platform: 'Facebook' | 'Instagram', externalId: string, name: string, handle: string | null, accessTokenEnc: string) {
    return this.prisma.socialAccount.upsert({
      where: { platform_externalId: { platform, externalId } },
      create: { platform, externalId, name, handle, accessTokenEnc },
      update: { name, handle, accessTokenEnc, status: 'Active' }
    })
  }

  async removeAccount(id: string, actor: AuditActor): Promise<{ ok: true }> {
    const account = await this.prisma.socialAccount.findUnique({ where: { id } })
    if (!account) return { ok: true }
    await this.prisma.socialAccount.delete({ where: { id } })
    await this.audit.log({ actor, action: 'Delete', entity: 'SocialAccount', entityId: id, metadata: { platform: account.platform, name: account.name } })
    return { ok: true }
  }

  // ---- products ----

  private productUrl(slug: string): string {
    return `${this.config.get('PUBLIC_STOREFRONT_URL', { infer: true }).replace(/\/$/, '')}/products/${slug}`
  }

  private absoluteImage(url: string | null | undefined): string | null {
    if (!url) return null
    if (/^https?:\/\//i.test(url)) return url
    return `${this.config.get('PUBLIC_API_URL', { infer: true }).replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
  }

  private async loadProduct(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } } })
    if (!product) throw new NotFoundException('Product not found')
    return product
  }

  // Default caption: name, short description, key benefits, price and the storefront link. Editable before publishing.
  async caption(productId: string, language: 'ar' | 'fr'): Promise<SocialCaption> {
    const product = await this.loadProduct(productId)
    const link = this.productUrl(product.slug)
    const ar = language === 'ar'
    const lines: string[] = [`✨ ${product.name}`]
    const description = product.description ? stripHtml(product.description) : ''
    if (description) lines.push('', description.length > DESCRIPTION_LIMIT ? `${description.slice(0, DESCRIPTION_LIMIT).trimEnd()}…` : description)
    if (product.keyBenefits.length) lines.push('', ...product.keyBenefits.slice(0, 5).map((b) => `✅ ${b}`))
    if (product.priceCents > 0) lines.push('', `${ar ? '💰 السعر' : '💰 Prix'}: ${Math.round(product.priceCents / 100).toLocaleString('en-US')} ${ar ? 'دج' : 'DA'}`)
    lines.push(ar ? '🚚 الدفع عند الاستلام' : '🚚 Paiement à la livraison', '', `${ar ? '🛒 اطلب الآن' : '🛒 Commandez'}: ${link}`)
    const imageUrl = product.images[0]?.url ?? product.imageUrl
    return { message: lines.join('\n').slice(0, CAPTION_LIMIT), link, hasImage: !!imageUrl }
  }

  async posts(productId: string): Promise<SocialPostView[]> {
    const rows = await this.prisma.socialPost.findMany({ where: { productId }, include: { account: true }, orderBy: { createdAt: 'desc' }, take: 50 })
    return rows.map((r) => this.toPostView(r, r.account))
  }

  async publish(productId: string, input: PublishProductSocial, actor: AuditActor): Promise<SocialPublishResult> {
    const product = await this.loadProduct(productId)
    const accounts = await this.prisma.socialAccount.findMany({ where: { id: { in: input.accountIds } } })
    if (!accounts.length) throw new BadRequestException('Pick at least one connected page.')
    const imageUrl = this.absoluteImage(product.images[0]?.url ?? product.imageUrl)
    const link = this.productUrl(product.slug)
    const message = input.message?.trim() || (await this.caption(productId, 'ar')).message
    const posts: SocialPostView[] = []
    for (const account of accounts) {
      let result: { id: string; url: string | null } | null = null
      let error: string | null = null
      try {
        if (account.status === 'Expired') throw new ConflictException('This page was disconnected by Meta. Reconnect it from Apps → Social pages.')
        result = account.platform === 'Facebook' ? await this.publishFacebook(account, message, imageUrl, link) : await this.publishInstagram(account, message, imageUrl)
      } catch (e) {
        error = await this.describeError(account, e)
      }
      const row = await this.prisma.socialPost.create({
        data: { productId, accountId: account.id, status: result ? 'Published' : 'Failed', message, externalId: result?.id ?? null, externalUrl: result?.url ?? null, error }
      })
      posts.push(this.toPostView(row, account))
    }
    await this.audit.log({
      actor,
      action: 'Update',
      entity: 'Product',
      entityId: productId,
      metadata: { socialPublish: posts.map((p) => `${p.platform}:${p.accountName}:${p.status}`) }
    })
    return { posts }
  }

  private async publishFacebook(account: SocialAccount, message: string, imageUrl: string | null, link: string): Promise<{ id: string; url: string | null }> {
    const token = this.credentials.decrypt(account.accessTokenEnc)
    // A photo post shows the product picture large; without a picture, a link post.
    const res = imageUrl
      ? await this.graph.post<{ id: string; post_id?: string }>(`${account.externalId}/photos`, { url: imageUrl, caption: message }, token)
      : await this.graph.post<{ id: string; post_id?: string }>(`${account.externalId}/feed`, { message, link }, token)
    const postId = res.post_id ?? res.id
    return { id: postId, url: `https://www.facebook.com/${postId}` }
  }

  private async publishInstagram(account: SocialAccount, message: string, imageUrl: string | null): Promise<{ id: string; url: string | null }> {
    if (!imageUrl) throw new BadRequestException('Instagram needs a product image. Add an image to the product first.')
    const token = this.credentials.decrypt(account.accessTokenEnc)
    const container = await this.graph.post<{ id: string }>(`${account.externalId}/media`, { image_url: imageUrl, caption: message }, token)
    const published = await this.graph.post<{ id: string }>(`${account.externalId}/media_publish`, { creation_id: container.id }, token)
    let url: string | null = null
    try {
      url = (await this.graph.get<{ permalink?: string }>(published.id, { fields: 'permalink' }, token)).permalink ?? null
    } catch {
      // The post is live; the link is a nicety.
    }
    return { id: published.id, url }
  }

  private async describeError(account: SocialAccount, error: unknown): Promise<string> {
    if (error instanceof MetaGraphError) {
      if (error.isAuthError) {
        await this.prisma.socialAccount.update({ where: { id: account.id }, data: { status: 'Expired' } })
        return 'Meta rejected the page token. Reconnect the page from Apps → Social pages.'
      }
      this.logger.warn(`Social publish to ${account.platform}/${account.name} failed: ${error.code ?? ''} ${error.message}`)
      return error.message
    }
    if (error instanceof Error) return error.message
    return 'Could not publish.'
  }

  private toAccountView(a: SocialAccount): SocialAccountView {
    return { id: a.id, platform: a.platform, name: a.name, handle: a.handle, status: a.status, connectedAt: a.createdAt.toISOString() }
  }

  private toPostView(p: SocialPost, a: SocialAccount): SocialPostView {
    return { id: p.id, accountId: a.id, platform: a.platform, accountName: a.name, status: p.status, externalUrl: p.externalUrl, error: p.error, createdAt: p.createdAt.toISOString() }
  }
}
