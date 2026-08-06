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
</script>

<template>
  <div :class="['flex flex-col', compact ? 'gap-1.5' : 'gap-2']">
    <div v-for="item in items" :key="item.id" class="flex items-center gap-2">
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
    </div>
  </div>
</template>
