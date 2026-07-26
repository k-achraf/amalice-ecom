<script setup lang="ts">
import type { ZodTypeAny } from 'zod'
import type { CartItem } from '~/stores/cart'

// Editorial checkout — full-width sections, numbered story steps, bold
// uppercase labels. The OTP flow renders inside the same single column.
// No @nuxt/ui: address validation runs the passed Zod schema directly on
// submit.
const props = defineProps<{
  cart: { items: CartItem[]; totalCents: number }
  step: string
  stepItems: { value: string; title: string; icon: string }[]
  form: { phone: string; name: string; address: { line1: string; line2: string; city: string; region: string; postalCode: string; country: string } }
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
  <ClientOnly>
    <div class="bg-default">
      <div class="mx-auto max-w-2xl px-4 py-16">
        <p class="text-center kicker">Almost yours</p>
        <h1 class="mt-2 text-center text-4xl font-bold tracking-tight text-highlighted sm:text-5xl">Checkout</h1>

        <EmptyState v-if="props.cart.items.length === 0" icon="i-lucide-shopping-cart" title="Your bag is empty" description="Add something to your cart before checking out." class="mt-12">
          <EditorialButton to="/" variant="outline" color="neutral">Continue shopping</EditorialButton>
        </EmptyState>

        <template v-else>
          <!-- Numbered story steps (not a stepper component) -->
          <div class="mt-10 flex items-center justify-center gap-3 text-xs font-semibold">
            <span :class="props.step === 'address' ? 'text-highlighted' : 'text-muted'">01 — Address</span>
            <Icon name="i-lucide-chevron-right" class="size-3 text-muted" />
            <span :class="props.step === 'review' ? 'text-highlighted' : 'text-muted'">02 — Review</span>
            <Icon name="i-lucide-chevron-right" class="size-3 text-muted" />
            <span :class="props.step === 'otp' ? 'text-highlighted' : 'text-muted'">03 — Verify</span>
          </div>

          <!-- Step 1: address -->
          <form v-if="props.step === 'address'" class="mt-10 space-y-5" @submit.prevent="submitAddress">
            <div>
              <label class="mb-1.5 block text-sm font-semibold text-highlighted">Phone</label>
              <EditorialInput v-model="props.form.phone" type="tel" placeholder="+15551234567" class="w-full" />
              <p v-if="fieldErrors['phone']" class="mt-1 text-sm text-error">{{ fieldErrors['phone'] }}</p>
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-semibold text-highlighted">Name (optional)</label>
              <EditorialInput v-model="props.form.name" class="w-full" />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-semibold text-highlighted">Address line 1</label>
              <EditorialInput v-model="props.form.address.line1" class="w-full" />
              <p v-if="fieldErrors['address.line1']" class="mt-1 text-sm text-error">{{ fieldErrors['address.line1'] }}</p>
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-semibold text-highlighted">Address line 2 (optional)</label>
              <EditorialInput v-model="props.form.address.line2" class="w-full" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="mb-1.5 block text-sm font-semibold text-highlighted">City</label>
                <EditorialInput v-model="props.form.address.city" class="w-full" />
                <p v-if="fieldErrors['address.city']" class="mt-1 text-sm text-error">{{ fieldErrors['address.city'] }}</p>
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-semibold text-highlighted">Region / State</label>
                <EditorialInput v-model="props.form.address.region" class="w-full" />
                <p v-if="fieldErrors['address.region']" class="mt-1 text-sm text-error">{{ fieldErrors['address.region'] }}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="mb-1.5 block text-sm font-semibold text-highlighted">Postal code</label>
                <EditorialInput v-model="props.form.address.postalCode" class="w-full" />
                <p v-if="fieldErrors['address.postalCode']" class="mt-1 text-sm text-error">{{ fieldErrors['address.postalCode'] }}</p>
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-semibold text-highlighted">Country</label>
                <EditorialInput v-model="props.form.address.country" :maxlength="2" class="w-full uppercase" />
                <p v-if="fieldErrors['address.country']" class="mt-1 text-sm text-error">{{ fieldErrors['address.country'] }}</p>
              </div>
            </div>
            <EditorialButton type="submit" block size="lg" class="!bg-highlighted !text-inverted">Continue to review</EditorialButton>
          </form>

          <!-- Step 2: review -->
          <div v-else-if="props.step === 'review'" class="mt-10 space-y-8">
            <div>
              <h2 class="text-xs font-semibold text-muted">The order</h2>
              <ul class="mt-3 divide-y divide-default">
                <li v-for="item in props.cart.items" :key="item.productId" class="flex justify-between py-3">
                  <span class="font-medium">{{ item.name }} × {{ item.quantity }}</span>
                  <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="font-bold" />
                </li>
              </ul>
            </div>
            <div>
              <h2 class="text-xs font-semibold text-muted">Deliver to</h2>
              <p class="mt-3">{{ props.form.name || props.form.phone }}</p>
              <p>{{ props.form.address.line1 }}<template v-if="props.form.address.line2">, {{ props.form.address.line2 }}</template></p>
              <p>{{ props.form.address.city }}, {{ props.form.address.region }} {{ props.form.address.postalCode }}</p>
              <p>{{ props.form.address.country }}</p>
              <p>{{ props.form.phone }}</p>
            </div>
            <div class="flex items-center justify-between border-t-2 border-highlighted pt-4">
              <span class="text-sm font-semibold text-muted">Cash due</span>
              <PriceDisplay :amount-cents="props.cart.totalCents" class="text-2xl font-bold" />
            </div>
            <EditorialAlert v-if="props.placeError" color="error" :description="props.placeError" />
            <div class="flex gap-3">
              <EditorialButton variant="outline" color="neutral" @click="props.onBack">Back</EditorialButton>
              <EditorialButton block size="lg" :loading="props.placing" class="flex-1 !bg-highlighted !text-inverted" @click="props.onPlaceOrder">Place order</EditorialButton>
            </div>
          </div>

          <!-- Step 3: OTP -->
          <div v-else-if="props.step === 'otp'" class="mt-10 space-y-6 text-center">
            <p class="text-muted">We sent a 6-digit code to <span class="font-semibold text-highlighted">{{ props.form.phone }}</span>. Enter it to confirm.</p>
            <EditorialPinInput :model-value="props.otpCode" :length="6" @update:model-value="(v: string[]) => (props.otpCode as string[]).splice(0, props.otpCode.length, ...v)" />
            <EditorialAlert v-if="props.otpError" color="error" :description="props.otpError" />
            <EditorialButton block size="lg" :loading="props.verifying" :disabled="props.otpCodeString.length !== 6" class="!bg-highlighted !text-inverted" @click="props.onVerifyCode">Confirm order</EditorialButton>
            <EditorialButton variant="link" color="neutral" :disabled="props.resendCooldown > 0" @click="props.onResendCode">
              {{ props.resendCooldown > 0 ? `Resend in ${props.resendCooldown}s` : 'Resend code' }}
            </EditorialButton>
          </div>
        </template>
      </div>
    </div>

    <template #fallback>
      <div class="py-24 text-center text-muted">Loading…</div>
    </template>
  </ClientOnly>
</template>
