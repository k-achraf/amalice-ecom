<script setup lang="ts">
import type { RevalidationResult } from '~/stores/cart'
import type { CartItem } from '~/stores/cart'

// Promify cart — 2-col: glassy line-item list left, sticky order summary card
// right. Rounded-2xl cards with hover-glow shadows. Wrapped in ClientOnly with
// a "Loading…" fallback. Promify palette resolves under .tpl-promify.
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
  <div class="bg-neutral-50">
    <!-- Header band -->
    <div class="bg-gradient-to-r from-primary-600 to-primary-900">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <nav class="mb-3 flex items-center gap-2 text-sm text-white/60">
          <NuxtLink to="/" class="transition-colors hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-white/90">Cart</span>
        </nav>
        <h1 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">Your shopping cart</h1>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <ClientOnly>
        <!-- Revalidation notice -->
        <PromifyAlert
          v-if="props.notice"
          color="warning"
          icon="i-lucide-alert-triangle"
          title="Your cart changed"
          class="mb-6"
          :description="
            [
              ...props.notice.removed.map((n) => `${n} is no longer available and was removed.`),
              ...props.notice.changed.map((c) => `${c.name}'s price changed.`)
            ].join(' ')
          "
          closable
          @close="props.onDismissNotice"
        />

        <EmptyState
          v-if="props.cart.items.length === 0"
          icon="i-lucide-shopping-cart"
          title="Your cart is empty"
          description="Browse the catalog to add something."
        >
          <PromifyButton to="/catalog" class="mt-4">Continue shopping</PromifyButton>
        </EmptyState>

        <div v-else class="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <!-- Line items -->
          <div class="lg:col-span-2">
            <div class="rounded-2xl border border-neutral-100 bg-white shadow-sm">
              <ul class="divide-y divide-neutral-100">
                <li
                  v-for="item in props.cart.items"
                  :key="item.productId"
                  class="flex items-center gap-4 p-5 transition-colors hover:bg-neutral-50/50"
                >
                  <NuxtLink :to="`/products/${item.slug}`" class="size-20 shrink-0 overflow-hidden rounded-xl border border-neutral-100 bg-neutral-100">
                    <NuxtImg v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" class="size-full object-cover" width="80" height="80" />
                  </NuxtLink>
                  <div class="min-w-0 flex-1">
                    <NuxtLink :to="`/products/${item.slug}`" class="line-clamp-1 font-medium text-neutral-900 transition-colors hover:text-primary-600">{{ item.name }}</NuxtLink>
                    <PriceDisplay :amount-cents="item.priceCents" class="mt-0.5 block text-sm text-neutral-400" />
                  </div>
                  <PromifyQuantityStepper
                    :model-value="item.quantity"
                    :min="1"
                    :max="item.stockQuantity"
                    @update:model-value="(v: number) => props.cart.setQuantity(item.productId, v)"
                  />
                  <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="w-24 text-right font-semibold text-neutral-900" />
                  <PromifyButton
                    icon="i-lucide-trash-2"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    square
                    class="!rounded-full hover:!bg-red-50 hover:!text-red-500"
                    aria-label="Remove item"
                    @click="props.cart.removeItem(item.productId)"
                  />
                </li>
              </ul>
            </div>
          </div>

          <!-- Sticky order summary -->
          <div class="lg:col-span-1">
            <div class="sticky top-20 rounded-2xl border border-neutral-100 bg-white p-6 shadow-[var(--shadow-promify-md)]">
              <h2 class="mb-4 text-lg font-bold text-neutral-900">Order summary</h2>
              <div class="space-y-3 text-sm">
                <div class="flex items-center justify-between">
                  <span class="text-neutral-500">Items ({{ props.cart.itemCount }})</span>
                  <PriceDisplay :amount-cents="props.cart.totalCents" class="font-medium text-neutral-900" />
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-neutral-500">Shipping</span>
                  <span class="font-medium text-primary-600">Free</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-neutral-500">Taxes</span>
                  <span class="font-medium text-neutral-500">Calculated at delivery</span>
                </div>
              </div>
              <div class="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4">
                <span class="text-base font-semibold text-neutral-900">Total</span>
                <PriceDisplay :amount-cents="props.cart.totalCents" class="text-xl font-bold text-neutral-900" />
              </div>
              <p class="mt-2 flex items-center gap-1.5 text-xs text-neutral-400">
                <Icon name="i-lucide-banknote" class="size-3.5" /> Cash on delivery available
              </p>
              <PromifyButton
                to="/checkout"
                block
                size="xl"
                trailing-icon="i-lucide-arrow-right"
                class="mt-5"
              >
                Proceed to checkout
              </PromifyButton>
              <PromifyButton to="/catalog" block variant="ghost" color="neutral" class="mt-2">Continue shopping</PromifyButton>
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
