<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Impulse product card — every card is a mini funnel ad: image, a
// free-delivery signal, the name, the price, and an explicit orange
// "Order now" pill (funnel rule: never make the shopper guess what
// clicking does). The whole card links to the PDP funnel.
const props = defineProps<{ product: Product }>()
</script>

<template>
  <NuxtLink
    :to="`/products/${props.product.slug}`"
    class="funnel-card group block overflow-hidden transition-shadow duration-200 hover:shadow-[var(--shadow-impulse-md)]"
  >
    <div class="relative aspect-square overflow-hidden bg-neutral-100">
      <NuxtImg
        v-if="props.product.imageUrl"
        :src="props.product.imageUrl"
        :alt="props.product.name"
        class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        width="400"
        height="400"
        loading="lazy"
        format="webp"
      />
      <span class="absolute start-2 top-2">
        <ImpulseBadge color="green" variant="solid">
          <Icon name="i-lucide-truck" class="size-3" />
          توصيل مجاني
        </ImpulseBadge>
      </span>
      <span v-if="props.product.stockQuantity <= props.product.lowStockThreshold && props.product.stockQuantity > 0" class="absolute end-2 top-2">
        <ImpulseBadge color="red" variant="solid">تبقى {{ props.product.stockQuantity }}</ImpulseBadge>
      </span>
    </div>

    <div class="space-y-2 p-4">
      <h3 class="line-clamp-2 text-sm font-bold leading-snug text-neutral-900">{{ props.product.name }}</h3>
      <div class="flex items-center justify-between gap-2">
        <PriceDisplay :amount-cents="props.product.priceCents" class="font-display text-lg font-black text-neutral-900" />
        <span class="inline-flex items-center gap-1 rounded-full bg-primary-500 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white transition-colors group-hover:bg-primary-600">
          اطلب الآن
          <Icon name="i-lucide-arrow-left" class="size-3" />
        </span>
      </div>
      <p class="flex items-center gap-1 text-[11px] font-semibold text-neutral-500">
        <Icon name="i-lucide-banknote" class="size-3.5 text-[var(--color-impulse-green)]" />
        الدفع نقداً عند الاستلام
      </p>
    </div>
  </NuxtLink>
</template>
