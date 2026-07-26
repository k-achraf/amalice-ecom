<script setup lang="ts">
import type { ZodTypeAny } from 'zod'
import type { CartItem } from '~/stores/cart'

// Forge checkout — bordered form left, sticky bordered order summary right.
// No UForm/UStepper/UPinInput: address validation runs the passed Zod
// schema directly on submit (same gate UForm applied internally), the step
// indicator is plain divs, and OTP uses ForgePinInput.
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
</script>

<template>
  <div class="bg-white">
    <div class="border-b-[3px] border-[var(--color-forge-ink)] bg-primary-500">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-[var(--color-forge-ink)]/60">
          <NuxtLink to="/" class="hover:underline">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-[var(--color-forge-ink)]">Checkout</span>
        </nav>
        <h1 class="font-display text-3xl uppercase sm:text-4xl">Checkout</h1>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <ClientOnly>
        <EmptyState v-if="props.cart.items.length === 0" icon="i-lucide-shopping-cart" title="Your cart is empty" description="Add something to your cart before checking out.">
          <ForgeButton to="/catalog" class="mt-4">Continue shopping</ForgeButton>
        </EmptyState>

        <template v-else>
          <!-- Step indicator -->
          <div class="mb-10 flex items-center justify-center gap-3">
            <template v-for="(s, i) in props.stepItems" :key="s.value">
              <div class="flex items-center gap-2">
                <div
                  class="flex size-8 items-center justify-center border-[3px] border-[var(--color-forge-ink)] text-sm font-bold"
                  :class="s.value === props.step ? 'bg-primary-500 text-[var(--color-forge-ink)]' : 'bg-white text-[var(--color-forge-ink)]/40'"
                >{{ i + 1 }}</div>
                <span class="hidden text-sm font-bold uppercase sm:inline" :class="s.value === props.step ? 'text-[var(--color-forge-ink)]' : 'text-[var(--color-forge-ink)]/40'">{{ s.title }}</span>
              </div>
              <div v-if="i < props.stepItems.length - 1" class="h-0.5 w-8 bg-[var(--color-forge-ink)]/20" />
            </template>
          </div>

          <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div class="lg:col-span-2">
              <div class="border-[3px] border-[var(--color-forge-ink)] bg-white p-6 sm:p-8">
                <!-- Step 1: address -->
                <div v-if="props.step === 'address'">
                  <h2 class="font-display mb-1 text-xl uppercase">Delivery details</h2>
                  <p class="mb-6 text-sm text-[var(--color-forge-ink)]/60">Where should we ship your order?</p>
                  <form class="space-y-5" @submit.prevent="submitAddress">
                    <div>
                      <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--color-forge-ink)]/70">Phone</label>
                      <ForgeInput v-model="props.form.phone" type="tel" placeholder="+15551234567" icon="i-lucide-phone" />
                      <p v-if="fieldErrors['phone']" class="mt-1 text-xs font-bold text-red-700">{{ fieldErrors['phone'] }}</p>
                    </div>
                    <div>
                      <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--color-forge-ink)]/70">Name (optional)</label>
                      <ForgeInput v-model="props.form.name" icon="i-lucide-user" />
                    </div>
                    <div>
                      <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--color-forge-ink)]/70">Address line 1</label>
                      <ForgeInput v-model="props.form.address.line1" icon="i-lucide-map-pin" />
                      <p v-if="fieldErrors['address.line1']" class="mt-1 text-xs font-bold text-red-700">{{ fieldErrors['address.line1'] }}</p>
                    </div>
                    <div>
                      <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--color-forge-ink)]/70">Address line 2 (optional)</label>
                      <ForgeInput v-model="props.form.address.line2" />
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--color-forge-ink)]/70">City</label>
                        <ForgeInput v-model="props.form.address.city" />
                        <p v-if="fieldErrors['address.city']" class="mt-1 text-xs font-bold text-red-700">{{ fieldErrors['address.city'] }}</p>
                      </div>
                      <div>
                        <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--color-forge-ink)]/70">Region / State</label>
                        <ForgeInput v-model="props.form.address.region" />
                        <p v-if="fieldErrors['address.region']" class="mt-1 text-xs font-bold text-red-700">{{ fieldErrors['address.region'] }}</p>
                      </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--color-forge-ink)]/70">Postal code</label>
                        <ForgeInput v-model="props.form.address.postalCode" />
                        <p v-if="fieldErrors['address.postalCode']" class="mt-1 text-xs font-bold text-red-700">{{ fieldErrors['address.postalCode'] }}</p>
                      </div>
                      <div>
                        <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--color-forge-ink)]/70">Country (2-letter)</label>
                        <ForgeInput v-model="props.form.address.country" :maxlength="2" class="uppercase" />
                        <p v-if="fieldErrors['address.country']" class="mt-1 text-xs font-bold text-red-700">{{ fieldErrors['address.country'] }}</p>
                      </div>
                    </div>
                    <ForgeButton type="submit" block size="lg" trailing-icon="i-lucide-arrow-right">Continue to review</ForgeButton>
                  </form>
                </div>

                <!-- Step 2: review -->
                <div v-else-if="props.step === 'review'">
                  <h2 class="font-display mb-1 text-xl uppercase">Review your order</h2>
                  <p class="mb-6 text-sm text-[var(--color-forge-ink)]/60">Everything look right?</p>

                  <div class="space-y-3 border-[3px] border-[var(--color-forge-ink)] p-4">
                    <h3 class="text-sm font-bold uppercase">Items</h3>
                    <ul class="divide-y-2 divide-[var(--color-forge-ink)]/10">
                      <li v-for="item in props.cart.items" :key="item.productId" class="flex justify-between py-2 text-sm">
                        <span class="text-[var(--color-forge-ink)]/70">{{ item.name }} × {{ item.quantity }}</span>
                        <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="font-bold" />
                      </li>
                    </ul>
                  </div>

                  <div class="mt-4 space-y-1 border-[3px] border-[var(--color-forge-ink)] p-4 text-sm">
                    <h3 class="mb-2 font-bold uppercase">Deliver to</h3>
                    <p class="font-bold text-[var(--color-forge-ink)]">{{ props.form.name || props.form.phone }}</p>
                    <p class="text-[var(--color-forge-ink)]/70">{{ props.form.address.line1 }}<template v-if="props.form.address.line2">, {{ props.form.address.line2 }}</template></p>
                    <p class="text-[var(--color-forge-ink)]/70">{{ props.form.address.city }}, {{ props.form.address.region }} {{ props.form.address.postalCode }}</p>
                    <p class="text-[var(--color-forge-ink)]/70">{{ props.form.address.country }}</p>
                    <p class="text-[var(--color-forge-ink)]/70">{{ props.form.phone }}</p>
                  </div>

                  <div class="mt-4 flex items-center justify-between border-[3px] border-[var(--color-forge-ink)] bg-primary-500 p-4">
                    <span class="font-bold uppercase">Cash due on delivery</span>
                    <PriceDisplay :amount-cents="props.cart.totalCents" class="text-lg font-bold" />
                  </div>

                  <p v-if="props.placeError" class="mt-4 border-[3px] border-[var(--color-forge-ink)] bg-red-700 p-3 text-sm font-bold text-white">{{ props.placeError }}</p>

                  <div class="mt-6 flex gap-3">
                    <ForgeButton color="neutral" variant="outline" icon="i-lucide-arrow-left" @click="props.onBack">Back</ForgeButton>
                    <ForgeButton block size="lg" :loading="props.placing" @click="props.onPlaceOrder">Place order</ForgeButton>
                  </div>
                </div>

                <!-- Step 3: OTP -->
                <div v-else-if="props.step === 'otp'">
                  <h2 class="font-display mb-1 text-xl uppercase">Confirm your order</h2>
                  <p class="mb-6 leading-relaxed text-[var(--color-forge-ink)]/70">
                    We sent a 6-digit code to <span class="font-bold text-[var(--color-forge-ink)]">{{ props.form.phone }}</span>. Enter it below to confirm.
                  </p>
                  <div class="border-[3px] border-[var(--color-forge-ink)] p-6">
                    <ForgePinInput v-model="props.otpCode" :length="6" />
                  </div>
                  <p v-if="props.otpError" class="mt-4 border-[3px] border-[var(--color-forge-ink)] bg-red-700 p-3 text-sm font-bold text-white">{{ props.otpError }}</p>
                  <ForgeButton block size="lg" :loading="props.verifying" :disabled="props.otpCodeString.length !== 6" class="mt-6" @click="props.onVerifyCode">Confirm order</ForgeButton>
                  <ForgeButton color="neutral" variant="ghost" block class="mt-2" :disabled="props.resendCooldown > 0" @click="props.onResendCode">
                    {{ props.resendCooldown > 0 ? `Resend code in ${props.resendCooldown}s` : 'Resend code' }}
                  </ForgeButton>
                </div>
              </div>
            </div>

            <div class="lg:col-span-1">
              <div class="sticky top-24 border-[3px] border-[var(--color-forge-ink)] bg-white p-6">
                <h2 class="font-display mb-4 text-lg uppercase">Order summary</h2>
                <ul class="mb-4 max-h-64 space-y-3 overflow-y-auto pr-1">
                  <li v-for="item in props.cart.items" :key="item.productId" class="flex items-center gap-3">
                    <div class="size-12 shrink-0 overflow-hidden border-[3px] border-[var(--color-forge-ink)] bg-neutral-100">
                      <NuxtImg v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" class="size-full object-cover" width="48" height="48" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="line-clamp-1 text-sm font-bold text-[var(--color-forge-ink)]">{{ item.name }}</p>
                      <p class="text-xs text-[var(--color-forge-ink)]/50">Qty {{ item.quantity }}</p>
                    </div>
                    <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="text-sm font-bold text-[var(--color-forge-ink)]" />
                  </li>
                </ul>
                <div class="space-y-2 border-t-[3px] border-[var(--color-forge-ink)] pt-4 text-sm">
                  <div class="flex items-center justify-between"><span class="text-[var(--color-forge-ink)]/60">Subtotal</span><PriceDisplay :amount-cents="props.cart.totalCents" class="font-bold" /></div>
                  <div class="flex items-center justify-between"><span class="text-[var(--color-forge-ink)]/60">Shipping</span><span class="font-bold text-primary-700">Free</span></div>
                </div>
                <div class="mt-4 flex items-center justify-between border-t-[3px] border-[var(--color-forge-ink)] pt-4">
                  <span class="font-bold uppercase">Total</span>
                  <PriceDisplay :amount-cents="props.cart.totalCents" class="text-2xl font-bold" />
                </div>
                <p class="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-forge-ink)]/50"><Icon name="i-lucide-banknote" class="size-3.5" /> Cash on delivery</p>
              </div>
            </div>
          </div>
        </template>

        <template #fallback>
          <div class="flex items-center justify-center py-24 text-[var(--color-forge-ink)]/40">
            <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
          </div>
        </template>
      </ClientOnly>
    </section>
  </div>
</template>
