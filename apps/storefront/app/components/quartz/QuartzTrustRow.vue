<script setup lang="ts">
// Quartz's trust-badge row — generic COD reassurance signals that apply to
// any product category (no wording tied to one type of item), repeated
// near the order form and in the footer.
const badges = [
  { icon: 'i-lucide-banknote', title: 'الدفع عند الاستلام', text: 'تدفع فقط عند استلام طلبك' },
  { icon: 'i-lucide-phone-call', title: 'مكالمة تأكيد', text: 'نتصل بك قبل شحن أي شيء' },
  { icon: 'i-lucide-truck', title: 'توصيل لكل الولايات', text: 'تغطية 58 ولاية' },
  { icon: 'i-lucide-rotate-ccw', title: 'إرجاع سهل', text: 'رفضت الطلب؟ بدون أي رسوم' }
]
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div v-for="badge in badges" :key="badge.title" class="flex flex-col items-center gap-1.5 rounded-2xl bg-neutral-100/70 px-3 py-4 text-center">
      <span class="flex size-9 items-center justify-center rounded-full bg-primary-50">
        <Icon :name="badge.icon" class="size-4.5 text-primary-700" />
      </span>
      <span class="text-[11px] font-bold uppercase tracking-wide text-neutral-900">{{ badge.title }}</span>
      <span class="text-[11px] leading-snug text-neutral-600">{{ badge.text }}</span>
    </div>
  </div>
</template>
