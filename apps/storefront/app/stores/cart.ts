import { defineStore } from 'pinia'
import type { Product, ProductOffer, ProductVariant } from '@amalice/shared'
type ProductWithVariants = Product & { offers?: ProductOffer[]; variants?: ProductVariant[] }
import { offerPriceCents } from '@amalice/shared'

export interface CartItem {
  productId: string
  slug: string
  name: string
  priceCents: number
  imageUrl?: string | null
  stockQuantity: number
  quantity: number
  // Which variant (if any) was selected on the PDP when this line was added
  // — priceCents/stockQuantity above already reflect the variant's own
  // values when set (see addItem). variantLabel is a display string built
  // from the variant's attributes (e.g. "Red / Large"), so cart/checkout
  // templates don't need to re-fetch the variant to show what was picked.
  variantId?: string | null
  variantLabel?: string | null
  // Set when this line was added via a picked offer card (see the PDP's
  // offer-selection flow) — lineTotalCents overrides priceCents*quantity for
  // this line; offerId is re-validated server-side at checkout and again on
  // revalidate() here, since offers can be paused/changed after adding.
  offerId?: string | null
  lineTotalCents?: number | null
}

export interface RevalidationResult {
  removed: string[]
  changed: { name: string; oldPriceCents: number; newPriceCents: number }[]
  // Offers that were on a cart line but no longer apply (deleted, disabled,
  // or the merchant changed its terms) — the line falls back to regular
  // pricing rather than silently keeping a stale discount.
  offersChanged: { name: string }[]
}

