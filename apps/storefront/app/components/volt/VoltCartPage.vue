<script setup lang="ts">
import type { RevalidationResult } from '~/stores/cart'
import type { CartItem } from '~/stores/cart'

// Volt cart — hairline-bordered line-item list + sticky order summary
// panel. Tabular monospace prices throughout. No @nuxt/ui.
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
  <div class="bg-black">
    <div class="border-b border-white/10 bg-black">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav class="font-mono-spec mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-white/40">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-primary-400">Cart</span>
        </nav>
        <h1 class="font-display text-3xl text-white sm:text-4xl">Your shopping cart</h1>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <ClientOnly>
        <VoltAlert
          v-if="props.notice"
          color="warning"
          icon="i-lucide-alert-triangle"
          title="Your cart changed"
          :description="[
            ...props.notice.removed.map((n) => `${n} is no longer available and was removed.`),
            ...props.notice.changed.map((c) => `${c.name}'s price changed.`)
          ].join(' ')"
          closable
          class="mb-6"
          @close="props.onDismissNotice"
        />

        <EmptyState v-if="props.cart.items.length === 0" icon="i-lucide-shopping-cart" title="Your cart is empty" description="Browse the catalog to add something.">
          <VoltButton to="/catalog" class="mt-4">Continue shopping</VoltButton>
        </EmptyState>

        <div v-else class="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div class="lg:col-span-2">
            <div class="rounded-md border border-white/10 bg-[#0c1113]">
              <ul class="divide-y divide-white/10">
                <li v-for="item in props.cart.items" :key="item.productId" class="flex flex-wrap items-center gap-4 p-5">
                  <NuxtLink :to="`/products/${item.slug}`" class="size-20 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black">
                    <NuxtImg v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" class="size-full object-cover" width="80" height="80" />
                  </NuxtLink>
                  <div class="min-w-0 flex-1">
                    <NuxtLink :to="`/products/${item.slug}`" class="line-clamp-1 text-white hover:text-primary-400">{{ item.name }}</NuxtLink>
                    <PriceDisplay :amount-cents="item.priceCents" class="font-mono-spec mt-0.5 block text-sm text-white/40" />
                  </div>
                  <VoltQuantityStepper :model-value="item.quantity" :min="1" :max="item.stockQuantity" @update:model-value="(v) => props.cart.setQuantity(item.productId, v)" />
                  <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="font-mono-spec w-24 text-right text-white" />
                  <button class="flex size-9 items-center justify-center rounded-md border border-white/10 text-white/50 transition-colors hover:border-red-400/50 hover:text-red-400" aria-label="Remove item" @click="props.cart.removeItem(item.productId)">
                    <Icon name="i-lucide-trash-2" class="size-4" />
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div class="lg:col-span-1">
            <div class="sticky top-24 rounded-md border border-white/10 bg-[#0c1113] p-6">
              <h2 class="font-display mb-4 text-xl text-white">Order summary</h2>
              <div class="space-y-3 text-sm">
                <div class="flex items-center justify-between"><span class="text-white/50">Items ({{ props.cart.itemCount }})</span><PriceDisplay :amount-cents="props.cart.totalCents" class="font-mono-spec text-white" /></div>
                <div class="flex items-center justify-between"><span class="text-white/50">Shipping</span><span class="font-mono-spec text-primary-400">Free</span></div>
              </div>
              <div class="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                <span class="text-white">Total</span>
                <PriceDisplay :amount-cents="props.cart.totalCents" class="font-mono-spec text-2xl text-primary-400" />
              </div>
              <p class="mt-2 flex items-center gap-1.5 text-xs text-white/40"><Icon name="i-lucide-banknote" class="size-3.5" /> Cash on delivery available</p>
              <VoltButton to="/checkout" block size="lg" trailing-icon="i-lucide-arrow-right" class="mt-5">Checkout</VoltButton>
              <VoltButton to="/catalog" block color="neutral" variant="ghost" class="mt-2">Continue shopping</VoltButton>
            </div>
          </div>
        </div>

        <template #fallback>
          <div class="flex items-center justify-center py-24 text-white/40">
            <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
          </div>
        </template>
      </ClientOnly>
    </section>
  </div>
</template>
