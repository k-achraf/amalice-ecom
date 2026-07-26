<script setup lang="ts">
import type { ZodTypeAny } from 'zod'
import type { CartItem } from '~/stores/cart'

// Boutique checkout — a narrow, single-column ceremony (max-w-xl). Every
// label is uppercase tracking-widest, fields are the underlined convention,
// vertical rhythm is generous. The 3 steps (address, review, otp) render
// under a refined dot/line stepper. No @nuxt/ui: address validation runs
// the passed Zod schema directly on submit. Wrapped in ClientOnly — the OTP
// flow is client-side.
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
  <ClientOnly>
    <main class="bg-default">
      <!-- Eyebrow header -->
      <header class="mx-auto max-w-xl px-6 pt-24 text-center sm:pt-32">
        <p class="text-xs uppercase tracking-[0.4em] text-muted">Almost yours</p>
        <h1 class="mt-6 text-3xl font-light tracking-tight text-highlighted sm:text-4xl">Checkout</h1>
        <div class="mx-auto mt-8 h-px w-12 bg-default" />
      </header>

      <section class="mx-auto max-w-xl px-6 py-20 sm:py-24">
        <EmptyState
          v-if="props.cart.items.length === 0"
          icon="i-lucide-shopping-bag"
          title="Your bag is empty"
          description="Add something before checking out."
        >
          <BoutiqueButton to="/" variant="outline" color="neutral" class="mt-6">
            Continue shopping
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
              <span class="text-xs uppercase tracking-[0.3em] text-muted">Phone</span>
              <BoutiqueInput v-model="props.form.phone" type="tel" placeholder="+1 555 123 4567" class="mt-2 w-full" />
              <p class="mt-1.5 text-[11px] uppercase tracking-widest text-muted">E.164</p>
              <p v-if="fieldErrors['phone']" class="mt-1 text-xs text-error">{{ fieldErrors['phone'] }}</p>
            </div>

            <div>
              <span class="text-xs uppercase tracking-[0.3em] text-muted">Name (optional)</span>
              <BoutiqueInput v-model="props.form.name" class="mt-2 w-full" />
            </div>

            <div>
              <span class="text-xs uppercase tracking-[0.3em] text-muted">Address line 1</span>
              <BoutiqueInput v-model="props.form.address.line1" class="mt-2 w-full" />
              <p v-if="fieldErrors['address.line1']" class="mt-1 text-xs text-error">{{ fieldErrors['address.line1'] }}</p>
            </div>

            <div>
              <span class="text-xs uppercase tracking-[0.3em] text-muted">Address line 2 (optional)</span>
              <BoutiqueInput v-model="props.form.address.line2" class="mt-2 w-full" />
            </div>

            <div class="grid grid-cols-2 gap-6">
              <div>
                <span class="text-xs uppercase tracking-[0.3em] text-muted">City</span>
                <BoutiqueInput v-model="props.form.address.city" class="mt-2 w-full" />
                <p v-if="fieldErrors['address.city']" class="mt-1 text-xs text-error">{{ fieldErrors['address.city'] }}</p>
              </div>
              <div>
                <span class="text-xs uppercase tracking-[0.3em] text-muted">Region</span>
                <BoutiqueInput v-model="props.form.address.region" class="mt-2 w-full" />
                <p v-if="fieldErrors['address.region']" class="mt-1 text-xs text-error">{{ fieldErrors['address.region'] }}</p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-6">
              <div>
                <span class="text-xs uppercase tracking-[0.3em] text-muted">Postal code</span>
                <BoutiqueInput v-model="props.form.address.postalCode" class="mt-2 w-full" />
                <p v-if="fieldErrors['address.postalCode']" class="mt-1 text-xs text-error">{{ fieldErrors['address.postalCode'] }}</p>
              </div>
              <div>
                <span class="text-xs uppercase tracking-[0.3em] text-muted">Country</span>
                <BoutiqueInput v-model="props.form.address.country" :maxlength="2" class="mt-2 w-full uppercase" />
                <p v-if="fieldErrors['address.country']" class="mt-1 text-xs text-error">{{ fieldErrors['address.country'] }}</p>
              </div>
            </div>

            <BoutiqueButton type="submit" block size="lg" color="neutral" variant="outline" class="!border-2">
              Continue to review
            </BoutiqueButton>
          </form>

          <!-- Step 2: review -->
          <div v-else-if="props.step === 'review'" class="space-y-12">
            <div>
              <p class="mb-6 text-xs uppercase tracking-[0.4em] text-muted">Items</p>
              <ul class="space-y-4">
                <li v-for="item in props.cart.items" :key="item.productId" class="flex justify-between text-sm font-light">
                  <span class="text-highlighted">{{ item.name }} <span class="text-muted">× {{ item.quantity }}</span></span>
                  <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="text-highlighted" />
                </li>
              </ul>
            </div>

            <div>
              <p class="mb-6 text-xs uppercase tracking-[0.4em] text-muted">Deliver to</p>
              <div class="space-y-1 text-sm font-light text-muted">
                <p class="text-highlighted">{{ props.form.name || props.form.phone }}</p>
                <p>{{ props.form.address.line1 }}<template v-if="props.form.address.line2">, {{ props.form.address.line2 }}</template></p>
                <p>{{ props.form.address.city }}, {{ props.form.address.region }} {{ props.form.address.postalCode }}</p>
                <p>{{ props.form.address.country }}</p>
                <p>{{ props.form.phone }}</p>
              </div>
            </div>

            <div class="flex items-baseline justify-between border-t border-default pt-8">
              <span class="text-xs uppercase tracking-[0.4em] text-muted">Cash due on delivery</span>
              <PriceDisplay :amount-cents="props.cart.totalCents" class="price-accent text-2xl font-light tracking-tight" />
            </div>

            <BoutiqueAlert v-if="props.placeError" color="error" :description="props.placeError" />

            <div class="flex gap-4">
              <BoutiqueButton variant="ghost" color="neutral" @click="props.onBack">Back</BoutiqueButton>
              <BoutiqueButton block size="lg" color="neutral" variant="outline" :loading="props.placing" class="flex-1 !border-2" @click="props.onPlaceOrder">
                Place order
              </BoutiqueButton>
            </div>
          </div>

          <!-- Step 3: OTP -->
          <div v-else-if="props.step === 'otp'" class="space-y-10 text-center">
            <p class="mx-auto max-w-sm text-sm font-light leading-relaxed text-muted">
              We sent a six-digit code to {{ props.form.phone }}. Enter it below to confirm your order.
            </p>
            <BoutiquePinInput :model-value="props.otpCode" :length="6" @update:model-value="(v: string[]) => (props.otpCode as string[]).splice(0, props.otpCode.length, ...v)" />
            <BoutiqueAlert v-if="props.otpError" color="error" :description="props.otpError" />
            <BoutiqueButton block size="lg" color="neutral" variant="outline" :loading="props.verifying" :disabled="props.otpCodeString.length !== 6" class="!border-2" @click="props.onVerifyCode">
              Confirm order
            </BoutiqueButton>
            <BoutiqueButton variant="link" color="neutral" :disabled="props.resendCooldown > 0" @click="props.onResendCode">
              {{ props.resendCooldown > 0 ? `Resend in ${props.resendCooldown}s` : 'Resend code' }}
            </BoutiqueButton>
          </div>
        </template>
      </section>
    </main>

    <template #fallback>
      <div class="py-32 text-center text-xs uppercase tracking-[0.3em] text-muted">Loading…</div>
    </template>
  </ClientOnly>
</template>