const STORAGE_KEY = 'amalice.cart.v1'

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as CartItem[],
    hydrated: false
  }),
  getters: {
    itemCount: (state) => state.items.reduce((sum, i) => sum + i.quantity, 0),
    totalCents: (state) => state.items.reduce((sum, i) => sum + (i.lineTotalCents ?? i.priceCents * i.quantity), 0)
  },
  actions: {
    // localStorage is only readable client-side; the store starts empty on
    // the server and hydrates once mounted, matching Nuxt's SSR/client split.
    hydrate() {
      if (this.hydrated || !import.meta.client) return
      this.hydrated = true
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      try {
        this.items = JSON.parse(raw)
      } catch {
        this.items = []
      }
    },
    persist() {
      if (!import.meta.client) return
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items))
    },
    // `offer`, when given, is a picked offer card (see products/[slug].vue) —
    // it REPLACES this line's quantity/pricing outright (matching the
    // "customer picks an offer card" interaction, not an incremental add),
    // rather than stacking on top of whatever was already in the cart.
    // `variant`, when given, is the PDP's currently-selected variant — its
    // own priceCents/stockQuantity are used instead of the base product's,
    // and its id/label are carried through to checkout and the order so the
    // order records exactly what was picked. One cart line per product
    // (matching the existing productId-keyed model, not a per-variant line)
    // — picking a different variant on a re-add updates the existing line's
    // variant/price the same way picking a different offer already does.
    addItem(product: Product, quantity = 1, offer: ProductOffer | null = null, variant: ProductVariant | null = null) {
      const existing = this.items.find((i) => i.productId === product.id)
      const offerId = offer?.id ?? null
      const priceCents = variant?.priceCents ?? product.priceCents
      const stockQuantity = variant?.stockQuantity ?? product.stockQuantity
      const variantId = variant?.id ?? null
      const variantLabel = variant ? Object.values(variant.attributes).join(' / ') : null
      const lineTotalCents = offer ? offerPriceCents(offer, priceCents) : null

      if (existing) {
        existing.priceCents = priceCents
        existing.stockQuantity = stockQuantity
        existing.variantId = variantId
        existing.variantLabel = variantLabel
        if (offer) {
          existing.quantity = Math.min(quantity, stockQuantity)
          existing.offerId = offerId
          existing.lineTotalCents = lineTotalCents
        } else {
          existing.quantity = Math.min(existing.quantity + quantity, stockQuantity)
          existing.offerId = null
          existing.lineTotalCents = null
        }
      } else {
        this.items.push({
          productId: product.id,
          slug: product.slug,
          name: product.name,
          priceCents,
          imageUrl: product.imageUrl,
          stockQuantity,
          quantity: Math.min(quantity, stockQuantity),
          variantId,
          variantLabel,
          offerId,
          lineTotalCents
        })
      }
      this.persist()
      // AddToCart — browser-only for both pixels, no server-side
      // counterpart (low enough value per event that CAPI/Events API
      // dedication isn't worth the plumbing; Purchase/CompletePayment is
      // where the server-side channel actually matters).
      useMetaPixel().trackEvent('AddToCart', {
        content_ids: [product.id],
        content_type: 'product',
        contents: [{ id: product.id, quantity }],
        value: (priceCents * quantity) / 100,
        currency: 'DZD'
      })
      useTikTokPixel().trackEvent('AddToCart', {
        contents: [{ content_id: product.id, quantity, price: priceCents / 100 }],
        value: (priceCents * quantity) / 100,
        currency: 'DZD'
      })
    },
    setQuantity(productId: string, quantity: number) {
      const item = this.items.find((i) => i.productId === productId)
      if (!item) return
      if (quantity <= 0) {
        this.removeItem(productId)
        return
      }
      item.quantity = Math.min(quantity, item.stockQuantity)
      // A manual quantity change no longer matches whatever offer set this
      // line's price — fall back to regular pricing rather than keep a
      // discount that no longer corresponds to what's in the cart.
      item.offerId = null
      item.lineTotalCents = null
      this.persist()
    },
    removeItem(productId: string) {
      this.items = this.items.filter((i) => i.productId !== productId)
      this.persist()
    },
    clear() {
      this.items = []
      this.persist()
    },
    // Re-fetches live price/stock for every cart line. Called on the cart
    // page and again at checkout start (SF-05) — never trust the cached
    // client total for the actual order.
    async revalidate(apiClient: ReturnType<typeof $fetch.create>): Promise<RevalidationResult> {
      const result: RevalidationResult = { removed: [], changed: [], offersChanged: [] }

      const settled = await Promise.all(
        this.items.map(async (item) => {
          try {
            const live = await apiClient<ProductWithVariants>(`/products/${item.slug}`)
            return { item, live, confirmedGone: false }
          } catch (err: unknown) {
            // Only a confirmed 404 means the product is actually gone. Any
            // other failure (network blip, 429, 500) must NOT wipe the
            // user's cart — keep the cached line as-is and let the next
            // revalidation attempt (e.g. at checkout) retry.
            const status =
              (err as { statusCode?: number; response?: { status?: number } })?.statusCode ??
              (err as { response?: { status?: number } })?.response?.status
            return { item, live: null, confirmedGone: status === 404 }
          }
        })
      )

      const next: CartItem[] = []
      for (const { item, live, confirmedGone } of settled) {
        if (!live) {
          if (confirmedGone) {
            result.removed.push(item.name)
          } else {
            next.push(item)
          }
          continue
        }
        // Re-price/re-stock off the matching variant when this line has
        // one — a variant that's since been deleted falls back to the base
        // product (better than silently dropping the line over a variant
        // pruned from the catalog).
        const liveVariant = item.variantId ? live.variants?.find((v) => v.id === item.variantId) : undefined
        const livePriceCents = liveVariant?.priceCents ?? live.priceCents
        const liveStockQuantity = liveVariant?.stockQuantity ?? live.stockQuantity

        if (livePriceCents !== item.priceCents) {
          result.changed.push({
            name: live.name,
            oldPriceCents: item.priceCents,
            newPriceCents: livePriceCents
          })
        }
        const quantity = Math.min(item.quantity, liveStockQuantity)
        if (quantity <= 0) {
          result.removed.push(live.name)
          continue
        }

        let offerId = item.offerId ?? null
        let lineTotalCents: number | null = null
        if (offerId) {
          const liveOffer = live.offers?.find((o) => o.id === offerId && o.enabled)
          const expectedQuantity = liveOffer ? (liveOffer.type === 'BuyXGetYFree' ? liveOffer.requiredQuantity + liveOffer.freeQuantity : liveOffer.requiredQuantity) : null
          if (!liveOffer || expectedQuantity !== quantity) {
            offerId = null
            result.offersChanged.push({ name: live.name })
          } else {
            lineTotalCents = offerPriceCents(liveOffer, livePriceCents)
          }
        }

        next.push({
          ...item,
          name: live.name,
          priceCents: livePriceCents,
          stockQuantity: liveStockQuantity,
          quantity,
          offerId,
          lineTotalCents
        })
      }

      this.items = next
      this.persist()
      return result
    }
  }
})
