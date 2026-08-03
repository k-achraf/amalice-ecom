<script setup lang="ts">
import type { OrderListResponse } from '@amalice/shared'

// Stage 1 of the order pipeline: a human agent calls the customer to confirm
// a real order before anything gets picked. Two queues, same as
// fulfillment/index.vue's "packed vs in transit" split — the main queue
// (never called yet / awaiting a call) and the retry queue (called, no
// answer, needs a follow-up attempt).
definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager', 'Support'] })
useHead({ title: 'Call Center' })

const api = useAdminApi()
const { run } = useApiAction()

const { data: pendingQueue, pending, refresh: refreshPending } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?state=PendingCallCenter&pageSize=50',
  { key: 'admin-call-center-pending' }
)
const { data: noAnswerQueue, refresh: refreshNoAnswer } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?state=CallCenterNoAnswer&pageSize=50',
  { key: 'admin-call-center-no-answer' }
)
// Wrong number / postponed — two more call-center outcomes that aren't
// "no answer" (see OrderState's Prisma comment): a bad number needs a
// corrected number before retrying, not just another call; a postponed
// customer asked to be contacted later, so it shouldn't get swept back
// into the main retry queue immediately.
const { data: wrongNumberQueue, refresh: refreshWrongNumber } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?state=WrongNumber&pageSize=50',
  { key: 'admin-call-center-wrong-number' }
)
const { data: postponedQueue, refresh: refreshPostponed } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?state=Postponed&pageSize=50',
  { key: 'admin-call-center-postponed' }
)

const acting = ref<string | null>(null)
const actionLabel: Record<string, string> = {
  Confirmed: 'Order confirmed',
  CallCenterNoAnswer: 'Marked as no answer',
  WrongNumber: 'Marked as wrong number',
  Postponed: 'Order postponed',
  PendingCallCenter: 'Moved back to the call queue',
  Cancelled: 'Order cancelled'
}
async function act(orderId: string, to: 'Confirmed' | 'CallCenterNoAnswer' | 'WrongNumber' | 'Postponed' | 'PendingCallCenter' | 'Cancelled') {
  acting.value = `${orderId}:${to}`
  await run(() => api(`/admin/orders/${orderId}/transition`, { method: 'POST', body: { to } }), {
    success: actionLabel[to],
    errorFallback: 'Could not update the order'
  })
  await Promise.all([refreshPending(), refreshNoAnswer(), refreshWrongNumber(), refreshPostponed()])
  acting.value = null
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString()
}

