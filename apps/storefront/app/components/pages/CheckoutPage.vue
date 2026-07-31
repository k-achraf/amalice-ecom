<script setup lang="ts">
import type { ZodTypeAny } from 'zod'
import type { CartItem } from '~/stores/cart'

// Minimal (fallback) checkout presentation — vertical stepper, single-column
// form. Order placement + step state live in the page shell; this receives
// the reactive state + handlers and renders the 2 steps. No @nuxt/ui: address
// validation runs the passed Zod schema directly on submit.
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

const currentStepIndex = computed(() => props.stepItems.findIndex((s) => s.value === props.step))
</script>

<template>
  <ClientOnly>
    <main class="mx-auto max-w-2xl space-y-8 p-6">
      <h1 class="text-2xl font-semibold">إتمام الطلب</h1>

      <EmptyState
        v-if="props.cart.items.length === 0"
        icon="i-lucide-shopping-cart"
        title="سلتك فارغة"
        description="أضف منتجاً إلى سلتك قبل إتمام الطلب."
      >
        <Button to="/" variant="outline" color="neutral">متابعة التسوق</Button>
      </EmptyState>

      <template v-else>
        <!-- Step indicator -->
        <div class="flex items-center justify-center gap-2">
          <template v-for="(s, i) in props.stepItems" :key="s.value">
            <div class="flex items-center gap-2">
              <span
                class="flex size-7 items-center justify-center rounded-full text-xs font-semibold"
                :class="i < currentStepIndex ? 'bg-primary text-inverted' : i === currentStepIndex ? 'border-2 border-primary text-primary' : 'border border-default text-muted'"
              >
                <Icon v-if="i < currentStepIndex" name="i-lucide-check" class="size-3.5" />
                <template v-else>{{ i + 1 }}</template>
              </span>
              <span class="text-sm font-medium" :class="i === currentStepIndex ? 'text-highlighted' : 'text-muted'">{{ s.title }}</span>
            </div>
            <div v-if="i < props.stepItems.length - 1" class="h-px w-6 bg-default" />
          </template>
        </div>

        <!-- Step 1: address -->
        <form v-if="props.step === 'address'" class="space-y-4" @submit.prevent="submitAddress">
          <div class="space-y-1">
            <label class="block text-sm font-medium text-highlighted">رقم الهاتف</label>
            <Input v-model="props.form.phone" type="tel" placeholder="+15551234567" class="w-full" />
            <p class="text-xs text-muted">بصيغة E.164، مثال: +15551234567</p>
            <p v-if="fieldErrors['phone']" class="text-sm text-error">{{ fieldErrors['phone'] }}</p>
          </div>
          <div class="space-y-1">
            <label class="block text-sm font-medium text-highlighted">الاسم (اختياري)</label>
            <Input v-model="props.form.name" class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="block text-sm font-medium text-highlighted">العنوان - السطر 1</label>
            <Input v-model="props.form.address.line1" class="w-full" />
            <p v-if="fieldErrors['address.line1']" class="text-sm text-error">{{ fieldErrors['address.line1'] }}</p>
          </div>
          <div class="space-y-1">
            <label class="block text-sm font-medium text-highlighted">العنوان - السطر 2 (اختياري)</label>
            <Input v-model="props.form.address.line2" class="w-full" />
          </div>
          <CheckoutShippingFields :form="props.form" />
          <p v-if="props.addressError" class="text-sm text-error">{{ props.addressError }}</p>
          <Button type="submit" block size="lg">متابعة للمراجعة</Button>
        </form>

        <!-- Step 2: review -->
        <div v-else-if="props.step === 'review'" class="space-y-6">
          <div class="space-y-2">
            <h2 class="font-medium text-highlighted">المنتجات</h2>
            <ul class="divide-y divide-default">
              <li v-for="item in props.cart.items" :key="item.productId" class="flex justify-between py-2 text-sm">
                <span>{{ item.name }} × {{ item.quantity }}</span>
                <PriceDisplay :amount-cents="item.priceCents * item.quantity" />
              </li>
            </ul>
          </div>
          <div class="space-y-1 text-sm">
            <h2 class="font-medium text-highlighted">التوصيل إلى</h2>
            <p>{{ props.form.name || props.form.phone }}</p>
            <p>{{ props.form.address.line1 }}<template v-if="props.form.address.line2">, {{ props.form.address.line2 }}</template></p>
            <p>{{ props.form.address.city }}, {{ props.form.address.region }}</p>
            <p>{{ props.form.phone }}</p>
          </div>
          <div class="space-y-2 border-t border-default pt-4 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-muted">الشحن ({{ props.form.shippingType === 'Home' ? 'التوصيل إلى المنزل' : 'الاستلام من مكتب التوصيل' }})</span>
              <PriceDisplay :amount-cents="props.form.shippingPriceCents" />
            </div>
          </div>
          <div class="flex items-center justify-between border-t border-default pt-4">
            <span class="font-medium">المجموع المستحق عند الاستلام</span>
            <PriceDisplay :amount-cents="props.totalCents" class="text-lg font-semibold" />
          </div>
          <Alert v-if="props.placeError" color="error" :description="props.placeError" />
          <div class="flex gap-3">
            <Button variant="outline" color="neutral" @click="props.onBack">رجوع</Button>
            <Button block size="lg" :loading="props.placing" @click="props.onPlaceOrder">تأكيد الطلب</Button>
          </div>
        </div>
      </template>
    </main>

    <template #fallback>
      <div class="py-24 text-center text-muted">جارٍ التحميل...</div>
    </template>
  </ClientOnly>
</template>
