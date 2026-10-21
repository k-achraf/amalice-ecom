<script setup lang="ts">
const settings = useStoreSettings()
useSeoMeta({
  title: 'من نحن',
  description: () => `${settings.value.storeName} متجر إلكتروني يعتمد الدفع عند الاستلام — ادفع عند وصول طلبك، دون الحاجة لحساب أو دفع مسبق.`
})
</script>

<template>
  <main class="mx-auto max-w-3xl space-y-8 px-4 py-12">
    <h1 class="text-3xl font-bold">من نحن في {{ settings.storeName }}</h1>
    <div class="space-y-4 leading-relaxed text-muted">
      <p>
        بُنيت {{ settings.storeName }} على فكرة بسيطة: التسوق عبر الإنترنت لا يجب أن يتطلب بطاقة ائتمان، أو حساباً، أو
        الثقة بصفحة دفع لم ترها من قبل. أنت تطلب، ونحن نوصّل، وتدفع نقداً عند وصول طلبك.
      </p>
      <p>
        نؤكد كل طلب باتصال سريع من فريقنا — وهذا يمنع الطلبات الوهمية ويضمن وصول شحنتك إلى الشخص الصحيح.
        لا كلمة مرور لتتذكرها، ولا حساب لتديره.
      </p>
      <p>
        أطلقنا {{ settings.storeName }} لنجعل المنتجات اليومية في متناول الجميع، بشروط تضع الزبون في موقع التحكم:
        شاهد المنتج، المسه، ثم ادفع ثمنه.
      </p>
    </div>
  </main>
</template>
