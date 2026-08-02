<script setup lang="ts">
// Impulse chrome — the funnel header. Deliberately UNLIKE every other
// template's header: NO nav links, NO search, NO category menu. In a
// direct-response funnel every link that isn't the CTA is a leak, so the
// chrome is reduced to a green trust band, the wordmark (the only way
// "out", back to the funnel top), and the cart (only when cart mode is on).
const cart = useCartStore()
const settings = useStoreSettings()
</script>

<template>
  <header class="sticky top-0 z-50 bg-white shadow-[var(--shadow-impulse-sm)]">
    <!-- Trust band — the first pixels on every page state the risk-reversal. -->
    <div class="bg-[var(--color-impulse-green)] py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-white">
      <Icon name="i-lucide-shield-check" class="me-1 inline size-3.5 align-[-2px]" />
      {{ settings.announcementText || 'الدفع عند الاستلام — اطلب الآن وادفع فقط عند وصول طلبك' }}
    </div>

    <div class="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
      <NuxtLink to="/" class="font-display text-2xl font-black uppercase tracking-tight text-neutral-900">
        {{ settings.storeName }}<span class="text-primary-500">.</span>
      </NuxtLink>

      <div class="flex items-center gap-3">
        <span class="hidden items-center gap-1.5 text-xs font-semibold text-neutral-500 sm:flex">
          <Icon name="i-lucide-phone-call" class="size-4 text-[var(--color-impulse-green)]" />
          نتصل لتأكيد كل طلب
        </span>
        <ImpulseButton v-if="settings.displayCart" to="/cart" variant="outline" color="neutral" size="md" square class="relative" aria-label="السلة">
          <Icon name="i-lucide-shopping-cart" class="size-4" />
          <ClientOnly>
            <span
              v-if="cart.itemCount > 0"
              class="absolute -end-1 -top-1 flex size-4.5 items-center justify-center rounded-full bg-primary-500 text-[9px] font-bold text-white"
            >{{ cart.itemCount }}</span>
          </ClientOnly>
        </ImpulseButton>
      </div>
    </div>
  </header>
</template>
