// Shared order-placement + OTP-verification logic — used by both the cart
// checkout page and the PDP lead form (when displayCart is false). The flow:
//   1. placeOrder(phone, name, address, items) → POST /orders → gets orderId
//   2. OTP step: the API auto-sends an OTP on order creation; user enters code
//   3. verifyCode(orderId, code) → POST /orders/:id/confirm → order confirmed
//   4. On success → navigate to /orders/:id/confirmation
//
// Extracted from checkout.vue so the lead form reuses the exact same logic
// without duplication. Both callers just pass different `items` arrays.

export interface OrderItem {
  productId: string
  quantity: number
}

interface PlaceOrderInput {
  phone: string
  name?: string
  address: {
    line1: string
    line2?: string
    city: string
    region: string
    postalCode: string
    country: string
  }
  items: OrderItem[]
}

interface ConfirmedOrderItem {
  productId: string
  quantity: number
  unitPriceCents: number
  name?: string
}

export function useOrderPlacement() {
  const apiClient = useApiClient()
  const router = useRouter()

  const order = ref<{ id: string; totalCents: number } | null>(null)
  const placing = ref(false)
  const placeError = ref<string | null>(null)

  const otpCode = ref<string[]>([])
  const otpCodeString = computed(() => otpCode.value.join(''))
  const otpError = ref<string | null>(null)
  const verifying = ref(false)
  const resendCooldown = ref(0)
  let cooldownTimer: ReturnType<typeof setInterval> | undefined

  function extractErrorMessage(err: unknown): string {
    const data = (err as { data?: { message?: string } })?.data
    return data?.message ?? 'Something went wrong. Please try again.'
  }

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

  async function placeOrder(input: PlaceOrderInput) {
    placing.value = true
    placeError.value = null
    try {
      const created = await apiClient<{ id: string; totalCents: number }>('/orders', {
        method: 'POST',
        body: {
          phone: input.phone,
          name: input.name || undefined,
          address: { ...input.address, line2: input.address.line2 || undefined },
          items: input.items
        }
      })
      order.value = created
      startCooldown()
      return created
    } catch (err) {
      placeError.value = extractErrorMessage(err)
      throw err
    } finally {
      placing.value = false
    }
  }

  async function resendCode(phone: string) {
    if (resendCooldown.value > 0) return
    otpError.value = null
    try {
      await apiClient('/auth/otp/request', { method: 'POST', body: { phone } })
      startCooldown()
    } catch (err) {
      otpError.value = extractErrorMessage(err)
    }
  }

  async function verifyCode(itemNames?: Map<string, string>) {
    if (!order.value) return
    verifying.value = true
    otpError.value = null
    try {
      const result = await apiClient<{ order: { id: string; totalCents: number; state: string; createdAt: string; items: ConfirmedOrderItem[] } }>(
        `/orders/${order.value.id}/confirm`,
        { method: 'POST', body: { code: otpCodeString.value } }
      )
      // Enrich items with names if provided (from cart or PDP context).
      const enriched = {
        ...result.order,
        items: result.order.items.map((i) => ({
          ...i,
          name: itemNames?.get(i.productId) ?? 'Item'
        }))
      }
      sessionStorage.setItem(`amalice.order.${order.value.id}`, JSON.stringify(enriched))
      await router.push(`/orders/${order.value.id}/confirmation`)
    } catch (err) {
      otpError.value = extractErrorMessage(err)
      otpCode.value = []
    } finally {
      verifying.value = false
    }
  }

  onUnmounted(() => clearInterval(cooldownTimer))

  return {
    order,
    placing,
    placeError,
    otpCode,
    otpCodeString,
    otpError,
    verifying,
    resendCooldown,
    placeOrder,
    resendCode,
    verifyCode
  }
}
