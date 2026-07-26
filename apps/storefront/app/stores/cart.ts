import { defineStore } from 'pinia'
import type { Product } from '@amalice/shared'

export interface CartItem {
  productId: string
  slug: string
  name: string
  priceCents: number
  imageUrl?: string | null
  stockQuantity: number
  quantity: number
}

export interface RevalidationResult {
  removed: string[]
  changed: { name: string; oldPriceCents: number; newPriceCents: number }[]
}

const STORAGE_KEY = 'amalice.cart.v1'

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as CartItem[],
    hydrated: false
  }),
  getters: {
    itemCount: (state) => state.items.reduce((sum, i) => sum + i.quantity, 0),
    totalCents: (state) => state.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0)
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
    addItem(product: Product, quantity = 1) {
      const existing = this.items.find((i) => i.productId === product.id)
      if (existing) {
        existing.quantity = Math.min(existing.quantity + quantity, product.stockQuantity)
      } else {
        this.items.push({
          productId: product.id,
          slug: product.slug,
          name: product.name,
          priceCents: product.priceCents,
          imageUrl: product.imageUrl,
          stockQuantity: product.stockQuantity,
          quantity: Math.min(quantity, product.stockQuantity)
        })
      }
      this.persist()
    },
    setQuantity(productId: string, quantity: number) {
      const item = this.items.find((i) => i.productId === productId)
      if (!item) return
      if (quantity <= 0) {
        this.removeItem(productId)
        return
      }
      item.quantity = Math.min(quantity, item.stockQuantity)
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
      const result: RevalidationResult = { removed: [], changed: [] }

      const settled = await Promise.all(
        this.items.map(async (item) => {
          try {
            const live = await apiClient<Product>(`/products/${item.slug}`)
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
        if (live.priceCents !== item.priceCents) {
          result.changed.push({
            name: live.name,
            oldPriceCents: item.priceCents,
            newPriceCents: live.priceCents
          })
        }
        const quantity = Math.min(item.quantity, live.stockQuantity)
        if (quantity <= 0) {
          result.removed.push(live.name)
          continue
        }
        next.push({
          ...item,
          name: live.name,
          priceCents: live.priceCents,
          stockQuantity: live.stockQuantity,
          quantity
        })
      }

      this.items = next
      this.persist()
      return result
    }
  }
})
