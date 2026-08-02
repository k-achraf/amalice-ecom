<script setup lang="ts">
// Impulse's trust-badge row — the 4 risk-reversal signals, repeated near
// every CTA (funnel rule: reassurance lives next to the ask, not in a
// distant footer only).
const badges = [
  { icon: 'i-lucide-banknote', title: 'الدفع عند الاستلام', text: 'تدفع فقط عند استلام طلبك' },
  { icon: 'i-lucide-phone-call', title: 'مكالمة تأكيد', text: 'نتصل بك قبل شحن أي شيء' },
  { icon: 'i-lucide-truck', title: 'توصيل سريع', text: '58 ولاية، خلال 1 إلى 5 أيام' },
  { icon: 'i-lucide-rotate-ccw', title: 'إرجاع سهل', text: 'رفضت الطلب؟ لا مشكلة، بدون رسوم' }
]
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div v-for="badge in badges" :key="badge.title" class="flex flex-col items-center gap-1.5 rounded-2xl bg-neutral-50 px-3 py-4 text-center">
      <span class="flex size-10 items-center justify-center rounded-full bg-[var(--color-impulse-green-soft)]">
        <Icon :name="badge.icon" class="size-5 text-[var(--color-impulse-green)]" />
      </span>
      <span class="text-xs font-bold uppercase tracking-wide text-neutral-900">{{ badge.title }}</span>
      <span class="text-[11px] leading-snug text-neutral-600">{{ badge.text }}</span>
    </div>
  </div>
</template>
