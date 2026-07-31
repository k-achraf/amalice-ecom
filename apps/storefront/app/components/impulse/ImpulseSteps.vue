<script setup lang="ts">
// Impulse's "how it works" strip — 4 numbered steps that defuse the
// COD-newcomer's main objection ("what happens after I click?"). Placed
// directly after the order form on funnel pages.
const steps = [
  { icon: 'i-lucide-mouse-pointer-click', title: 'تطلب', text: 'الاسم والهاتف فقط. 30 ثانية، بدون حساب.' },
  { icon: 'i-lucide-phone-call', title: 'نتصل بك', text: 'مكالمة سريعة للتأكيد — لا شيء يُشحن بدون تأكيد.' },
  { icon: 'i-lucide-truck', title: 'نوصّل', text: 'إلى باب منزلك، في جميع الولايات الـ58.' },
  { icon: 'i-lucide-banknote', title: 'تدفع نقداً', text: 'فقط عندما يصل الطرد إلى يديك.' }
]
</script>

<template>
  <div class="funnel-card p-6">
    <h3 class="mb-5 text-center font-display text-xl font-black uppercase text-neutral-900">كيف تعمل الخدمة</h3>
    <ol class="grid gap-4 sm:grid-cols-4">
      <li v-for="(step, i) in steps" :key="step.title" class="relative flex flex-col items-center gap-2 text-center">
        <span class="flex size-12 items-center justify-center rounded-full border-2 border-primary-200 bg-primary-50">
          <Icon :name="step.icon" class="size-5 text-primary-600" />
        </span>
        <span class="absolute -top-1 start-1/2 ms-4 flex size-5 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-black text-white">{{ i + 1 }}</span>
        <span class="text-sm font-bold text-neutral-900">{{ step.title }}</span>
        <span class="text-xs leading-snug text-neutral-500">{{ step.text }}</span>
      </li>
    </ol>
  </div>
</template>
