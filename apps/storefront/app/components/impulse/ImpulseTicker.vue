<script setup lang="ts">
import type { RecentOrderActivityResponse } from '@amalice/shared'

// Impulse's social-proof ticker — an infinite marquee of REAL recent orders
// (never fabricated static copy — see apps/api's OrdersService.getRecentActivity
// and the RecentOrderActivitySchema comment in packages/shared/src/order.ts).
// The customer name is already reduced to a single letter server-side before
// this ever reaches the browser — the real name never leaves the API.
// Duplicated once so the -50% translate loop is seamless (see
// impulse.css .ticker-track). A couple of non-order filler lines (payment
// method, "we call to confirm") are still static since they're store-wide
// facts, not claims about specific orders.
const { data } = await useApiFetch<RecentOrderActivityResponse>('/orders/recent-activity', { key: 'impulse-recent-activity' })

const STATIC_FILLERS = ['ادفع نقداً — فقط عند الوصول', 'نتصل لتأكيد كل طلب']

const items = computed<string[]>(() => {
  const orderLines = (data.value?.items ?? []).map((item) => {
    const quantitySuffix = item.quantity > 1 ? ` ×${item.quantity}` : ''
    const location = item.wilayaName ? ` — ${item.wilayaName}` : ''
    return `★★★★★ ${item.customerInitial}****** طلب ${item.productName}${quantitySuffix}${location}`
  })
  // Interleave the two static fillers among real orders rather than
  // clumping them at the end, so the marquee doesn't visibly "run out" of
  // real content partway through — same visual rhythm as the old static list.
  const merged: string[] = []
  orderLines.forEach((line, i) => {
    merged.push(line)
    if (i % 2 === 1) {
      const filler = STATIC_FILLERS[Math.floor(i / 2) % STATIC_FILLERS.length]
      if (filler) merged.push(filler)
    }
  })
  return merged.length ? merged : STATIC_FILLERS
})
</script>

<template>
  <div v-if="items.length" class="overflow-hidden border-y-2 border-neutral-900 bg-[var(--color-impulse-yellow)] py-2">
    <div class="ticker-track">
      <template v-for="n in 2" :key="n">
        <span
          v-for="(item, i) in items"
          :key="`${n}-${i}`"
          class="mx-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-900"
        >
          {{ item }}
          <Icon name="i-lucide-zap" class="size-3.5" />
        </span>
      </template>
    </div>
  </div>
</template>
