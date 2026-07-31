<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Impulse wishlist — reframed as "your saved offers": the funnel treats a
// wishlist as intent waiting for a nudge, so the countdown sits on top and
// every card is one click from ordering.
const props = defineProps<{
  savedProducts: Product[]
  onRemove: (id: string) => void
}>()
</script>

<template>
  <div class="bg-neutral-50">
    <div class="border-b border-neutral-200 bg-white py-3">
      <ImpulseCountdown label="تنتهي عروضك المحفوظة خلال" />
    </div>

    <section class="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 class="mb-8 text-center font-display text-3xl font-black uppercase text-neutral-900">
        عروض محفوظة — <span class="marker">لا تزال بانتظارك</span>
      </h1>

      <div v-if="props.savedProducts.length" class="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div v-for="product in props.savedProducts" :key="product.id" class="relative">
          <TemplateSection name="ProductCard" :section-props="{ product }" />
          <button
            class="absolute end-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 text-neutral-500 shadow-[var(--shadow-impulse-sm)] transition-colors hover:text-[var(--color-impulse-red)]"
            aria-label="إزالة من المحفوظات"
            @click.prevent="props.onRemove(product.id)"
          >
            <Icon name="i-lucide-x" class="size-4" />
          </button>
        </div>
      </div>

      <div v-else class="py-24 text-center">
        <Icon name="i-lucide-heart" class="mx-auto mb-3 size-10 text-neutral-300" />
        <p class="mb-1 font-bold text-neutral-900">لا شيء محفوظ بعد.</p>
        <p class="mb-5 text-sm text-neutral-500">تصفح العروض — كل شيء بالدفع عند الاستلام.</p>
        <ImpulseButton to="/catalog" size="lg" pulse trailing-icon="i-lucide-arrow-left">شاهد العروض</ImpulseButton>
      </div>
    </section>
  </div>
</template>
