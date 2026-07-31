<script setup lang="ts">
import type { ZodTypeAny } from 'zod'
import type { CartItem } from '~/stores/cart'

// Impulse checkout — the funnel's final squeeze: single centered column
// (no side-by-side layout to wander into), a 2-dot progress indicator,
// big touch-target fields, and the pulsing place-order CTA with COD
// reassurance restated at the moment of highest anxiety. Address
// validation runs the passed Zod schema on submit (same gate UForm
// applied internally elsewhere).
const props = defineProps<{
  cart: { items: CartItem[]; totalCents: number }
  step: string
  stepItems: { value: string; title: string; icon: string }[]
  form: {
    phone: string
    name: string
    wilayaId: string
    shippingType: string
    shippingPriceCents: number
    address: { line1: string; line2: string; city: string; region: string; postalCode: string; country: string }
  }
  addressSchema: ZodTypeAny
  addressError: string | null
  totalCents: number
  placing: boolean
  placeError: string | null
  onAddressSubmit: () => void
  onPlaceOrder: () => void
  onBack: () => void
}>()

const fieldErrors = ref<Record<string, string>>({})

function submitAddress() {
  const result = props.addressSchema.safeParse(props.form)
  if (!result.success) {
    const errors: Record<string, string> = {}
    for (const issue of result.error.issues) errors[issue.path.join('.')] = issue.message
    fieldErrors.value = errors
    return
  }
  fieldErrors.value = {}
  props.onAddressSubmit()
}
</script>

