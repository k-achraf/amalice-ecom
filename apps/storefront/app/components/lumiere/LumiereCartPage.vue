<script setup lang="ts">
import type { RevalidationResult } from '~/stores/cart'
import type { CartItem } from '~/stores/cart'

// Lumiere cart — bordered line-item list left, sticky order summary card
// right. Sharp radius, no shadow, zero-radius product thumbnails.
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
    <div class="border-b border-black bg-black text-white">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-white/80">Cart</span>
        </nav>
        <h1 class="font-display text-4xl text-white sm:text-5xl">Your shopping cart</h1>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <ClientOnly>
        <div v-if="props.notice" class="mb-6 flex items-start gap-3 rounded border border-primary-600/40 bg-primary-50 p-4">
          <Icon name="i-lucide-alert-triangle" class="mt-0.5 size-5 shrink-0 text-primary-700" />
          <div>
            <p class="font-bold uppercase tracking-wide text-black">Your cart changed</p>
            <p class="text-sm text-black/70">
              {{ [
                ...props.notice.removed.map((n) => `${n} is no longer available and was removed.`),
                ...props.notice.changed.map((c) => `${c.name}'s price changed.`)
              ].join(' ') }}
            </p>
          </div>
          <button class="ml-auto" aria-label="Dismiss" @click="props.onDismissNotice"><Icon name="i-lucide-x" class="size-4" /></button>
        </div>

        <EmptyState v-if="props.cart.items.length === 0" icon="i-lucide-shopping-cart" title="Your cart is empty" description="Browse the catalog to add something.">
          <LumiereButton to="/catalog" class="mt-4">Continue shopping</LumiereButton>
        </EmptyState>

        <div v-else class="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div class="lg:col-span-2">
            <div class="rounded border border-black/10 bg-white">
              <ul class="divide-y divide-black/10">
                <li v-for="item in props.cart.items" :key="item.productId" class="flex flex-wrap items-center gap-4 p-5">
                  <NuxtLink :to="`/products/${item.slug}`" class="size-20 shrink-0 overflow-hidden bg-neutral-100">
                    <NuxtImg v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" class="size-full object-cover" width="80" height="80" />
                  </NuxtLink>
                  <div class="min-w-0 flex-1">
                    <NuxtLink :to="`/products/${item.slug}`" class="line-clamp-1 font-medium text-black hover:text-primary-600">{{ item.name }}</NuxtLink>
                    <PriceDisplay :amount-cents="item.priceCents" class="mt-0.5 block text-sm text-black/45" />
                  </div>
                  <LumiereQuantityStepper :model-value="item.quantity" :min="1" :max="item.stockQuantity" @update:model-value="(v) => props.cart.setQuantity(item.productId, v)" />
                  <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="w-24 text-right font-bold text-black" />
                  <button class="flex size-9 items-center justify-center rounded border border-black/10 text-black transition-colors hover:border-primary-600 hover:text-primary-600" aria-label="Remove item" @click="props.cart.removeItem(item.productId)">
                    <Icon name="i-lucide-trash-2" class="size-4" />
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div class="lg:col-span-1">
            <div class="sticky top-24 rounded border border-black bg-white p-6">
              <h2 class="font-display mb-4 text-xl text-black">Order summary</h2>
              <div class="space-y-3 text-sm">
                <div class="flex items-center justify-between"><span class="text-black/55">Items ({{ props.cart.itemCount }})</span><PriceDisplay :amount-cents="props.cart.totalCents" class="font-bold" /></div>
                <div class="flex items-center justify-between"><span class="text-black/55">Shipping</span><span class="font-bold text-primary-700">Free</span></div>
              </div>
              <div class="mt-4 flex items-center justify-between border-t border-black/10 pt-4">
                <span class="font-bold uppercase tracking-wide">Total</span>
                <PriceDisplay :amount-cents="props.cart.totalCents" class="text-2xl font-bold" />
              </div>
              <p class="mt-2 flex items-center gap-1.5 text-xs text-black/45"><Icon name="i-lucide-banknote" class="size-3.5" /> Cash on delivery available</p>
              <LumiereButton to="/checkout" block size="lg" trailing-icon="i-lucide-arrow-right" class="mt-5">Checkout</LumiereButton>
              <LumiereButton to="/catalog" block color="neutral" variant="ghost" class="mt-2">Continue shopping</LumiereButton>
            </div>
          </div>
        </div>

        <template #fallback>
          <div class="flex items-center justify-center py-24 text-black/40">
            <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
          </div>
        </template>
      </ClientOnly>
    </section>
  </div>
</template>
