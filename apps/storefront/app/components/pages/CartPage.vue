<script setup lang="ts">
import type { RevalidationResult } from '~/stores/cart'
import type { CartItem } from '~/stores/cart'

// Minimal (fallback) cart presentation — line-item list + totals. Receives
// the cart store + revalidation notice from the page shell; mutations
// (setQuantity, removeItem) go through the passed cart ref.
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
  <main class="mx-auto max-w-3xl space-y-6 p-6">
    <h1 class="text-2xl font-semibold">Your cart</h1>

    <Alert
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
      @close="props.onDismissNotice"
    />

    <ClientOnly>
      <EmptyState
        v-if="props.cart.items.length === 0"
        icon="i-lucide-shopping-cart"
        title="Your cart is empty"
        description="Browse the catalog to add something."
      >
        <Button to="/" variant="outline" color="neutral">Continue shopping</Button>
      </EmptyState>

      <template v-else>
        <ul class="divide-y divide-default">
          <li v-for="item in props.cart.items" :key="item.productId" class="flex items-center gap-4 py-4">
            <div class="size-16 shrink-0 overflow-hidden rounded-md bg-elevated">
              <NuxtImg v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" class="size-full object-cover" width="64" height="64" />
            </div>
            <div class="min-w-0 flex-1">
              <NuxtLink :to="`/products/${item.slug}`" class="truncate font-medium text-highlighted">{{ item.name }}</NuxtLink>
              <PriceDisplay :amount-cents="item.priceCents" class="block text-sm text-neutral-500" />
            </div>
            <QuantityStepper
              :model-value="item.quantity"
              :min="1"
              :max="item.stockQuantity"
              @update:model-value="(v: number) => props.cart.setQuantity(item.productId, v)"
            />
            <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="w-20 text-right font-medium" />
            <Button icon="i-lucide-trash-2" color="neutral" variant="ghost" square aria-label="Remove item" @click="props.cart.removeItem(item.productId)" />
          </li>
        </ul>

        <div class="flex items-center justify-between border-t border-default pt-4">
          <span class="font-medium">Total</span>
          <PriceDisplay :amount-cents="props.cart.totalCents" class="text-lg font-semibold" />
        </div>

        <Button to="/checkout" block size="lg">Proceed to checkout</Button>
      </template>

      <template #fallback>
        <div class="py-24 text-center text-neutral-500">Loading…</div>
      </template>
    </ClientOnly>
  </main>
</template>
