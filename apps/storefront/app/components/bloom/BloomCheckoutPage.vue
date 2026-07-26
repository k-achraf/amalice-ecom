<script setup lang="ts">
import type { ZodTypeAny } from 'zod'
import type { CartItem } from '~/stores/cart'

// Bloom checkout — glow-card form left, sticky glow-card order summary
// right. No UForm/UStepper/UPinInput: address validation runs the passed
// Zod schema directly on submit (same gate UForm applied internally), the
// step indicator is filled/outline circles (the round motif), OTP uses
// BloomPinInput.
const props = defineProps<{
  cart: { items: CartItem[]; totalCents: number }
  step: string
  stepItems: { value: string; title: string; icon: string }[]
  form: {
    phone: string
    name: string
    address: { line1: string; line2: string; city: string; region: string; postalCode: string; country: string }
  }
  addressSchema: ZodTypeAny
  placing: boolean
  placeError: string | null
  order: { id: string; totalCents: number } | null
  otpCode: string[]
  otpCodeString: string
  otpError: string | null
  verifying: boolean
  resendCooldown: number
  onAddressSubmit: () => void
  onPlaceOrder: () => void
  onVerifyCode: () => void
  onResendCode: () => void
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
  <div class="bg-[var(--color-bloom-blush)]">
    <div class="bg-gradient-to-br from-[var(--color-bloom-hero-from)] to-[var(--color-bloom-hero-to)]">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          <NuxtLink to="/" class="hover:text-primary-600">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-[var(--color-bloom-ink)]">Checkout</span>
        </nav>
        <h1 class="font-display text-4xl text-[var(--color-bloom-ink)] sm:text-5xl">Checkout</h1>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <ClientOnly>
        <EmptyState v-if="props.cart.items.length === 0" icon="i-lucide-shopping-bag" title="Your bag is empty" description="Add something before checking out.">
          <BloomButton to="/catalog" class="mt-4">Continue shopping</BloomButton>
        </EmptyState>

        <template v-else>
          <!-- Step indicator -->
          <div class="mb-10 flex items-center justify-center gap-3">
            <template v-for="(s, i) in props.stepItems" :key="s.value">
              <div class="flex items-center gap-2">
                <div
                  class="flex size-9 items-center justify-center rounded-full text-sm font-medium transition-colors"
                  :class="i < currentStepIndex ? 'bg-primary-500 text-white' : i === currentStepIndex ? 'bg-primary-500 text-white shadow-[var(--shadow-bloom-sm)]' : 'bg-white text-neutral-400'"
                >
                  <Icon v-if="i < currentStepIndex" name="i-lucide-check" class="size-4" />
                  <template v-else>{{ i + 1 }}</template>
                </div>
                <span class="hidden text-sm font-medium sm:inline" :class="s.value === props.step ? 'text-[var(--color-bloom-ink)]' : 'text-neutral-400'">{{ s.title }}</span>
              </div>
              <div v-if="i < props.stepItems.length - 1" class="h-px w-8 bg-neutral-200" />
            </template>
          </div>

          <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div class="lg:col-span-2">
              <div class="glow-card p-6 sm:p-8">
                <!-- Step 1: address -->
                <div v-if="props.step === 'address'">
                  <h2 class="font-display mb-1 text-2xl text-[var(--color-bloom-ink)]">Delivery details</h2>
                  <p class="mb-6 text-sm text-neutral-500">Where should we send your glow?</p>
                  <form class="space-y-5" @submit.prevent="submitAddress">
                    <div>
                      <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">Phone</label>
                      <BloomInput v-model="props.form.phone" type="tel" placeholder="+15551234567" icon="i-lucide-phone" />
                      <p v-if="fieldErrors['phone']" class="mt-1 text-xs font-medium text-primary-600">{{ fieldErrors['phone'] }}</p>
                    </div>
                    <div>
                      <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">Name (optional)</label>
                      <BloomInput v-model="props.form.name" icon="i-lucide-user" />
                    </div>
                    <div>
                      <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">Address line 1</label>
                      <BloomInput v-model="props.form.address.line1" icon="i-lucide-map-pin" />
                      <p v-if="fieldErrors['address.line1']" class="mt-1 text-xs font-medium text-primary-600">{{ fieldErrors['address.line1'] }}</p>
                    </div>
                    <div>
                      <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">Address line 2 (optional)</label>
                      <BloomInput v-model="props.form.address.line2" />
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">City</label>
                        <BloomInput v-model="props.form.address.city" />
                        <p v-if="fieldErrors['address.city']" class="mt-1 text-xs font-medium text-primary-600">{{ fieldErrors['address.city'] }}</p>
                      </div>
                      <div>
                        <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">Region / State</label>
                        <BloomInput v-model="props.form.address.region" />
                        <p v-if="fieldErrors['address.region']" class="mt-1 text-xs font-medium text-primary-600">{{ fieldErrors['address.region'] }}</p>
                      </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">Postal code</label>
                        <BloomInput v-model="props.form.address.postalCode" />
                        <p v-if="fieldErrors['address.postalCode']" class="mt-1 text-xs font-medium text-primary-600">{{ fieldErrors['address.postalCode'] }}</p>
                      </div>
                      <div>
                        <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">Country (2-letter)</label>
                        <BloomInput v-model="props.form.address.country" :maxlength="2" class="uppercase" />
                        <p v-if="fieldErrors['address.country']" class="mt-1 text-xs font-medium text-primary-600">{{ fieldErrors['address.country'] }}</p>
                      </div>
                    </div>
                    <BloomButton type="submit" block size="lg" trailing-icon="i-lucide-arrow-right">Continue to review</BloomButton>
                  </form>
                </div>

                <!-- Step 2: review -->
                <div v-else-if="props.step === 'review'">
                  <h2 class="font-display mb-1 text-2xl text-[var(--color-bloom-ink)]">Review your order</h2>
                  <p class="mb-6 text-sm text-neutral-500">Everything look right?</p>

                  <div class="space-y-3 rounded-2xl bg-neutral-50 p-4">
                    <h3 class="text-sm font-semibold text-[var(--color-bloom-ink)]">Items</h3>
                    <ul class="divide-y divide-neutral-200">
                      <li v-for="item in props.cart.items" :key="item.productId" class="flex justify-between py-2 text-sm">
                        <span class="text-neutral-600">{{ item.name }} × {{ item.quantity }}</span>
                        <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="font-medium" />
                      </li>
                    </ul>
                  </div>

                  <div class="mt-4 space-y-1 rounded-2xl border border-neutral-100 p-4 text-sm">
                    <h3 class="mb-2 font-semibold text-[var(--color-bloom-ink)]">Deliver to</h3>
                    <p class="font-medium text-[var(--color-bloom-ink)]">{{ props.form.name || props.form.phone }}</p>
                    <p class="text-neutral-500">{{ props.form.address.line1 }}<template v-if="props.form.address.line2">, {{ props.form.address.line2 }}</template></p>
                    <p class="text-neutral-500">{{ props.form.address.city }}, {{ props.form.address.region }} {{ props.form.address.postalCode }}</p>
                    <p class="text-neutral-500">{{ props.form.address.country }}</p>
                    <p class="text-neutral-500">{{ props.form.phone }}</p>
                  </div>

                  <div class="mt-4 flex items-center justify-between rounded-2xl bg-primary-50 p-4">
                    <span class="font-medium text-primary-700">Cash due on delivery</span>
                    <PriceDisplay :amount-cents="props.cart.totalCents" class="text-lg font-semibold text-primary-700" />
                  </div>

                  <p v-if="props.placeError" class="mt-4 rounded-2xl bg-red-500 p-3 text-sm font-medium text-white">{{ props.placeError }}</p>

                  <div class="mt-6 flex gap-3">
                    <BloomButton variant="outline" color="neutral" icon="i-lucide-arrow-left" @click="props.onBack">Back</BloomButton>
                    <BloomButton block size="lg" :loading="props.placing" @click="props.onPlaceOrder">Place order</BloomButton>
                  </div>
                </div>

                <!-- Step 3: OTP -->
                <div v-else-if="props.step === 'otp'">
                  <h2 class="font-display mb-1 text-2xl text-[var(--color-bloom-ink)]">Confirm your order</h2>
                  <p class="mb-6 leading-relaxed text-neutral-600">
                    We sent a 6-digit code to <span class="font-medium text-[var(--color-bloom-ink)]">{{ props.form.phone }}</span>. Enter it below to confirm.
                  </p>
                  <div class="rounded-2xl bg-neutral-50 p-6">
                    <BloomPinInput v-model="props.otpCode" :length="6" />
                  </div>
                  <p v-if="props.otpError" class="mt-4 rounded-2xl bg-red-500 p-3 text-sm font-medium text-white">{{ props.otpError }}</p>
                  <BloomButton block size="lg" :loading="props.verifying" :disabled="props.otpCodeString.length !== 6" class="mt-6" @click="props.onVerifyCode">Confirm order</BloomButton>
                  <BloomButton variant="ghost" color="neutral" block class="mt-2" :disabled="props.resendCooldown > 0" @click="props.onResendCode">
                    {{ props.resendCooldown > 0 ? `Resend code in ${props.resendCooldown}s` : 'Resend code' }}
                  </BloomButton>
                </div>
              </div>
            </div>

            <div class="lg:col-span-1">
              <div class="glow-card sticky top-24 p-6">
                <h2 class="font-display mb-4 text-2xl text-[var(--color-bloom-ink)]">Summary</h2>
                <ul class="mb-4 max-h-64 space-y-3 overflow-y-auto pr-1">
                  <li v-for="item in props.cart.items" :key="item.productId" class="flex items-center gap-3">
                    <div class="size-12 shrink-0 overflow-hidden rounded-xl bg-[var(--color-bloom-blush)]">
                      <NuxtImg v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" class="size-full object-cover" width="48" height="48" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="line-clamp-1 text-sm font-medium text-[var(--color-bloom-ink)]">{{ item.name }}</p>
                      <p class="text-xs text-neutral-400">Qty {{ item.quantity }}</p>
                    </div>
                    <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="text-sm font-medium text-[var(--color-bloom-ink)]" />
                  </li>
                </ul>
                <div class="space-y-2 border-t border-neutral-100 pt-4 text-sm">
                  <div class="flex items-center justify-between"><span class="text-neutral-500">Subtotal</span><PriceDisplay :amount-cents="props.cart.totalCents" class="font-medium" /></div>
                  <div class="flex items-center justify-between"><span class="text-neutral-500">Shipping</span><span class="font-medium text-primary-600">Free</span></div>
                </div>
                <div class="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4">
                  <span class="font-medium text-[var(--color-bloom-ink)]">Total</span>
                  <PriceDisplay :amount-cents="props.cart.totalCents" class="text-xl font-semibold text-primary-600" />
                </div>
                <p class="mt-2 flex items-center gap-1.5 text-xs text-neutral-400"><Icon name="i-lucide-banknote" class="size-3.5" /> Cash on delivery</p>
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
