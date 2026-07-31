<script setup lang="ts">
import type { ZodTypeAny } from 'zod'
import type { CartItem } from '~/stores/cart'

// Promify checkout — 2-col: form left, live order summary card right. A
// plain dot/line stepper at top. Renders the 2 steps (address, review).
// Wrapped in ClientOnly. No @nuxt/ui: address validation runs the passed
// Zod schema directly on submit (the same gate UForm applied internally).
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
    <!-- Header band -->
    <div class="bg-gradient-to-r from-primary-600 to-primary-900">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <nav class="mb-3 flex items-center gap-2 text-sm text-white/60">
          <NuxtLink to="/" class="transition-colors hover:text-white">الرئيسية</NuxtLink>
          <Icon name="i-lucide-chevron-left" class="size-3.5" />
          <span class="text-white/90">إتمام الطلب</span>
        </nav>
        <h1 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">إتمام الطلب</h1>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <ClientOnly>
        <EmptyState
          v-if="props.cart.items.length === 0"
          icon="i-lucide-shopping-cart"
          title="سلتك فارغة"
          description="أضف منتجاً إلى سلتك قبل إتمام الطلب."
        >
          <PromifyButton to="/catalog" class="mt-4">متابعة التسوق</PromifyButton>
        </EmptyState>

        <template v-else>
          <!-- Step indicator -->
          <div class="mb-10 flex items-center justify-center gap-3">
            <template v-for="(s, i) in props.stepItems" :key="s.value">
              <div class="flex items-center gap-2">
                <div
                  class="flex size-8 items-center justify-center rounded-full text-sm font-semibold transition-colors"
                  :class="s.value === props.step ? 'bg-primary-600 text-white' : 'bg-white text-neutral-400 ring-1 ring-neutral-200'"
                >
                  <Icon v-if="props.stepItems.findIndex(x => x.value === props.step) > i" name="i-lucide-check" class="size-4" />
                  <span v-else>{{ i + 1 }}</span>
                </div>
                <span class="hidden text-sm font-medium sm:inline" :class="s.value === props.step ? 'text-neutral-900' : 'text-neutral-400'">{{ s.title }}</span>
              </div>
              <div v-if="i < props.stepItems.length - 1" class="h-px w-8 bg-neutral-200" />
            </template>
          </div>

          <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <!-- Left: step form -->
            <div class="lg:col-span-2">
              <div class="rounded-2xl border border-neutral-100 bg-white p-6 shadow-sm sm:p-8">
                <!-- Step 1: address -->
                <div v-if="props.step === 'address'">
                  <h2 class="mb-1 text-xl font-bold text-neutral-900">Delivery details</h2>
                  <p class="mb-6 text-sm text-neutral-500">Where should we ship your order?</p>
                  <form class="space-y-5" @submit.prevent="submitAddress">
                    <div>
                      <label class="mb-1.5 block text-sm font-medium text-neutral-700">Phone</label>
                      <PromifyInput v-model="props.form.phone" type="tel" placeholder="+15551234567" icon="i-lucide-phone" />
                      <p class="mt-1 text-xs text-neutral-400">E.164 format, e.g. +15551234567</p>
                      <p v-if="fieldErrors['phone']" class="mt-1 text-xs font-medium text-red-600">{{ fieldErrors['phone'] }}</p>
                    </div>
                    <div>
                      <label class="mb-1.5 block text-sm font-medium text-neutral-700">Name (optional)</label>
                      <PromifyInput v-model="props.form.name" icon="i-lucide-user" />
                    </div>
                    <div>
                      <label class="mb-1.5 block text-sm font-medium text-neutral-700">Address line 1</label>
                      <PromifyInput v-model="props.form.address.line1" icon="i-lucide-map-pin" />
                      <p v-if="fieldErrors['address.line1']" class="mt-1 text-xs font-medium text-red-600">{{ fieldErrors['address.line1'] }}</p>
                    </div>
                    <div>
                      <label class="mb-1.5 block text-sm font-medium text-neutral-700">Address line 2 (optional)</label>
                      <PromifyInput v-model="props.form.address.line2" />
                    </div>
                    <PromifyCheckoutShippingFields :form="props.form" />
                    <p v-if="props.addressError" class="mt-1 text-xs font-medium text-red-600">{{ props.addressError }}</p>
                    <PromifyButton type="submit" block size="xl" trailing-icon="i-lucide-arrow-right">
                      Continue to review
                    </PromifyButton>
                  </form>
                </div>

                <!-- Step 2: review -->
                <div v-else-if="props.step === 'review'">
                  <h2 class="mb-1 text-xl font-bold text-neutral-900">Review your order</h2>
                  <p class="mb-6 text-sm text-neutral-500">Everything look right?</p>

                  <div class="space-y-3 rounded-xl bg-neutral-50 p-4">
                    <h3 class="text-sm font-semibold text-neutral-900">Items</h3>
                    <ul class="divide-y divide-neutral-200">
                      <li v-for="item in props.cart.items" :key="item.productId" class="flex justify-between py-2 text-sm">
                        <span class="text-neutral-700">{{ item.name }} × {{ item.quantity }}</span>
                        <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="font-medium text-neutral-900" />
                      </li>
                    </ul>
                  </div>

                  <div class="mt-4 space-y-1 rounded-xl border border-neutral-100 p-4 text-sm">
                    <h3 class="mb-2 font-semibold text-neutral-900">Deliver to</h3>
                    <p class="font-medium text-neutral-900">{{ props.form.name || props.form.phone }}</p>
                    <p class="text-neutral-600">{{ props.form.address.line1 }}<template v-if="props.form.address.line2">, {{ props.form.address.line2 }}</template></p>
                    <p class="text-neutral-600">{{ props.form.address.city }}, {{ props.form.address.region }}</p>
                    <p class="text-neutral-600">{{ props.form.phone }}</p>
                  </div>

                  <div class="mt-4 space-y-1 rounded-xl border border-neutral-100 p-4 text-sm">
                    <div class="flex items-center justify-between">
                      <span class="text-neutral-500">Shipping ({{ props.form.shippingType === 'Home' ? 'Home delivery' : 'Desk delivery' }})</span>
                      <PriceDisplay :amount-cents="props.form.shippingPriceCents" class="font-medium text-neutral-900" />
                    </div>
                  </div>

                  <div class="mt-4 flex items-center justify-between rounded-xl bg-primary-50 p-4">
                    <span class="font-semibold text-primary-700">Cash due on delivery</span>
                    <PriceDisplay :amount-cents="props.totalCents" class="text-lg font-bold text-primary-700" />
                  </div>

                  <PromifyAlert v-if="props.placeError" color="error" icon="i-lucide-alert-circle" class="mt-4" :description="props.placeError" />

                  <div class="mt-6 flex gap-3">
                    <PromifyButton variant="outline" color="neutral" icon="i-lucide-arrow-left" @click="props.onBack">Back</PromifyButton>
                    <PromifyButton block size="xl" :loading="props.placing" @click="props.onPlaceOrder">
                      Place order
                    </PromifyButton>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right: live order summary -->
            <div class="lg:col-span-1">
              <div class="sticky top-20 rounded-2xl border border-neutral-100 bg-white p-6 shadow-[var(--shadow-promify-md)]">
                <h2 class="mb-4 text-lg font-bold text-neutral-900">Order summary</h2>
                <ul class="mb-4 max-h-64 space-y-3 overflow-y-auto pr-1">
                  <li v-for="item in props.cart.items" :key="item.productId" class="flex items-center gap-3">
                    <div class="size-12 shrink-0 overflow-hidden rounded-lg border border-neutral-100 bg-neutral-100">
                      <NuxtImg v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" class="size-full object-cover" width="48" height="48" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="line-clamp-1 text-sm font-medium text-neutral-900">{{ item.name }}</p>
                      <p class="text-xs text-neutral-400">Qty {{ item.quantity }}</p>
                    </div>
                    <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="text-sm font-medium text-neutral-900" />
                  </li>
                </ul>
                <div class="space-y-2 border-t border-neutral-100 pt-4 text-sm">
                  <div class="flex items-center justify-between">
                    <span class="text-neutral-500">Subtotal</span>
                    <PriceDisplay :amount-cents="props.cart.totalCents" class="font-medium text-neutral-900" />
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-neutral-500">Shipping</span>
                    <span v-if="!props.form.shippingType" class="font-medium text-primary-600">Free</span>
                    <PriceDisplay v-else :amount-cents="props.form.shippingPriceCents" class="font-medium text-neutral-900" />
                  </div>
                </div>
                <div class="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4">
                  <span class="text-base font-semibold text-neutral-900">Total</span>
                  <PriceDisplay :amount-cents="props.totalCents" class="text-xl font-bold text-neutral-900" />
                </div>
                <p class="mt-2 flex items-center gap-1.5 text-xs text-neutral-400">
                  <Icon name="i-lucide-banknote" class="size-3.5" /> Cash on delivery
                </p>
              </div>
            </div>
          </div>
        </template>

        <template #fallback>
          <div class="flex items-center justify-center py-24 text-neutral-400">
            <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
          </div>
        </template>
      </ClientOnly>
    </section>
  </div>
</template>
