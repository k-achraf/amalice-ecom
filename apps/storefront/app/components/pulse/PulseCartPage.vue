<script setup lang="ts">
import type { RevalidationResult } from '~/stores/cart'
import type { CartItem } from '~/stores/cart'

// Pulse cart — rounded line-item list left, sticky glow-card order summary
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
  <div class="bg-white">
    <div class="mesh-bg border-b border-neutral-100">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
          <NuxtLink to="/" class="hover:text-primary-600">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-neutral-600">Cart</span>
        </nav>
        <h1 class="font-display text-4xl text-neutral-900 sm:text-5xl">Your cart</h1>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <ClientOnly>
        <PulseAlert
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

        <EmptyState v-if="props.cart.items.length === 0" icon="i-lucide-shopping-bag" title="Your cart is empty" description="Browse the catalog to add something.">
          <PulseButton to="/catalog" class="mt-4">Continue shopping</PulseButton>
        </EmptyState>

        <div v-else class="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div class="lg:col-span-2">
            <div class="glow-card divide-y divide-neutral-100">
              <div v-for="item in props.cart.items" :key="item.productId" class="flex flex-wrap items-center gap-4 p-5">
                <NuxtLink :to="`/products/${item.slug}`" class="size-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-50">
                  <NuxtImg v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" class="size-full object-cover" width="80" height="80" />
                </NuxtLink>
                <div class="min-w-0 flex-1">
                  <NuxtLink :to="`/products/${item.slug}`" class="line-clamp-1 font-medium text-neutral-900 hover:text-primary-600">{{ item.name }}</NuxtLink>
                  <PriceDisplay :amount-cents="item.priceCents" class="mt-0.5 block text-sm text-neutral-400" />
                </div>
                <PulseQuantityStepper :model-value="item.quantity" :min="1" :max="item.stockQuantity" @update:model-value="(v) => props.cart.setQuantity(item.productId, v)" />
                <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="w-24 text-right font-semibold text-neutral-900" />
                <button class="flex size-9 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-primary-50 hover:text-primary-600" aria-label="Remove item" @click="props.cart.removeItem(item.productId)">
                  <Icon name="i-lucide-trash-2" class="size-4" />
                </button>
              </div>
            </div>
          </div>

          <div class="lg:col-span-1">
            <div class="glow-card sticky top-24 p-6">
              <h2 class="font-display mb-4 text-xl text-neutral-900">Summary</h2>
              <div class="space-y-3 text-sm">
                <div class="flex items-center justify-between"><span class="text-neutral-500">Items ({{ props.cart.itemCount }})</span><PriceDisplay :amount-cents="props.cart.totalCents" class="font-medium" /></div>
                <div class="flex items-center justify-between"><span class="text-neutral-500">Shipping</span><span class="font-medium text-primary-600">Free</span></div>
              </div>
              <div class="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4">
                <span class="font-medium text-neutral-900">Total</span>
                <PriceDisplay :amount-cents="props.cart.totalCents" class="text-xl font-semibold text-primary-600" />
              </div>
              <p class="mt-2 flex items-center gap-1.5 text-xs text-neutral-400"><Icon name="i-lucide-banknote" class="size-3.5" /> Cash on delivery available</p>
              <PulseButton to="/checkout" block size="lg" trailing-icon="i-lucide-arrow-right" class="mt-5">Checkout</PulseButton>
              <PulseButton to="/catalog" block variant="ghost" color="neutral" class="mt-2">Continue shopping</PulseButton>
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