function addressLine(o: { address: { line1: string; city: string; region: string } }) {
  return `${o.address.line1}, ${o.address.city}, ${o.address.region}`
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Call Center">
        <template #leading><UDashboardSidebarCollapse /></template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="space-y-8">
        <!-- Awaiting a confirmation call -->
        <section>
          <h2 class="mb-3 text-sm font-medium text-muted">Awaiting confirmation call</h2>
          <div v-if="pending" class="admin-kpi-card px-4 py-12 text-center text-muted">Loading…</div>
          <EmptyState
            v-else-if="!pendingQueue?.items.length"
            icon="i-lucide-phone-call"
            title="Queue is empty"
            description="Every new order has been called."
          />
          <div v-else class="space-y-3">
            <div v-for="o in pendingQueue.items" :key="o.id" class="admin-kpi-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <NuxtLink :to="`/orders/${o.id}`" class="tabular font-medium text-primary hover:underline">{{ o.id.slice(0, 8) }}</NuxtLink>
                  <span class="text-sm text-muted">{{ fmtDate(o.createdAt) }}</span>
                </div>
                <div class="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span class="font-medium text-highlighted">{{ o.customer.name ?? 'No name given' }}</span>
                  <a :href="`tel:${o.customer.phone}`" class="tabular flex items-center gap-1 text-sm text-primary hover:underline">
                    <UIcon name="i-lucide-phone" class="size-3.5" />{{ o.customer.phone }}
                  </a>
                </div>
                <p class="mt-1 text-sm text-muted">{{ addressLine(o) }}</p>
                <p class="mt-1 text-sm text-muted">{{ o.items.length }} item{{ o.items.length === 1 ? '' : 's' }} · <PriceDisplay :amount-cents="o.totalCents" class="tabular font-medium text-highlighted" /> COD</p>
              </div>
              <div class="flex shrink-0 flex-wrap gap-2">
                <UButton icon="i-lucide-check" size="sm" color="primary" :loading="acting === `${o.id}:Confirmed`" label="Confirm" @click="act(o.id, 'Confirmed')" />
                <UButton icon="i-lucide-phone-missed" size="sm" color="warning" variant="outline" :loading="acting === `${o.id}:CallCenterNoAnswer`" label="No answer" @click="act(o.id, 'CallCenterNoAnswer')" />
                <UButton icon="i-lucide-phone-off" size="sm" color="error" variant="outline" :loading="acting === `${o.id}:WrongNumber`" label="Wrong number" @click="act(o.id, 'WrongNumber')" />
                <UButton icon="i-lucide-calendar-clock" size="sm" color="warning" variant="outline" :loading="acting === `${o.id}:Postponed`" label="Postpone" @click="act(o.id, 'Postponed')" />
                <UButton icon="i-lucide-x" size="sm" color="error" variant="outline" :loading="acting === `${o.id}:Cancelled`" label="Cancel" @click="act(o.id, 'Cancelled')" />
              </div>
            </div>
          </div>
        </section>

        <!-- No answer — needs a retry call -->
        <section v-if="noAnswerQueue?.items.length">
          <h2 class="mb-3 text-sm font-medium text-muted">No answer — needs a retry call</h2>
          <div class="space-y-3">
            <div v-for="o in noAnswerQueue.items" :key="o.id" class="admin-kpi-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <NuxtLink :to="`/orders/${o.id}`" class="tabular font-medium text-primary hover:underline">{{ o.id.slice(0, 8) }}</NuxtLink>
                  <StatusBadge :state="o.state" />
                </div>
                <div class="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span class="font-medium text-highlighted">{{ o.customer.name ?? 'No name given' }}</span>
                  <a :href="`tel:${o.customer.phone}`" class="tabular flex items-center gap-1 text-sm text-primary hover:underline">
                    <UIcon name="i-lucide-phone" class="size-3.5" />{{ o.customer.phone }}
                  </a>
                </div>
                <p class="mt-1 text-sm text-muted">{{ addressLine(o) }}</p>
              </div>
              <div class="flex shrink-0 flex-wrap gap-2">
                <UButton icon="i-lucide-phone-call" size="sm" color="primary" variant="outline" :loading="acting === `${o.id}:PendingCallCenter`" label="Retry call" @click="act(o.id, 'PendingCallCenter')" />
                <UButton icon="i-lucide-x" size="sm" color="error" variant="outline" :loading="acting === `${o.id}:Cancelled`" label="Cancel" @click="act(o.id, 'Cancelled')" />
              </div>
            </div>
          </div>
        </section>

        <!-- Wrong number — needs a corrected number before retrying -->
        <section v-if="wrongNumberQueue?.items.length">
          <h2 class="mb-3 text-sm font-medium text-muted">Wrong number</h2>
          <div class="space-y-3">
            <div v-for="o in wrongNumberQueue.items" :key="o.id" class="admin-kpi-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <NuxtLink :to="`/orders/${o.id}`" class="tabular font-medium text-primary hover:underline">{{ o.id.slice(0, 8) }}</NuxtLink>
                  <StatusBadge :state="o.state" />
                </div>
                <div class="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span class="font-medium text-highlighted">{{ o.customer.name ?? 'No name given' }}</span>
                  <a :href="`tel:${o.customer.phone}`" class="tabular flex items-center gap-1 text-sm text-primary hover:underline">
                    <UIcon name="i-lucide-phone" class="size-3.5" />{{ o.customer.phone }}
                  </a>
                </div>
                <p class="mt-1 text-sm text-muted">{{ addressLine(o) }}</p>
              </div>
              <div class="flex shrink-0 flex-wrap gap-2">
                <UButton icon="i-lucide-phone-call" size="sm" color="primary" variant="outline" :loading="acting === `${o.id}:PendingCallCenter`" label="Retry call" @click="act(o.id, 'PendingCallCenter')" />
                <UButton icon="i-lucide-x" size="sm" color="error" variant="outline" :loading="acting === `${o.id}:Cancelled`" label="Cancel" @click="act(o.id, 'Cancelled')" />
              </div>
            </div>
          </div>
        </section>

        <!-- Postponed — customer asked to be contacted later -->
        <section v-if="postponedQueue?.items.length">
          <h2 class="mb-3 text-sm font-medium text-muted">Postponed</h2>
          <div class="space-y-3">
            <div v-for="o in postponedQueue.items" :key="o.id" class="admin-kpi-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <NuxtLink :to="`/orders/${o.id}`" class="tabular font-medium text-primary hover:underline">{{ o.id.slice(0, 8) }}</NuxtLink>
                  <StatusBadge :state="o.state" />
                </div>
                <div class="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span class="font-medium text-highlighted">{{ o.customer.name ?? 'No name given' }}</span>
                  <a :href="`tel:${o.customer.phone}`" class="tabular flex items-center gap-1 text-sm text-primary hover:underline">
                    <UIcon name="i-lucide-phone" class="size-3.5" />{{ o.customer.phone }}
                  </a>
                </div>
                <p class="mt-1 text-sm text-muted">{{ addressLine(o) }}</p>
              </div>
              <div class="flex shrink-0 flex-wrap gap-2">
                <UButton icon="i-lucide-phone-call" size="sm" color="primary" variant="outline" :loading="acting === `${o.id}:PendingCallCenter`" label="Contact now" @click="act(o.id, 'PendingCallCenter')" />
                <UButton icon="i-lucide-x" size="sm" color="error" variant="outline" :loading="acting === `${o.id}:Cancelled`" label="Cancel" @click="act(o.id, 'Cancelled')" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
