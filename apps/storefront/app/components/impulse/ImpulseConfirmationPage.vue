<script setup lang="ts">
// Impulse order-confirmation — the funnel's final screen, styled like every
// other Impulse page (funnel-card, ImpulseButton, big-icon reassurance
// blocks) instead of the generic @nuxt/ui fallback (see ConfirmationPage.vue
// / TemplatePage.vue's OVERRIDES). Reuses ImpulseTrustRow right after the
// order summary — a "you made the right call" reinforcement immediately
// after purchase is the same reassurance-lives-next-to-the-ask principle the
// rest of this template applies everywhere else.
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
  <div class="bg-neutral-50">
    <section class="mx-auto max-w-2xl space-y-6 px-4 py-12 sm:px-6">
      <div v-if="notFound" class="funnel-card space-y-4 p-8 text-center">
        <Icon name="i-lucide-search-x" class="mx-auto size-10 text-neutral-300" />
        <h1 class="font-display text-xl font-black uppercase text-neutral-900">تعذر العثور على هذا الطلب</h1>
        <p class="mx-auto max-w-sm text-sm leading-relaxed text-neutral-500">
          هذه الصفحة تعمل فقط مباشرة بعد إتمام الطلب. إذا غادرتها، استخدم تتبع الطلب برقم هاتفك بدلاً من ذلك.
        </p>
        <ImpulseButton to="/" size="lg">متابعة التسوق</ImpulseButton>
      </div>

      <template v-else-if="order">
        <!-- 1. Success header — the funnel's payoff moment. -->
        <div class="flex flex-col items-center gap-3 text-center">
          <span class="flex size-16 items-center justify-center rounded-full bg-[var(--color-impulse-green-soft)]">
            <Icon name="i-lucide-check" class="size-8 text-[var(--color-impulse-green)]" />
          </span>
          <h1 class="font-display text-3xl font-black uppercase text-neutral-900">
            تم استلام <span class="marker">طلبك</span>
          </h1>
          <p class="text-sm font-semibold text-neutral-500">
            رقم الطلب
            <span class="tabular font-black text-neutral-900">{{ order.id }}</span>
          </p>
          <ImpulseBadge color="green" variant="subtle">
            <Icon name="i-lucide-phone-call" class="size-3.5" />
            سيتصل بك فريقنا قريباً للتأكيد
          </ImpulseBadge>
        </div>

        <!-- 2. Order summary. -->
        <div class="funnel-card space-y-3 p-6">
          <h2 class="text-xs font-bold uppercase tracking-wide text-neutral-500">طلبك</h2>
          <ul class="divide-y divide-neutral-100">
            <li v-for="item in order.items" :key="item.productId" class="flex items-center justify-between py-3 text-sm">
              <span class="font-semibold text-neutral-700">{{ item.name }} × {{ item.quantity }}</span>
              <PriceDisplay :amount-cents="item.lineTotalCents" class="font-bold text-neutral-900" />
            </li>
          </ul>
          <div class="flex items-center justify-between rounded-xl bg-[var(--color-impulse-green-soft)] p-4">
            <span class="text-sm font-bold uppercase text-[var(--color-impulse-green)]">المجموع المستحق عند الاستلام</span>
            <PriceDisplay :amount-cents="order.totalCents" class="font-display text-2xl font-black text-[var(--color-impulse-green)]" />
          </div>
        </div>

        <!-- 3. Delivery estimate. -->
        <div class="funnel-card flex items-center gap-3 p-5 text-sm">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-50">
            <Icon name="i-lucide-truck" class="size-5 text-primary-600" />
          </span>
          <p class="leading-relaxed text-neutral-600">
            <span class="font-bold text-neutral-900">موعد التوصيل المتوقع: {{ deliveryWindow }}.</span>
            احتفظ برقم طلبك في متناول يدك عند التواصل مع الدعم.
          </p>
        </div>

        <!-- 4. Reassurance stack — same trust row every other page uses. -->
        <ImpulseTrustRow />

        <ImpulseButton to="/" size="lg" block variant="outline">متابعة التسوق</ImpulseButton>
      </template>
    </section>
  </div>
</template>
