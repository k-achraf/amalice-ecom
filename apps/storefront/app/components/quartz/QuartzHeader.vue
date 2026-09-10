<script setup lang="ts">
// Quartz chrome — a quiet, generic order-page header (no category nav —
// this template is scoped to product/landing pages only, see
// STORE_TEMPLATES' quartz entry). Store name in the display serif with a
// thin gold rule underneath; cart icon only when the store has cart mode on.
const cart = useCartStore()
const settings = useStoreSettings()
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-neutral-200 bg-[rgba(250,246,239,0.95)] backdrop-blur-sm">
    <div class="truncate bg-primary-800 px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.1em] text-primary-50">
      <Icon name="i-lucide-shield-check" class="me-1 inline size-3.5 align-[-2px]" />
      {{ settings.announcementText || 'الدفع عند الاستلام — لا تدفع شيئاً حتى يصلك طلبك' }}
    </div>

    <div class="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
      <NuxtLink to="/" class="font-display text-xl font-medium text-neutral-900">
        {{ settings.storeName }}
      </NuxtLink>

      <div class="flex items-center gap-3">
        <span class="hidden items-center gap-1.5 text-xs font-medium text-neutral-500 sm:flex">
          <Icon name="i-lucide-phone-call" class="size-4 text-primary-600" />
          نتصل لتأكيد كل طلب
        </span>
        <QuartzButton v-if="settings.displayCart" to="/cart" variant="outline" color="neutral" size="md" square class="relative" aria-label="السلة">
          <Icon name="i-lucide-shopping-bag" class="size-4" />
          <ClientOnly>
            <span
              v-if="cart.itemCount > 0"
              class="absolute -end-1 -top-1 flex size-4.5 items-center justify-center rounded-full bg-primary-600 text-[9px] font-bold text-white"
            >{{ cart.itemCount }}</span>
          </ClientOnly>
        </QuartzButton>
      </div>
    </div>
  </header>
</template>
