<script setup lang="ts">
import type { OrderListResponse } from '@amalice/shared'

// Orders auto-created when a customer typed a phone number on the Impulse
// lead form and went idle past the store's configured delay (Storefront
// settings) without submitting — see OrdersService.createAbandonedOrder.
// Kept off the main Orders/Call Center queues (admin-orders.service.ts's
// list() excludes isAbandoned by default) so they don't read as real
// confirmed leads; this page is where staff follow up on them specifically.
// Same transition actions as Call Center — an abandoned order starts in
// PendingCallCenter exactly like a real one.
definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager', 'Support'] })
useHead({ title: 'Abandoned Carts' })

const api = useAdminApi()
const toast = useToast()

const { data: queue, pending, refresh } = await useAdminFetch<OrderListResponse>(
  '/admin/orders?abandoned=only&pageSize=100',
  { key: 'admin-abandoned-carts' }
)

// Terminal states (Cancelled, or converted-away isAbandoned rows that
// completed) shouldn't clutter the follow-up queue — only show ones still
// worth a call.
const activeItems = computed(() => (queue.value?.items ?? []).filter((o) => o.state !== 'Cancelled'))

const acting = ref<string | null>(null)
async function act(orderId: string, to: 'Confirmed' | 'CallCenterNoAnswer' | 'WrongNumber' | 'Postponed' | 'Cancelled') {
  acting.value = `${orderId}:${to}`
  try {
    await api(`/admin/orders/${orderId}/transition`, { method: 'POST', body: { to } })
    await refresh()
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Failed to update', description: data?.message, color: 'error' })
  } finally {
    acting.value = null
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Abandoned Carts">
        <template #leading><UDashboardSidebarCollapse /></template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div v-if="pending" class="admin-kpi-card px-4 py-12 text-center text-muted">Loading…</div>
      <EmptyState
        v-else-if="!activeItems.length"
        icon="i-lucide-shopping-cart"
        title="No abandoned carts"
        description="Every lead-form visitor who typed a phone number has either finished checking out or already been contacted."
      />
      <div v-else class="space-y-3">
        <p class="mb-1 text-sm text-muted">{{ activeItems.length }} customer{{ activeItems.length === 1 ? '' : 's' }} started checking out but never submitted — reach out before the lead goes cold.</p>
        <div v-for="o in activeItems" :key="o.id" class="admin-kpi-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <NuxtLink :to="`/orders/${o.id}`" class="tabular font-medium text-primary hover:underline">{{ o.id.slice(0, 8) }}</NuxtLink>
              <UBadge color="warning" variant="subtle">Abandoned</UBadge>
              <StatusBadge :state="o.state" />
              <span class="text-sm text-muted">{{ fmtDate(o.createdAt) }}</span>
            </div>
            <div class="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span class="font-medium text-highlighted">{{ o.customer.name || 'No name given' }}</span>
              <a v-if="o.customer.phone" :href="`tel:${o.customer.phone}`" class="tabular flex items-center gap-1 text-sm text-primary hover:underline">
                <UIcon name="i-lucide-phone" class="size-3.5" />{{ o.customer.phone }}
              </a>
            </div>
            <p class="mt-1 text-sm text-muted">
              <span v-for="(item, idx) in o.items" :key="item.id">{{ item.product.name }}{{ idx < o.items.length - 1 ? ', ' : '' }}</span>
            </p>
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
    </template>
  </UDashboardPanel>
</template>
