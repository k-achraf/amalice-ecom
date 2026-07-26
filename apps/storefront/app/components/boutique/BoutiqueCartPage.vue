<script setup lang="ts">
import type { RevalidationResult } from '~/stores/cart'
import type { CartItem } from '~/stores/cart'

// Boutique cart — airy, card-per-line-item. Each item sits in its own bordered
// block with generous padding rather than a dense divided list. Restraint:
// a quiet eyebrow header, a single prominent total, a square CTA. Wrapped in
// ClientOnly (cart is client state) with a "Loading…" fallback.
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
  <main class="bg-default">
    <!-- Eyebrow header -->
    <header class="mx-auto max-w-3xl px-6 pt-24 text-center sm:pt-32">
      <p class="text-xs uppercase tracking-[0.4em] text-muted">Your selection</p>
      <h1 class="mt-6 text-3xl font-light tracking-tight text-highlighted sm:text-4xl">Shopping Bag</h1>
      <div class="mx-auto mt-8 h-px w-12 bg-default" />
    </header>

    <ClientOnly>
      <section class="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <!-- Revalidation notice -->
        <BoutiqueAlert
          v-if="props.notice"
          color="warning"
          icon="i-lucide-alert-triangle"
          title="Your bag changed"
          :description="
            [
              ...props.notice.removed.map((n) => `${n} is no longer available and was removed.`),
              ...props.notice.changed.map((c) => `${c.name}'s price changed.`)
            ].join(' ')
          "
          closable
          @close="props.onDismissNotice"
        />

        <!-- Empty -->
        <EmptyState
          v-if="props.cart.items.length === 0"
          icon="i-lucide-shopping-bag"
          title="Your bag is empty"
          description="Browse the collection to begin."
        >
          <BoutiqueButton to="/catalog" variant="outline" color="neutral" class="mt-6">
            Explore the collection
          </BoutiqueButton>
        </EmptyState>

        <!-- Items: each in its own bordered card -->
        <template v-else>
          <ul class="space-y-6">
            <li
              v-for="item in props.cart.items"
              :key="item.productId"
              class="border border-default p-6 sm:p-8"
            >
              <div class="flex items-center gap-6">
                <NuxtLink :to="`/products/${item.slug}`" class="size-24 shrink-0 overflow-hidden bg-elevated sm:size-28">
                  <NuxtImg v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" class="size-full object-cover" width="112" height="112" loading="lazy" />
                </NuxtLink>

                <div class="min-w-0 flex-1">
                  <NuxtLink :to="`/products/${item.slug}`" class="block truncate font-light tracking-wide text-highlighted hover:underline">
                    {{ item.name }}
                  </NuxtLink>
                  <PriceDisplay :amount-cents="item.priceCents" class="mt-1 block text-xs uppercase tracking-widest text-muted" />
                </div>

                <div class="flex flex-col items-end gap-3">
                  <BoutiqueQuantityStepper
                    :model-value="item.quantity"
                    :min="1"
                    :max="item.stockQuantity"
                    @update:model-value="(v: number) => props.cart.setQuantity(item.productId, v)"
                  />
                  <button
                    class="text-xs uppercase tracking-[0.2em] text-muted transition-colors hover:text-error"
                    aria-label="Remove item"
                    @click="props.cart.removeItem(item.productId)"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          </ul>

          <!-- Total + checkout -->
          <div class="mt-12 space-y-8 border-t border-default pt-10">
            <div class="flex items-baseline justify-between">
              <span class="text-xs uppercase tracking-[0.4em] text-muted">Total</span>
              <PriceDisplay :amount-cents="props.cart.totalCents" class="price-accent text-2xl font-light tracking-tight" />
            </div>
            <BoutiqueButton
              to="/checkout"
              block
              size="lg"
              color="neutral"
              variant="outline"
              class="!border-2"
            >
              Proceed to checkout
            </BoutiqueButton>
          </div>
        </template>
      </section>

      <template #fallback>
        <div class="py-32 text-center text-xs uppercase tracking-[0.3em] text-muted">Loading…</div>
      </template>
    </ClientOnly>
  </main>
</template>
