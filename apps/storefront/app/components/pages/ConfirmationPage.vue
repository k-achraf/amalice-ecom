<script setup lang="ts">
// Fallback (minimal) order-confirmation presentation — used by every
// template except impulse (see TemplatePage.vue's OVERRIDES). Unchanged
// from the page's previous inline markup; extracted here so impulse can get
// its own on-brand version without touching this one.
interface ConfirmedOrderItem {
  productId: string
  name: string
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
}
interface ConfirmedOrder {
  id: string
  totalCents: number
  state: string
  createdAt: string
  items: ConfirmedOrderItem[]
}

defineProps<{
  order: ConfirmedOrder | null
  notFound: boolean
  deliveryWindow: string
}>()
</script>

<template>
  <main class="mx-auto max-w-2xl space-y-6 p-6">
    <EmptyState
      v-if="notFound"
      icon="i-lucide-search-x"
      title="تعذر العثور على هذا الطلب"
      description="هذه الصفحة تعمل فقط مباشرة بعد إتمام الطلب. إذا غادرتها، استخدم تتبع الطلب برقم هاتفك بدلاً من ذلك."
    >
      <UButton to="/" variant="outline" color="neutral">متابعة التسوق</UButton>
    </EmptyState>

    <template v-else-if="order">
      <div class="flex flex-col items-center gap-2 py-6 text-center">
        <UIcon name="i-lucide-phone-call" class="size-12 text-success" />
        <h1 class="text-2xl font-semibold">تم استلام طلبك</h1>
        <p class="text-sm text-neutral-500">
          رقم الطلب
          <span class="tabular font-medium text-highlighted">{{ order.id }}</span>
        </p>
        <p class="max-w-sm text-sm text-neutral-500">سيتصل بك فريقنا قريباً لتأكيد التفاصيل قبل الشحن.</p>
      </div>

      <div class="space-y-2 rounded-md border border-default p-4">
        <h2 class="font-medium text-highlighted">المنتجات</h2>
        <ul class="divide-y divide-default">
          <li
            v-for="item in order.items"
            :key="item.productId"
            class="flex justify-between py-2 text-sm"
          >
            <span>{{ item.name }} × {{ item.quantity }}</span>
            <PriceDisplay :amount-cents="item.lineTotalCents" />
          </li>
        </ul>
        <div class="flex items-center justify-between border-t border-default pt-3">
          <span class="font-medium">المجموع المستحق عند الاستلام</span>
          <PriceDisplay :amount-cents="order.totalCents" class="text-lg font-semibold" />
        </div>
      </div>

      <div class="flex items-center gap-3 rounded-md border border-default p-4 text-sm">
        <UIcon name="i-lucide-truck" class="size-5 shrink-0 text-neutral-500" />
        <span
          >موعد التوصيل المتوقع: {{ deliveryWindow }}. احتفظ برقم طلبك في متناول يدك عند التواصل
          مع الدعم.</span
        >
      </div>

      <UButton to="/" block variant="outline" color="neutral">متابعة التسوق</UButton>
    </template>
  </main>
</template>
