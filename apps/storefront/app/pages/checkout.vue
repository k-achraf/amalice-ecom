<script setup lang="ts">
import { CheckoutSchema } from '@amalice/shared'

// If displayCart is false (lead-form mode), there is no checkout page — redirect.
const settings = useStoreSettings()
if (!settings.value.displayCart) {
  await navigateTo('/')
}

// LOGIC ONLY — the full 3-step COD + OTP flow stays here. Presentation via
// <TemplatePage name="Checkout">. The OTP timer, sessionStorage handoff, and
// order placement are single-sourced; templates can't drift checkout behavior.
useSeoMeta({ title: 'Checkout' })

const cart = useCartStore()
const apiClient = useApiClient()
const router = useRouter()

type Step = 'address' | 'review' | 'otp'
const step = ref<Step>('address')
const stepItems = [
  { value: 'address', title: 'Address', icon: 'i-lucide-map-pin' },
  { value: 'review', title: 'Review', icon: 'i-lucide-clipboard-list' },
  { value: 'otp', title: 'Verify', icon: 'i-lucide-shield-check' }
]

const AddressStepSchema = CheckoutSchema.omit({ items: true })
const form = reactive({
  phone: '',
  name: '',
  address: { line1: '', line2: '', city: '', region: '', postalCode: '', country: '' }
})

function onAddressSubmit() {
  step.value = 'review'
}

const placing = ref(false)
const placeError = ref<string | null>(null)
const order = ref<{ id: string; totalCents: number } | null>(null)

async function placeOrder() {
  placing.value = true
  placeError.value = null
  try {
    const created = await apiClient<{ id: string; totalCents: number }>('/orders', {
      method: 'POST',
      body: {
        phone: form.phone,
        name: form.name || undefined,
        address: { ...form.address, line2: form.address.line2 || undefined },
        items: cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
      }
    })
    order.value = created
    step.value = 'otp'
    startCooldown()
  } catch (err) {
    placeError.value = extractErrorMessage(err)
  } finally {
    placing.value = false
  }
}

function extractErrorMessage(err: unknown): string {
  const data = (err as { data?: { message?: string } })?.data
  return data?.message ?? 'Something went wrong. Please try again.'
}

const otpCode = ref<string[]>([])
const otpCodeString = computed(() => otpCode.value.join(''))
const otpError = ref<string | null>(null)
const verifying = ref(false)
const resendCooldown = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | undefined

function startCooldown() {
  resendCooldown.value = 60
  clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    if (resendCooldown.value <= 1) {
      clearInterval(cooldownTimer)
      resendCooldown.value = 0
    } else {
      resendCooldown.value -= 1
    }
  }, 1000)
}

onUnmounted(() => clearInterval(cooldownTimer))

async function resendCode() {
  if (resendCooldown.value > 0) return
  otpError.value = null
  try {
    await apiClient('/auth/otp/request', { method: 'POST', body: { phone: form.phone } })
    startCooldown()
  } catch (err) {
    otpError.value = extractErrorMessage(err)
  }
}

interface ConfirmedOrderItem {
  productId: string
  quantity: number
  unitPriceCents: number
}
interface ConfirmedOrder {
  id: string
  totalCents: number
  state: string
  createdAt: string
  items: ConfirmedOrderItem[]
}

async function verifyCode() {
  if (!order.value) return
  verifying.value = true
  otpError.value = null
  try {
    const result = await apiClient<{ order: ConfirmedOrder }>(`/orders/${order.value.id}/confirm`, {
      method: 'POST',
      body: { code: otpCodeString.value }
    })
    const nameByProductId = new Map(cart.items.map((i) => [i.productId, i.name]))
    const enriched = {
      ...result.order,
      items: result.order.items.map((i) => ({ ...i, name: nameByProductId.get(i.productId) ?? 'Item' }))
    }
    sessionStorage.setItem(`amalice.order.${order.value.id}`, JSON.stringify(enriched))
    cart.clear()
    await router.push(`/orders/${order.value.id}/confirmation`)
  } catch (err) {
    otpError.value = extractErrorMessage(err)
    otpCode.value = []
  } finally {
    verifying.value = false
  }
}

function onBack() {
  step.value = 'address'
}
</script>

<template>
  <TemplatePage
    name="Checkout"
    :page-props="{
      cart,
      step,
      stepItems,
      form,
      addressSchema: AddressStepSchema,
      placing: placing ?? false,
      placeError,
      order,
      otpCode,
      otpCodeString,
      otpError,
      verifying: verifying ?? false,
      resendCooldown: resendCooldown ?? 0,
      onAddressSubmit,
      onPlaceOrder: placeOrder,
      onVerifyCode: verifyCode,
      onResendCode: resendCode,
      onBack
    }"
  />
</template>
