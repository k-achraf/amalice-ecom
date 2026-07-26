<script setup lang="ts">
import type { RevalidationResult } from '~/stores/cart'
import type { CartItem } from '~/stores/cart'

// Trove cart — sharp-cornered line-item list left, sticky trove-card order
// summary right. Line-item thumbnails use the circular-photo motif. No
// @nuxt/ui.
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
  <div class="bg-[var(--color-trove-cream)]">
    <div class="border-b border-neutral-200 bg-white">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-400">
          <NuxtLink to="/" class="hover:text-[var(--color-trove-teal)]">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-neutral-600">Cart</span>
        </nav>
        <h1 class="font-display text-4xl text-[var(--color-trove-ink)] sm:text-5xl">Your cart</h1>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <ClientOnly>
        <TroveAlert
          v-if="props.notice"
          color="warning"
          icon="i-lucide-alert-triangle"
          title="Your cart changed"
          :description="
            [
              ...props.notice.removed.map((n) => `${n} is no longer available and was removed.`),
              ...props.notice.changed.map((c) => `${c.name}'s price changed.`)
            ].join(' ')
          "
          closable
          class="mb-6"
          @close="props.onDismissNotice"
        />

        <EmptyState v-if="props.cart.items.length === 0" icon="i-lucide-shopping-bag" title="Your cart is empty" description="Browse the trove to add a find.">
          <TroveButton to="/catalog" class="mt-4">Continue shopping</TroveButton>
        </EmptyState>

        <div v-else class="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div class="lg:col-span-2">
            <div class="trove-card divide-y divide-neutral-100">
              <div v-for="item in props.cart.items" :key="item.productId" class="flex flex-wrap items-center gap-4 p-5">
                <NuxtLink :to="`/products/${item.slug}`" class="trove-photo size-16 shrink-0">
                  <NuxtImg v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" class="size-full object-cover" width="64" height="64" />
                  <div v-else class="flex size-full items-center justify-center bg-neutral-100"><Icon name="i-lucide-image" class="size-5 text-neutral-300" /></div>
                </NuxtLink>
                <div class="min-w-0 flex-1">
                  <NuxtLink :to="`/products/${item.slug}`" class="line-clamp-1 font-medium text-[var(--color-trove-ink)] hover:text-primary-700">{{ item.name }}</NuxtLink>
                  <PriceDisplay :amount-cents="item.priceCents" class="mt-0.5 block text-sm text-neutral-400" />
                </div>
                <TroveQuantityStepper :model-value="item.quantity" :min="1" :max="item.stockQuantity" @update:model-value="(v) => props.cart.setQuantity(item.productId, v)" />
                <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="w-24 text-right font-bold text-[var(--color-trove-ink)]" />
                <button class="flex size-9 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-primary-50 hover:text-primary-700" aria-label="Remove item" @click="props.cart.removeItem(item.productId)">
                  <Icon name="i-lucide-trash-2" class="size-4" />
                </button>
              </div>
            </div>
          </div>

          <div class="lg:col-span-1">
            <div class="trove-card sticky top-24 p-6">
              <h2 class="font-display mb-4 text-xl text-[var(--color-trove-ink)]">Summary</h2>
              <div class="space-y-3 text-sm">
                <div class="flex items-center justify-between"><span class="text-neutral-500">Items ({{ props.cart.itemCount }})</span><PriceDisplay :amount-cents="props.cart.totalCents" class="font-medium" /></div>
                <div class="flex items-center justify-between"><span class="text-neutral-500">Shipping</span><span class="font-bold text-primary-700">Free</span></div>
              </div>
              <div class="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4">
                <span class="font-medium text-[var(--color-trove-ink)]">Total</span>
                <PriceDisplay :amount-cents="props.cart.totalCents" class="text-xl font-bold text-primary-700" />
              </div>
              <p class="mt-2 flex items-center gap-1.5 text-xs text-neutral-400"><Icon name="i-lucide-banknote" class="size-3.5" /> Cash on delivery available</p>
              <TroveButton to="/checkout" block size="lg" trailing-icon="i-lucide-arrow-right" class="mt-5">Checkout</TroveButton>
              <TroveButton to="/catalog" block variant="ghost" class="mt-2">Continue shopping</TroveButton>
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
