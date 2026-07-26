<script setup lang="ts">
import type { OrderState } from '@amalice/shared'

useSeoMeta({ title: 'My orders' })

const apiClient = useApiClient()

type Phase = 'phone' | 'code' | 'list'
const phase = ref<Phase>('phone')

const phone = ref('')
const code = ref<string[]>([])
const codeString = computed(() => code.value.join(''))
const error = ref<string | null>(null)
const loading = ref(false)
const token = ref<string | null>(null)

interface HistoryOrder {
  id: string
  state: OrderState
  totalCents: number
  createdAt: string
  items: { productId: string; quantity: number; unitPriceCents: number }[]
}
const orders = ref<HistoryOrder[]>([])

async function requestCode() {
  loading.value = true
  error.value = null
  try {
    await apiClient('/auth/otp/request', { method: 'POST', body: { phone: phone.value } })
    phase.value = 'code'
  } catch (err) {
    error.value = extractError(err)
  } finally {
    loading.value = false
  }
}

async function verifyAndLoad() {
  loading.value = true
  error.value = null
  try {
    const verified = await apiClient<{ token: string }>('/auth/otp/verify', {
      method: 'POST',
      body: { phone: phone.value, code: codeString.value }
    })
    token.value = verified.token
    orders.value = await apiClient<HistoryOrder[]>('/orders/history', {
      headers: { Authorization: `Bearer ${verified.token}` }
    })
    phase.value = 'list'
  } catch (err) {
    error.value = extractError(err)
    code.value = []
  } finally {
    loading.value = false
  }
}

function extractError(err: unknown): string {
  const data = (err as { data?: { message?: string } })?.data
  return data?.message ?? 'Something went wrong. Please try again.'
}
</script>

<template>
  <main class="mx-auto max-w-2xl space-y-6 p-6">
    <h1 class="text-2xl font-semibold">My orders</h1>

    <!-- See track.vue for why this is ClientOnly: a form field filled just
    before hydration finishes gets silently reverted by Vue's hydration
    reconciliation otherwise — a real bug caught in testing, not just
    mismatch-avoidance boilerplate. -->
    <ClientOnly>
      <form v-if="phase === 'phone'" class="space-y-4" @submit.prevent="requestCode">
        <p class="text-sm text-neutral-500">
          Verify your phone number to see your past orders — no account or password needed.
        </p>
        <UFormField label="Phone" name="phone">
          <UInput v-model="phone" type="tel" class="w-full" placeholder="+15551234567" />
        </UFormField>
        <UAlert v-if="error" color="error" variant="subtle" :description="error" />
        <UButton type="submit" block size="lg" :loading="loading" :disabled="!phone"
          >Send code</UButton
        >
      </form>

      <div v-else-if="phase === 'code'" class="space-y-4">
        <p class="text-sm text-neutral-500">Enter the 6-digit code sent to {{ phone }}.</p>
        <UPinInput v-model="code" :length="6" otp />
        <UAlert v-if="error" color="error" variant="subtle" :description="error" />
        <UButton
          block
          size="lg"
          :loading="loading"
          :disabled="codeString.length !== 6"
          @click="verifyAndLoad"
        >
          Verify
        </UButton>
      </div>

      <div v-else class="space-y-4">
        <EmptyState
          v-if="orders.length === 0"
          icon="i-lucide-package"
          title="No orders yet"
          description="Orders placed with this phone number will show up here."
        >
          <UButton to="/" variant="outline" color="neutral">Continue shopping</UButton>
        </EmptyState>

        <ul v-else class="space-y-3">
          <li
            v-for="order in orders"
            :key="order.id"
            class="space-y-2 rounded-md border border-default p-4"
          >
            <div class="flex items-center justify-between">
              <span class="tabular text-sm text-neutral-500">{{ order.id }}</span>
              <StatusBadge :state="order.state" />
            </div>
            <div class="flex items-center justify-between text-sm">
              <span>{{ order.items.length }} item(s)</span>
              <PriceDisplay :amount-cents="order.totalCents" class="font-medium" />
            </div>
          </li>
        </ul>
      </div>
    </ClientOnly>
  </main>
</template>