<template>
  <div class="bg-neutral-50">
    <section class="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <ClientOnly>
        <div v-if="props.cart.items.length === 0" class="py-20 text-center">
          <Icon name="i-lucide-shopping-cart" class="mx-auto mb-3 size-10 text-neutral-300" />
          <p class="mb-4 font-bold text-neutral-900">سلتك فارغة.</p>
          <ImpulseButton to="/catalog" size="lg">شاهد العروض</ImpulseButton>
        </div>

        <template v-else>
          <h1 class="mb-2 text-center font-display text-3xl font-black uppercase text-neutral-900">
            الخطوة الأخيرة — <span class="marker">ثم نقوم بالتوصيل</span>
          </h1>
          <p class="mb-6 text-center text-sm font-semibold text-neutral-500">
            <Icon name="i-lucide-banknote" class="me-1 inline size-4 align-[-2px] text-[var(--color-impulse-green)]" />
            لا دفع الآن. الدفع نقداً عند الاستلام فقط.
          </p>

          <!-- Progress dots -->
          <div class="mb-8 flex items-center justify-center gap-3">
            <template v-for="(s, i) in props.stepItems" :key="s.value">
              <div class="flex items-center gap-2">
                <div
                  class="flex size-9 items-center justify-center rounded-full text-sm font-black transition-colors"
                  :class="s.value === props.step ? 'bg-primary-500 text-white shadow-[var(--shadow-impulse-cta)]' : 'bg-neutral-200 text-neutral-500'"
                >{{ i + 1 }}</div>
                <span class="text-sm font-bold" :class="s.value === props.step ? 'text-neutral-900' : 'text-neutral-400'">{{ s.title }}</span>
              </div>
              <div v-if="i < props.stepItems.length - 1" class="h-0.5 w-10 rounded bg-neutral-200" />
            </template>
          </div>

          <!-- Step 1: address -->
          <div v-if="props.step === 'address'" class="funnel-card space-y-5 p-6">
            <form class="space-y-4" @submit.prevent="submitAddress">
              <div>
                <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-600">رقم الهاتف</label>
                <ImpulseInput v-model="props.form.phone" type="tel" placeholder="+213..." icon="i-lucide-phone" />
                <p v-if="fieldErrors['phone']" class="mt-1 text-xs font-bold text-[var(--color-impulse-red)]">{{ fieldErrors['phone'] }}</p>
              </div>
              <div>
                <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-600">الاسم (اختياري)</label>
                <ImpulseInput v-model="props.form.name" icon="i-lucide-user" />
              </div>
              <div>
                <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-600">العنوان التفصيلي</label>
                <ImpulseInput v-model="props.form.address.line1" icon="i-lucide-map-pin" />
                <p v-if="fieldErrors['address.line1']" class="mt-1 text-xs font-bold text-[var(--color-impulse-red)]">{{ fieldErrors['address.line1'] }}</p>
              </div>
              <div>
                <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-neutral-600">تفاصيل إضافية (اختياري)</label>
                <ImpulseInput v-model="props.form.address.line2" />
              </div>
              <ImpulseCheckoutShippingFields :form="props.form" />
              <p v-if="props.addressError" class="mt-1 text-xs font-bold text-[var(--color-impulse-red)]">{{ props.addressError }}</p>
              <ImpulseButton type="submit" block size="lg" pulse trailing-icon="i-lucide-arrow-left">متابعة</ImpulseButton>
            </form>
          </div>

          <!-- Step 2: review -->
          <div v-else-if="props.step === 'review'" class="funnel-card space-y-4 p-6">
            <div class="space-y-2 rounded-xl bg-neutral-50 p-4">
              <h3 class="text-xs font-bold uppercase tracking-wide text-neutral-500">طلبك</h3>
              <ul class="divide-y divide-neutral-200">
                <li v-for="item in props.cart.items" :key="item.productId" class="flex justify-between py-2 text-sm">
                  <span class="font-semibold text-neutral-700">{{ item.name }} × {{ item.quantity }}</span>
                  <PriceDisplay :amount-cents="item.lineTotalCents ?? item.priceCents * item.quantity" class="font-bold" />
                </li>
              </ul>
            </div>

            <div class="space-y-1 rounded-xl border border-neutral-200 p-4 text-sm">
              <h3 class="mb-1 text-xs font-bold uppercase tracking-wide text-neutral-500">التوصيل إلى</h3>
              <p class="font-bold text-neutral-900">{{ props.form.name || props.form.phone }}</p>
              <p class="text-neutral-500">{{ props.form.address.line1 }}<template v-if="props.form.address.line2">, {{ props.form.address.line2 }}</template></p>
              <p class="text-neutral-500">{{ props.form.address.city }}, {{ props.form.address.region }}</p>
              <p class="text-neutral-500">{{ props.form.phone }}</p>
            </div>

            <div class="flex items-center justify-between rounded-xl bg-neutral-50 p-4 text-sm">
              <span class="font-semibold text-neutral-600">الشحن ({{ props.form.shippingType === 'Home' ? 'التوصيل إلى المنزل' : 'الاستلام من مكتب التوصيل' }})</span>
              <PriceDisplay :amount-cents="props.form.shippingPriceCents" class="font-bold text-neutral-900" />
            </div>

            <div class="flex items-center justify-between rounded-xl bg-[var(--color-impulse-green-soft)] p-4">
              <span class="text-sm font-bold uppercase text-[var(--color-impulse-green)]">المجموع المستحق عند الاستلام</span>
              <PriceDisplay :amount-cents="props.totalCents" class="font-display text-2xl font-black text-[var(--color-impulse-green)]" />
            </div>

            <p v-if="props.placeError" class="rounded-xl bg-[var(--color-impulse-red-soft)] p-3 text-center text-sm font-bold text-[var(--color-impulse-red)]">{{ props.placeError }}</p>

            <ImpulseButton block size="xl" pulse :loading="props.placing" trailing-icon="i-lucide-arrow-left" @click="props.onPlaceOrder">
              تأكيد الطلب
            </ImpulseButton>
            <button class="mx-auto flex items-center gap-1 text-xs font-semibold text-neutral-400 hover:text-neutral-700" @click="props.onBack">
              <Icon name="i-lucide-arrow-right" class="size-3.5" /> تعديل العنوان
            </button>
            <p class="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-neutral-400">
              <Icon name="i-lucide-shield-check" class="size-3.5 text-[var(--color-impulse-green)]" />
              نتصل بك للتأكيد قبل شحن أي شيء.
            </p>
          </div>

          <div class="mt-8">
            <ImpulseTrustRow />
          </div>
        </template>

        <template #fallback>
          <div class="flex items-center justify-center py-24 text-neutral-400">
            <Icon name="i-lucide-loader-circle" class="me-2 size-5 animate-spin" /> جارٍ التحميل...
          </div>
        </template>
      </ClientOnly>
    </section>
  </div>
</template>
