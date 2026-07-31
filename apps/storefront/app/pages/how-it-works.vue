<script setup lang="ts">
useSeoMeta({
  title: 'كيف يعمل المتجر',
  description: 'كيف يعمل التسوق بنظام الدفع عند الاستلام في أماليس — اطلب، نتصل للتأكيد، استلم، ثم ادفع نقداً.'
})

const steps = [
  { icon: 'i-lucide-shopping-bag', title: 'تصفّح وأضف إلى السلة', body: 'اختر ما تريد وأضفه إلى سلتك. لا حاجة لإنشاء حساب.' },
  { icon: 'i-lucide-map-pin', title: 'أدخل عنوانك', body: 'أخبرنا أين نوصّل طلبك، ونحن نوصّل إلى باب منزلك.' },
  { icon: 'i-lucide-phone-call', title: 'نتصل للتأكيد', body: 'مكالمة سريعة من فريقنا لتأكيد طلبك — بدون كلمة مرور ولا رمز.' },
  { icon: 'i-lucide-truck', title: 'نوصّل طلبك', body: 'يصلك طلبك خلال 3 إلى 5 أيام عمل (تقدير مبدئي — مواعيد دقيقة لكل طلب قريباً).' },
  { icon: 'i-lucide-banknote', title: 'ادفع نقداً', body: 'افحص طلبك، ثم ادفع للمندوب نقداً. وانتهى الأمر.' }
]
</script>

<template>
  <main class="mx-auto max-w-3xl space-y-10 px-4 py-12">
    <div class="text-center">
      <h1 class="text-3xl font-bold">كيف يعمل المتجر</h1>
      <p class="mt-2 text-muted">خمس خطوات فقط. لا حساب، لا دفع مسبق.</p>
    </div>
    <ol class="space-y-6">
      <li v-for="(step, i) in steps" :key="i" class="flex gap-4">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
          <UIcon :name="step.icon" class="size-5" />
        </div>
        <div>
          <h2 class="font-semibold text-highlighted">{{ i + 1 }}. {{ step.title }}</h2>
          <p class="text-sm text-muted">{{ step.body }}</p>
        </div>
      </li>
    </ol>
    <div class="text-center">
      <UButton to="/catalog" size="lg" color="primary" icon="i-lucide-shopping-bag">ابدأ التسوق</UButton>
    </div>
  </main>
</template>
