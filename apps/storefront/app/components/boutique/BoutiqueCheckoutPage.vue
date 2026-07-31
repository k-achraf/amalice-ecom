<script setup lang="ts">
import type { ZodTypeAny } from 'zod'
import type { CartItem } from '~/stores/cart'

// Boutique checkout — a narrow, single-column ceremony (max-w-xl). Every
// label is uppercase tracking-widest, fields are the underlined convention,
// vertical rhythm is generous. The 2 steps (address, review) render under a
// refined dot/line stepper. No @nuxt/ui: address validation runs the passed
// Zod schema directly on submit. Wrapped in ClientOnly for hydration safety.
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
  <ClientOnly>
    <main class="bg-default">
      <!-- Eyebrow header -->
      <header class="mx-auto max-w-xl px-6 pt-24 text-center sm:pt-32">
        <p class="text-xs uppercase tracking-[0.4em] text-muted">أوشكت على الانتهاء</p>
        <h1 class="mt-6 text-3xl font-light tracking-tight text-highlighted sm:text-4xl">إتمام الطلب</h1>
        <div class="mx-auto mt-8 h-px w-12 bg-default" />
      </header>

      <section class="mx-auto max-w-xl px-6 py-20 sm:py-24">
        <EmptyState
          v-if="props.cart.items.length === 0"
          icon="i-lucide-shopping-bag"
          title="حقيبتك فارغة"
          description="أضف منتجاً إلى سلتك قبل إتمام الطلب."
        >
          <BoutiqueButton to="/" variant="outline" color="neutral" class="mt-6">
            متابعة التسوق
          </BoutiqueButton>
        </EmptyState>

        <template v-else>
          <!-- Step indicator -->
          <div class="mb-16 flex items-center justify-center gap-4">
            <template v-for="(s, i) in props.stepItems" :key="s.value">
              <span class="text-xs uppercase tracking-[0.2em]" :class="s.value === props.step ? 'text-highlighted' : 'text-muted'">
                {{ String(i + 1).padStart(2, '0') }} — {{ s.title }}
              </span>
              <span v-if="i < props.stepItems.length - 1" class="h-px w-6 bg-default" />
            </template>
          </div>

          <!-- Step 1: address -->
          <form v-if="props.step === 'address'" class="space-y-8" @submit.prevent="submitAddress">
            <div>
              <span class="text-xs uppercase tracking-[0.3em] text-muted">رقم الهاتف</span>
              <BoutiqueInput v-model="props.form.phone" type="tel" placeholder="+213 555 123 456" class="mt-2 w-full" />
              <p class="mt-1.5 text-[11px] uppercase tracking-widest text-muted">E.164</p>
              <p v-if="fieldErrors['phone']" class="mt-1 text-xs text-error">{{ fieldErrors['phone'] }}</p>
            </div>

            <div>
              <span class="text-xs uppercase tracking-[0.3em] text-muted">الاسم (اختياري)</span>
              <BoutiqueInput v-model="props.form.name" class="mt-2 w-full" />
            </div>

            <div>
              <span class="text-xs uppercase tracking-[0.3em] text-muted">العنوان - السطر الأول</span>
              <BoutiqueInput v-model="props.form.address.line1" class="mt-2 w-full" />
              <p v-if="fieldErrors['address.line1']" class="mt-1 text-xs text-error">{{ fieldErrors['address.line1'] }}</p>
            </div>

            <div>
              <span class="text-xs uppercase tracking-[0.3em] text-muted">العنوان - السطر الثاني (اختياري)</span>
              <BoutiqueInput v-model="props.form.address.line2" class="mt-2 w-full" />
            </div>

            <BoutiqueCheckoutShippingFields :form="props.form" />
            <p v-if="props.addressError" class="mt-1 text-xs text-error">{{ props.addressError }}</p>

            <BoutiqueButton type="submit" block size="lg" color="neutral" variant="outline" class="!border-2">
              متابعة للمراجعة
            </BoutiqueButton>
          </form>

          <!-- Step 2: review -->
          <div v-else-if="props.step === 'review'" class="space-y-12">
            <div>
              <p class="mb-6 text-xs uppercase tracking-[0.4em] text-muted">المنتجات</p>
              <ul class="space-y-4">
                <li v-for="item in props.cart.items" :key="item.productId" class="flex justify-between text-sm font-light">
                  <span class="text-highlighted">{{ item.name }} <span class="text-muted">× {{ item.quantity }}</span></span>
                  <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="text-highlighted" />
                </li>
              </ul>
            </div>

            <div>
              <p class="mb-6 text-xs uppercase tracking-[0.4em] text-muted">التوصيل إلى</p>
              <div class="space-y-1 text-sm font-light text-muted">
                <p class="text-highlighted">{{ props.form.name || props.form.phone }}</p>
                <p>{{ props.form.address.line1 }}<template v-if="props.form.address.line2">, {{ props.form.address.line2 }}</template></p>
                <p>{{ props.form.address.city }}, {{ props.form.address.region }}</p>
                <p>{{ props.form.phone }}</p>
              </div>
            </div>

            <div class="flex items-baseline justify-between border-t border-default pt-8">
              <span class="text-xs uppercase tracking-[0.4em] text-muted">الشحن ({{ props.form.shippingType === 'Home' ? 'التوصيل إلى المنزل' : 'الاستلام من مكتب التوصيل' }})</span>
              <PriceDisplay :amount-cents="props.form.shippingPriceCents" class="text-highlighted" />
            </div>

            <div class="flex items-baseline justify-between border-t border-default pt-8">
              <span class="text-xs uppercase tracking-[0.4em] text-muted">المجموع المستحق عند الاستلام</span>
              <PriceDisplay :amount-cents="props.totalCents" class="price-accent text-2xl font-light tracking-tight" />
            </div>

            <BoutiqueAlert v-if="props.placeError" color="error" :description="props.placeError" />

            <div class="flex gap-4">
              <BoutiqueButton variant="ghost" color="neutral" @click="props.onBack">رجوع</BoutiqueButton>
              <BoutiqueButton block size="lg" color="neutral" variant="outline" :loading="props.placing" class="flex-1 !border-2" @click="props.onPlaceOrder">
                تأكيد الطلب
              </BoutiqueButton>
            </div>
          </div>
        </template>
      </section>
    </main>

    <template #fallback>
      <div class="py-32 text-center text-xs uppercase tracking-[0.3em] text-muted">Loading…</div>
    </template>
  </ClientOnly>
</template>
