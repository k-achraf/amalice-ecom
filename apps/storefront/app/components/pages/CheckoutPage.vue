<script setup lang="ts">
import type { ZodTypeAny } from 'zod'
import type { CartItem } from '~/stores/cart'

// Minimal (fallback) checkout presentation — vertical stepper, single-column
// form. The OTP flow + timers live in the page shell; this receives the
// reactive state + handlers and renders the 3 steps. No @nuxt/ui: address
// validation runs the passed Zod schema directly on submit.
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
  <ClientOnly>
    <main class="mx-auto max-w-2xl space-y-8 p-6">
      <h1 class="text-2xl font-semibold">Checkout</h1>

      <EmptyState
        v-if="props.cart.items.length === 0"
        icon="i-lucide-shopping-cart"
        title="Your cart is empty"
        description="Add something to your cart before checking out."
      >
        <Button to="/" variant="outline" color="neutral">Continue shopping</Button>
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
            <label class="block text-sm font-medium text-highlighted">Phone</label>
            <Input v-model="props.form.phone" type="tel" placeholder="+15551234567" class="w-full" />
            <p class="text-xs text-muted">E.164 format, e.g. +15551234567</p>
            <p v-if="fieldErrors['phone']" class="text-sm text-error">{{ fieldErrors['phone'] }}</p>
          </div>
          <div class="space-y-1">
            <label class="block text-sm font-medium text-highlighted">Name (optional)</label>
            <Input v-model="props.form.name" class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="block text-sm font-medium text-highlighted">Address line 1</label>
            <Input v-model="props.form.address.line1" class="w-full" />
            <p v-if="fieldErrors['address.line1']" class="text-sm text-error">{{ fieldErrors['address.line1'] }}</p>
          </div>
          <div class="space-y-1">
            <label class="block text-sm font-medium text-highlighted">Address line 2 (optional)</label>
            <Input v-model="props.form.address.line2" class="w-full" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="block text-sm font-medium text-highlighted">City</label>
              <Input v-model="props.form.address.city" class="w-full" />
              <p v-if="fieldErrors['address.city']" class="text-sm text-error">{{ fieldErrors['address.city'] }}</p>
            </div>
            <div class="space-y-1">
              <label class="block text-sm font-medium text-highlighted">Region / State</label>
              <Input v-model="props.form.address.region" class="w-full" />
              <p v-if="fieldErrors['address.region']" class="text-sm text-error">{{ fieldErrors['address.region'] }}</p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="block text-sm font-medium text-highlighted">Postal code</label>
              <Input v-model="props.form.address.postalCode" class="w-full" />
              <p v-if="fieldErrors['address.postalCode']" class="text-sm text-error">{{ fieldErrors['address.postalCode'] }}</p>
            </div>
            <div class="space-y-1">
              <label class="block text-sm font-medium text-highlighted">Country</label>
              <Input v-model="props.form.address.country" :maxlength="2" class="w-full uppercase" />
              <p class="text-xs text-muted">2-letter code, e.g. US</p>
              <p v-if="fieldErrors['address.country']" class="text-sm text-error">{{ fieldErrors['address.country'] }}</p>
            </div>
          </div>
          <Button type="submit" block size="lg">Continue to review</Button>
        </form>

        <!-- Step 2: review -->
        <div v-else-if="props.step === 'review'" class="space-y-6">
          <div class="space-y-2">
            <h2 class="font-medium text-highlighted">Items</h2>
            <ul class="divide-y divide-default">
              <li v-for="item in props.cart.items" :key="item.productId" class="flex justify-between py-2 text-sm">
                <span>{{ item.name }} × {{ item.quantity }}</span>
                <PriceDisplay :amount-cents="item.priceCents * item.quantity" />
              </li>
            </ul>
          </div>
          <div class="space-y-1 text-sm">
            <h2 class="font-medium text-highlighted">Deliver to</h2>
            <p>{{ props.form.name || props.form.phone }}</p>
            <p>{{ props.form.address.line1 }}<template v-if="props.form.address.line2">, {{ props.form.address.line2 }}</template></p>
            <p>{{ props.form.address.city }}, {{ props.form.address.region }} {{ props.form.address.postalCode }}</p>
            <p>{{ props.form.address.country }}</p>
            <p>{{ props.form.phone }}</p>
          </div>
          <div class="flex items-center justify-between border-t border-default pt-4">
            <span class="font-medium">Cash due on delivery</span>
            <PriceDisplay :amount-cents="props.cart.totalCents" class="text-lg font-semibold" />
          </div>
          <Alert v-if="props.placeError" color="error" :description="props.placeError" />
          <div class="flex gap-3">
            <Button variant="outline" color="neutral" @click="props.onBack">Back</Button>
            <Button block size="lg" :loading="props.placing" @click="props.onPlaceOrder">Place order</Button>
          </div>
        </div>

        <!-- Step 3: OTP -->
        <div v-else-if="props.step === 'otp'" class="space-y-6">
          <p class="text-sm text-muted">
            We sent a 6-digit code to {{ props.form.phone }}. Enter it below to confirm your order.
          </p>
          <PinInput :model-value="props.otpCode" :length="6" @update:model-value="(v: string[]) => (props.otpCode as string[]).splice(0, props.otpCode.length, ...v)" />
          <Alert v-if="props.otpError" color="error" :description="props.otpError" />
          <Button block size="lg" :loading="props.verifying" :disabled="props.otpCodeString.length !== 6" @click="props.onVerifyCode">Confirm order</Button>
          <Button variant="link" color="neutral" :disabled="props.resendCooldown > 0" @click="props.onResendCode">
            {{ props.resendCooldown > 0 ? `Resend code in ${props.resendCooldown}s` : 'Resend code' }}
          </Button>
        </div>
      </template>
    </main>

    <template #fallback>
      <div class="py-24 text-center text-muted">Loading…</div>
    </template>
  </ClientOnly>
</template>
