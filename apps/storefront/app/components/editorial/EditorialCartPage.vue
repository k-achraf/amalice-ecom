<script setup lang="ts">
import type { CartItem, RevalidationResult } from '~/stores/cart'

// Editorial cart — a magazine-style table with large type, uppercase labels,
// bold totals. Distinct from minimal's plain list.
const props = defineProps<{
  cart: {
    items: CartItem[]
    itemCount: number
    totalCents: number
    setQuantity: (productId: string, quantity: number) => void
    removeItem: (productId: string) => void
  }
  notice: RevalidationResult | null
  revalidating: boolean
  onDismissNotice: () => void
}>()
</script>

<template>
  <div class="bg-default">
    <div class="mx-auto max-w-4xl px-4 py-16">
      <p class="text-center kicker">Your selection</p>
      <h1 class="mt-2 text-center text-4xl font-bold tracking-tight text-highlighted sm:text-5xl">The Bag</h1>

      <EditorialAlert
        v-if="props.notice"
        color="warning"
        icon="i-lucide-alert-triangle"
        title="Your cart changed"
        :description="[...props.notice.removed.map((n) => `${n} is no longer available and was removed.`), ...props.notice.changed.map((c) => `${c.name}'s price changed.`)].join(' ')"
        closable
        class="mt-8"
        @close="props.onDismissNotice"
      />

      <ClientOnly>
        <EmptyState v-if="props.cart.items.length === 0" icon="i-lucide-shopping-cart" title="Your bag is empty" description="Browse the catalog to add something." class="mt-12">
          <EditorialButton to="/catalog" class="!bg-highlighted !text-inverted">Continue shopping</EditorialButton>
        </EmptyState>

        <template v-else>
          <div class="mt-10 border-t-2 border-highlighted">
            <div v-for="item in props.cart.items" :key="item.productId" class="grid grid-cols-12 items-center gap-4 border-b border-default py-6">
              <div class="col-span-3 size-20 overflow-hidden rounded-sm bg-elevated">
                <NuxtImg v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" class="size-full object-cover" width="80" height="80" />
              </div>
              <div class="col-span-5">
                <NuxtLink :to="`/products/${item.slug}`" class="text-lg font-bold tracking-tight text-highlighted hover:underline">{{ item.name }}</NuxtLink>
                <PriceDisplay :amount-cents="item.priceCents" class="block text-sm text-muted" />
              </div>
              <div class="col-span-2">
                <EditorialQuantityStepper :model-value="item.quantity" :min="1" :max="item.stockQuantity" @update:model-value="(v: number) => props.cart.setQuantity(item.productId, v)" />
              </div>
              <div class="col-span-2 flex items-center justify-end gap-3">
                <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="text-lg font-bold tabular" />
                <EditorialButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" square aria-label="Remove" @click="props.cart.removeItem(item.productId)" />
              </div>
            </div>
          </div>

          <div class="mt-8 flex items-center justify-between border-t-2 border-highlighted pt-6">
            <span class="text-sm font-semibold text-muted">Total</span>
            <PriceDisplay :amount-cents="props.cart.totalCents" class="text-3xl font-bold" />
          </div>

          <EditorialButton to="/checkout" size="lg" block class="mt-8 !bg-highlighted !text-inverted hover:!bg-highlighted/80">Proceed to checkout</EditorialButton>
        </template>

        <template #fallback>
          <div class="py-24 text-center text-muted">Loading…</div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
