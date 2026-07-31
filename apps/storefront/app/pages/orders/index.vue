<script setup lang="ts">
import type { OrderState } from '@amalice/shared'

useSeoMeta({ title: 'طلباتي' })

const apiClient = useApiClient()

type Phase = 'phone' | 'list'
const phase = ref<Phase>('phone')

const phone = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

interface HistoryOrder {
  id: string
  state: OrderState
  totalCents: number
  createdAt: string
  items: { productId: string; quantity: number; unitPriceCents: number }[]
}
const orders = ref<HistoryOrder[]>([])

async function loadHistory() {
  loading.value = true
  error.value = null
  try {
    orders.value = await apiClient<HistoryOrder[]>('/orders/history', {
      query: { phone: phone.value }
    })
    phase.value = 'list'
  } catch (err) {
    error.value = extractError(err)
  } finally {
    loading.value = false
  }
}

function extractError(err: unknown): string {
  const data = (err as { data?: { message?: string } })?.data
  return data?.message ?? 'حدث خطأ. حاول مرة أخرى.'
}
</script>

<template>
  <main class="mx-auto max-w-2xl space-y-6 p-6">
    <h1 class="text-2xl font-semibold">طلباتي</h1>

    <!-- See track.vue for why this is ClientOnly: a form field filled just
    before hydration finishes gets silently reverted by Vue's hydration
    reconciliation otherwise — a real bug caught in testing, not just
    mismatch-avoidance boilerplate. -->
    <ClientOnly>
      <form v-if="phase === 'phone'" class="space-y-4" @submit.prevent="loadHistory">
        <p class="text-sm text-neutral-500">
          أدخل رقم هاتفك لعرض طلباتك السابقة — لا حاجة لحساب أو كلمة مرور.
        </p>
        <UFormField label="رقم الهاتف" name="phone">
          <UInput v-model="phone" type="tel" class="w-full" placeholder="+15551234567" />
        </UFormField>
        <UAlert v-if="error" color="error" variant="subtle" :description="error" />
        <UButton type="submit" block size="lg" :loading="loading" :disabled="!phone">عرض طلباتي</UButton>
      </form>

      <div v-else class="space-y-4">
        <EmptyState
          v-if="orders.length === 0"
          icon="i-lucide-package"
          title="لا توجد طلبات بعد"
          description="ستظهر هنا الطلبات المسجّلة بهذا رقم الهاتف."
        >
          <UButton to="/" variant="outline" color="neutral">متابعة التسوق</UButton>
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
              <span>{{ order.items.length }} منتج</span>
              <PriceDisplay :amount-cents="order.totalCents" class="font-medium" />
            </div>
          </li>
        </ul>
      </div>
    </ClientOnly>
  </main>
</template>
