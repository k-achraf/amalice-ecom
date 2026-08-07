<script setup lang="ts">
import type { AdminOrderLineItem } from '@amalice/shared'

// Inline product display for the Call Center / Orders / Shipping queues —
// every line item's full image gallery shown directly in the row/card, not
// hidden behind a click-through to the order detail page. Shared here so
// the three pages (and any future queue) can't drift on how this looks.
// `compact` tightens spacing for dense table rows (Orders/Shipping); the
// card-list pages (Call Center) use the default, slightly roomier spacing.
withDefaults(defineProps<{
  items: AdminOrderLineItem[]
  compact?: boolean
}>(), {
  compact: false
})

const { resolveImageUrl } = useResolveImageUrl()

// Product images fall back to the denormalized hero when the gallery is
// empty (older products seeded before ProductImage existed) — see
// AdminOrderLineItem.product's comment in packages/shared.
function galleryFor(item: AdminOrderLineItem): string[] {
  if (item.product.images.length) return item.product.images
  return item.product.imageUrl ? [item.product.imageUrl] : []
}

// Clicking a line item opens its full detail (every gallery image, variant,
// pricing) in a modal instead of forcing a click-through to the order or
// product page — requested specifically for the Drop Queue's fast-paced
// confirmation flow, but it's on the shared component so Orders/Shipping/
// the regular Call Center queue get the same behavior for free.
const detailItem = ref<AdminOrderLineItem | null>(null)
const detailOpen = computed({
  get: () => detailItem.value !== null,
  set: (v) => { if (!v) detailItem.value = null }
})
</script>

<template>
  <div :class="['flex flex-col', compact ? 'gap-1.5' : 'gap-2']">
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      class="flex items-center gap-2 rounded-md text-start transition-colors hover:bg-[var(--color-admin-row-hover)]"
      @click="detailItem = item"
    >
      <!-- Overlapping thumbnail stack of every shot of this product -->
      <div v-if="galleryFor(item).length" class="flex shrink-0 -space-x-2 rtl:space-x-reverse">
        <img
          v-for="(url, i) in galleryFor(item).slice(0, 4)"
          :key="i"
          :src="resolveImageUrl(url)"
          :alt="item.product.name"
          :class="['rounded-md border-2 border-[var(--color-admin-surface)] object-cover', compact ? 'size-7' : 'size-9']"
          loading="lazy"
        >
        <div
          v-if="galleryFor(item).length > 4"
          :class="['flex shrink-0 items-center justify-center rounded-md border-2 border-[var(--color-admin-surface)] bg-elevated text-[10px] font-medium text-muted', compact ? 'size-7' : 'size-9']"
        >
          +{{ galleryFor(item).length - 4 }}
        </div>
      </div>
      <div
        v-else
        :class="['flex shrink-0 items-center justify-center rounded-md bg-elevated text-muted', compact ? 'size-7' : 'size-9']"
      >
        <UIcon name="i-lucide-image-off" class="size-3.5" />
      </div>

      <div class="min-w-0 leading-tight">
        <p class="truncate text-sm text-highlighted">
          {{ item.product.name }}
          <span v-if="item.variantLabel" class="text-muted">— {{ item.variantLabel }}</span>
        </p>
        <p class="text-xs text-muted">×{{ item.quantity }}<span v-if="item.isUpsell"> · upsell</span></p>
      </div>
    </button>
  </div>

  <!-- Product detail modal -->
  <UModal v-model:open="detailOpen">
    <template #content>
      <div v-if="detailItem" class="space-y-4 p-6">
        <div>
          <h3 class="text-lg font-semibold text-highlighted">{{ detailItem.product.name }}</h3>
          <p v-if="detailItem.variantLabel" class="text-sm text-muted">{{ detailItem.variantLabel }}</p>
        </div>

        <div v-if="galleryFor(detailItem).length" class="grid grid-cols-3 gap-2">
          <img
            v-for="(url, i) in galleryFor(detailItem)"
            :key="i"
            :src="resolveImageUrl(url)"
            :alt="detailItem.product.name"
            class="aspect-square w-full rounded-md object-cover"
            loading="lazy"
          >
        </div>
        <div v-else class="flex aspect-video items-center justify-center rounded-md bg-elevated text-muted">
          <UIcon name="i-lucide-image-off" class="size-6" />
        </div>

        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p class="text-muted">Quantity</p>
            <p class="tabular font-medium text-highlighted">{{ detailItem.quantity }}</p>
          </div>
          <div>
            <p class="text-muted">Unit price</p>
            <PriceDisplay :amount-cents="detailItem.unitPriceCents" class="tabular font-medium text-highlighted" />
          </div>
          <div>
            <p class="text-muted">Line total</p>
            <PriceDisplay :amount-cents="detailItem.lineTotalCents" class="tabular font-medium text-highlighted" />
          </div>
          <div class="flex items-center gap-1.5">
            <UBadge v-if="detailItem.isUpsell" size="sm" color="primary" variant="subtle">Upsell</UBadge>
            <UBadge v-if="detailItem.offerId" size="sm" color="success" variant="subtle">Offer</UBadge>
          </div>
        </div>

        <div class="flex justify-end">
          <UButton color="neutral" variant="ghost" label="Close" @click="detailOpen = false" />
        </div>
      </div>
    </template>
  </UModal>
</template>
