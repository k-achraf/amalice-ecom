<script setup lang="ts">
// Impulse's social-proof ticker — an infinite marquee of recent-order-style
// messages. The list is STATIC content (fixed names/wilayas, no fake
// randomness churn), duplicated once so the -50% translate loop is
// seamless (see impulse.css .ticker-track).
const items = [
  '★★★★★ كريم من الجزائر طلب للتو',
  '★★★★★ أمينة من وهران طلبت قطعتين',
  'ادفع نقداً — فقط عند الوصول',
  '★★★★★ ياسين من سطيف طلب للتو',
  'نتصل لتأكيد كل طلب',
  '★★★★★ لينا من قسنطينة طلبت مجدداً',
  'إرجاع سهل خلال 30 يوماً'
]
</script>

<template>
  <div class="overflow-hidden border-y-2 border-neutral-900 bg-[var(--color-impulse-yellow)] py-2">
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
