<script setup lang="ts">
import type { RevalidationResult } from '~/stores/cart'
import type { CartItem } from '~/stores/cart'

// Drop cart — flat bordered line-item list left, sticky bordered order
// summary right. No @nuxt/ui, no shadow.
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
    <div class="border-b border-white/10 bg-[#171717]">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-white/40">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-white">Cart</span>
        </nav>
        <h1 class="font-display text-3xl text-white sm:text-4xl">Your shopping cart</h1>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <ClientOnly>
        <DropAlert v-if="props.notice" color="warning" icon="i-lucide-alert-triangle" title="Your cart changed" class="mb-6" closable @close="props.onDismissNotice">
          <p class="mt-0.5 text-xs text-white/60">
            {{ [
              ...props.notice.removed.map((n) => `${n} is no longer available and was removed.`),
              ...props.notice.changed.map((c) => `${c.name}'s price changed.`)
            ].join(' ') }}
          </p>
        </DropAlert>

        <EmptyState v-if="props.cart.items.length === 0" icon="i-lucide-shopping-cart" title="Your cart is empty" description="Browse the catalog to add something.">
          <DropButton to="/catalog" class="mt-4">Continue shopping</DropButton>
        </EmptyState>

        <div v-else class="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div class="lg:col-span-2">
            <div class="border border-white/10 bg-[#171717]">
              <ul class="divide-y divide-white/10">
                <li v-for="item in props.cart.items" :key="item.productId" class="flex flex-wrap items-center gap-4 p-5">
                  <NuxtLink :to="`/products/${item.slug}`" class="size-20 shrink-0 overflow-hidden border border-white/10 bg-neutral-900">
                    <NuxtImg v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" class="size-full object-cover" width="80" height="80" />
                  </NuxtLink>
                  <div class="min-w-0 flex-1">
                    <NuxtLink :to="`/products/${item.slug}`" class="line-clamp-1 font-bold text-white hover:text-primary-500">{{ item.name }}</NuxtLink>
                    <PriceDisplay :amount-cents="item.priceCents" class="mt-0.5 block text-sm text-white/40" />
                  </div>
                  <DropQuantityStepper :model-value="item.quantity" :min="1" :max="item.stockQuantity" @update:model-value="(v) => props.cart.setQuantity(item.productId, v)" />
                  <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="w-24 text-right font-bold text-white" />
                  <button class="flex size-9 items-center justify-center border border-white/10 text-white/60 transition-colors hover:border-primary-500 hover:text-primary-500" aria-label="Remove item" @click="props.cart.removeItem(item.productId)">
                    <Icon name="i-lucide-trash-2" class="size-4" />
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div class="lg:col-span-1">
            <div class="sticky top-24 border border-white/10 bg-[#171717] p-6">
              <h2 class="font-display mb-4 text-xl text-white">Order summary</h2>
              <div class="space-y-3 text-sm">
                <div class="flex items-center justify-between"><span class="text-white/50">Items ({{ props.cart.itemCount }})</span><PriceDisplay :amount-cents="props.cart.totalCents" class="font-bold text-white" /></div>
                <div class="flex items-center justify-between"><span class="text-white/50">Shipping</span><span class="font-bold text-primary-500">Free</span></div>
              </div>
              <div class="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                <span class="font-bold uppercase text-white">Total</span>
                <PriceDisplay :amount-cents="props.cart.totalCents" class="text-2xl font-bold text-white" />
              </div>
              <p class="mt-2 flex items-center gap-1.5 text-xs text-white/40"><Icon name="i-lucide-banknote" class="size-3.5" /> Cash on delivery available</p>
              <DropButton to="/checkout" block size="lg" trailing-icon="i-lucide-arrow-right" class="mt-5">Checkout</DropButton>
              <DropButton to="/catalog" block variant="ghost" class="mt-2">Continue shopping</DropButton>
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
