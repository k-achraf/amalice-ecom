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
  <div :style="{ display: 'flex', flexDirection: 'column', gap: compact ? '6px' : '8px' }">
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      class="line-item"
      @click="detailItem = item"
    >
      <!-- Overlapping thumbnail stack of every shot of this product -->
      <span v-if="galleryFor(item).length" class="line-thumbs">
        <img
          v-for="(url, i) in galleryFor(item).slice(0, 4)"
          :key="i"
          :src="resolveImageUrl(url)"
          :alt="item.product.name"
          :style="{ width: compact ? '28px' : '36px', height: compact ? '28px' : '36px' }"
          loading="lazy"
        >
        <span v-if="galleryFor(item).length > 4" class="more" :style="{ width: compact ? '28px' : '36px', height: compact ? '28px' : '36px' }">+{{ galleryFor(item).length - 4 }}</span>
      </span>
      <span v-else class="thumb" :style="{ width: compact ? '28px' : '36px', height: compact ? '28px' : '36px' }"><AdsIcon name="i-lucide-image-off" style="width: 14px; height: 14px" /></span>

      <span class="line-text">
        <span class="strong">{{ item.product.name }}<span v-if="item.variantLabel" class="muted"> — {{ item.variantLabel }}</span></span>
        <span class="muted">×{{ item.quantity }}<template v-if="item.isUpsell"> · upsell</template></span>
        <span v-if="item.offerLabel" dir="auto" style="color: var(--teal); font-weight: 600">{{ item.offerLabel }}</span>
      </span>
    </button>
  </div>

  <!-- Product detail modal -->
  <AdsDialog v-model:open="detailOpen" :title="detailItem?.product.name ?? 'Product'" :description="detailItem?.variantLabel ?? undefined" width="sm">
    <template v-if="detailItem">
      <div v-if="galleryFor(detailItem).length" class="grid-3" style="gap: 8px">
        <img
          v-for="(url, i) in galleryFor(detailItem)"
          :key="i"
          :src="resolveImageUrl(url)"
          :alt="detailItem.product.name"
          style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: var(--r)"
          loading="lazy"
        >
      </div>
      <div v-else class="empty" style="background: var(--ivory); border-radius: var(--r)"><AdsIcon name="i-lucide-image-off" style="width: 24px; height: 24px" /></div>

      <div class="mini-stats">
        <div><span class="muted">Quantity</span><b>{{ detailItem.quantity }}</b></div>
        <div v-if="detailItem.offerLabel"><span class="muted">Offer</span><b dir="auto">{{ detailItem.offerLabel }}</b></div>
        <div><span class="muted">Unit price</span><b><AdsPrice :amount-cents="detailItem.unitPriceCents" /></b></div>
        <div><span class="muted">Line total</span><b><AdsPrice :amount-cents="detailItem.lineTotalCents" /></b></div>
        <div v-if="detailItem.isUpsell || detailItem.offerId" style="display: flex; align-items: center; gap: 6px">
          <span v-if="detailItem.isUpsell" class="pill shipping">Upsell</span>
          <span v-if="detailItem.offerId" class="pill confirmed">Offer</span>
        </div>
      </div>
    </template>
    <template #footer>
      <button class="btn" type="button" @click="detailOpen = false">Close</button>
    </template>
  </AdsDialog>
</template>

<style scoped>
.line-item { display: flex; align-items: center; gap: 10px; padding: 0; border: 0; background: none; border-radius: var(--r); text-align: start; cursor: pointer; font: inherit; color: inherit; min-width: 0; }
.line-item:hover { background: var(--hover); }
.line-thumbs { display: flex; flex-shrink: 0; }
.line-thumbs img, .line-thumbs .more { border-radius: var(--r-sm); border: 2px solid var(--white); object-fit: cover; margin-inline-start: -8px; }
.line-thumbs > :first-child { margin-inline-start: 0; }
.line-thumbs .more { display: flex; align-items: center; justify-content: center; background: var(--mist); color: var(--teal); font-size: 10px; font-weight: 600; }
.line-text { display: flex; flex-direction: column; min-width: 0; font-size: 13px; line-height: 1.3; }
.line-text .strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
