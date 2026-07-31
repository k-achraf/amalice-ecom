<script setup lang="ts">
import type { OrderState } from '@amalice/shared'

useSeoMeta({ title: 'تتبع الطلب' })

const apiClient = useApiClient()
const route = useRoute()

const orderId = ref((route.query.id as string) ?? '')
const phone = ref((route.query.phone as string) ?? '')
const loading = ref(false)
const error = ref<string | null>(null)

interface TrackingInfo {
  id: string
  state: OrderState
  totalCents: number
  createdAt: string
  trackingReference: string | null
}
const result = ref<TrackingInfo | null>(null)

async function lookup() {
  loading.value = true
  error.value = null
  result.value = null
  try {
    result.value = await apiClient<TrackingInfo>(`/orders/${orderId.value}/track`, {
      query: { phone: phone.value }
    })
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    error.value = data?.message ?? 'تعذر العثور على هذا الطلب. تحقق من رقم الطلب ورقم الهاتف.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="mx-auto max-w-lg space-y-6 p-6">
    <div>
      <h1 class="text-2xl font-semibold">تتبع طلبك</h1>
      <p class="text-sm text-neutral-500">
        أدخل رقم طلبك ورقم الهاتف الذي استخدمته عند إتمام الطلب.
      </p>
    </div>

    <!--
      ClientOnly, not just for hydration-mismatch avoidance (there's nothing
      to mismatch here) but because a real bug was caught without it: a form
      field filled in the narrow window before hydration finishes gets
      silently wiped back to its initial empty value when Vue's hydration
      pass reconciles against the still-empty server-rendered state. Nothing
      here has SEO value server-rendered anyway, so deferring the whole form
      to client-mount removes the race outright instead of just narrowing it.
    -->
    <ClientOnly>
      <form class="space-y-4" @submit.prevent="lookup">
        <UFormField label="رقم الطلب" name="orderId">
          <UInput v-model="orderId" class="w-full font-mono" placeholder="مثال: 2ffdcd31-..." />
        </UFormField>
        <UFormField label="رقم الهاتف" name="phone">
          <UInput v-model="phone" type="tel" class="w-full" placeholder="+15551234567" />
        </UFormField>
        <UButton type="submit" block size="lg" :loading="loading" :disabled="!orderId || !phone">
          تتبع الطلب
        </UButton>
      </form>

      <UAlert v-if="error" color="error" variant="subtle" :description="error" class="mt-4" />

      <div v-if="result" class="mt-4 space-y-4 rounded-md border border-default p-4">
        <div class="flex items-center justify-between">
          <span class="tabular text-sm text-neutral-500">{{ result.id }}</span>
          <StatusBadge :state="result.state" />
        </div>
        <div class="flex items-center justify-between text-sm">
          <span>المجموع المستحق عند الاستلام</span>
          <PriceDisplay :amount-cents="result.totalCents" class="font-medium" />
        </div>
        <p v-if="result.trackingReference" class="text-sm">
          رقم تتبع المندوب:
          <span class="tabular font-medium">{{ result.trackingReference }}</span>
        </p>
        <p v-else class="text-sm text-neutral-500">
          لا يوجد رقم تتبع بعد — سيظهر بمجرد تسليم الطلب إلى مندوب التوصيل.
        </p>
      </div>
    </ClientOnly>
  </main>
</template>
