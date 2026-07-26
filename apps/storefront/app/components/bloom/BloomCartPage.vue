<script setup lang="ts">
import type { RevalidationResult } from '~/stores/cart'
import type { CartItem } from '~/stores/cart'

// Bloom cart — rounded line-item list left, sticky glow-card order summary
// right. No @nuxt/ui.
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
  <div class="bg-[var(--color-bloom-blush)]">
    <div class="bg-gradient-to-br from-[var(--color-bloom-hero-from)] to-[var(--color-bloom-hero-to)]">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          <NuxtLink to="/" class="hover:text-primary-600">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-[var(--color-bloom-ink)]">Bag</span>
        </nav>
        <h1 class="font-display text-4xl text-[var(--color-bloom-ink)] sm:text-5xl">Your bag</h1>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <ClientOnly>
        <div v-if="props.notice" class="glow-card mb-6 flex items-start gap-3 p-4">
          <Icon name="i-lucide-alert-triangle" class="mt-0.5 size-5 shrink-0 text-primary-600" />
          <div>
            <p class="font-medium text-[var(--color-bloom-ink)]">Your bag changed</p>
            <p class="text-sm text-neutral-500">
              {{ [
                ...props.notice.removed.map((n) => `${n} is no longer available and was removed.`),
                ...props.notice.changed.map((c) => `${c.name}'s price changed.`)
              ].join(' ') }}
            </p>
          </div>
          <button class="ml-auto text-neutral-400" aria-label="Dismiss" @click="props.onDismissNotice"><Icon name="i-lucide-x" class="size-4" /></button>
        </div>

        <EmptyState v-if="props.cart.items.length === 0" icon="i-lucide-shopping-bag" title="Your bag is empty" description="Browse the shop to add something.">
          <BloomButton to="/catalog" class="mt-4">Continue shopping</BloomButton>
        </EmptyState>

        <div v-else class="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div class="lg:col-span-2">
            <div class="glow-card divide-y divide-neutral-100">
              <div v-for="item in props.cart.items" :key="item.productId" class="flex flex-wrap items-center gap-4 p-5">
                <NuxtLink :to="`/products/${item.slug}`" class="size-20 shrink-0 overflow-hidden rounded-2xl bg-[var(--color-bloom-blush)]">
                  <NuxtImg v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" class="size-full object-cover" width="80" height="80" />
                </NuxtLink>
                <div class="min-w-0 flex-1">
                  <NuxtLink :to="`/products/${item.slug}`" class="line-clamp-1 font-medium text-[var(--color-bloom-ink)] hover:text-primary-600">{{ item.name }}</NuxtLink>
                  <PriceDisplay :amount-cents="item.priceCents" class="mt-0.5 block text-sm text-neutral-400" />
                </div>
                <BloomQuantityStepper :model-value="item.quantity" :min="1" :max="item.stockQuantity" @update:model-value="(v) => props.cart.setQuantity(item.productId, v)" />
                <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="w-24 text-right font-semibold text-[var(--color-bloom-ink)]" />
                <button class="flex size-9 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-primary-50 hover:text-primary-600" aria-label="Remove item" @click="props.cart.removeItem(item.productId)">
                  <Icon name="i-lucide-trash-2" class="size-4" />
                </button>
              </div>
            </div>
          </div>

          <div class="lg:col-span-1">
            <div class="glow-card sticky top-24 p-6">
              <h2 class="font-display mb-4 text-2xl text-[var(--color-bloom-ink)]">Summary</h2>
              <div class="space-y-3 text-sm">
                <div class="flex items-center justify-between"><span class="text-neutral-500">Items ({{ props.cart.itemCount }})</span><PriceDisplay :amount-cents="props.cart.totalCents" class="font-medium" /></div>
                <div class="flex items-center justify-between"><span class="text-neutral-500">Shipping</span><span class="font-medium text-primary-600">Free</span></div>
              </div>
              <div class="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4">
                <span class="font-medium text-[var(--color-bloom-ink)]">Total</span>
                <PriceDisplay :amount-cents="props.cart.totalCents" class="text-xl font-semibold text-primary-600" />
              </div>
              <p class="mt-2 flex items-center gap-1.5 text-xs text-neutral-400"><Icon name="i-lucide-banknote" class="size-3.5" /> Cash on delivery available</p>
              <BloomButton to="/checkout" block size="lg" trailing-icon="i-lucide-arrow-right" class="mt-5">Checkout</BloomButton>
              <BloomButton to="/catalog" block variant="ghost" color="neutral" class="mt-2">Continue shopping</BloomButton>
            </div>
          </div>
        </div>

        <template #fallback>
          <div class="flex items-center justify-center py-24 text-neutral-400">
            <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
          </div>
        </template>
      </ClientOnly>
    </section>
  </div>
</template>
