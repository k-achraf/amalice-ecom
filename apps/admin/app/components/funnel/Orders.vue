<script setup lang="ts">
import { CALL_CENTER_STATE_TO_ORDER_STATE, SHIPPING_STATE_TO_ORDER_STATE, type OrderListResponse } from '@amalice/shared'

// The orders placed on one funnel (Order.funnelId), newest first, in the same shape as the Orders page.
const props = defineProps<{ funnelId: string }>()

const api = useAdminApi()
const page = ref(1)
const pageSize = ref(10)
const search = ref('')
const loading = ref(true)
const failed = ref(false)
const data = ref<OrderListResponse | null>(null)

async function load() {
  loading.value = true
  failed.value = false
  try {
    data.value = await api<OrderListResponse>('/admin/orders', {
      query: { funnelId: props.funnelId, page: String(page.value), pageSize: String(pageSize.value), ...(search.value.trim() && { search: search.value.trim() }) }
    })
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(() => props.funnelId, () => { page.value = 1; load() })

function goToPage(p: number) { page.value = p; load() }
function changePageSize(n: number) { pageSize.value = n; page.value = 1; load() }
function applySearch() { page.value = 1; load() }

const rows = computed(() => data.value?.items ?? [])
const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const itemsText = (o: OrderListResponse['items'][number]) => o.items.map((it) => `${it.product.name} ×${it.quantity}${it.offerLabel ? ` (${it.offerLabel})` : ''}${it.isUpsell ? ' (upsell)' : ''}`).join(', ')
function rowClick(e: MouseEvent, id: string) {
  if (!(e.target as HTMLElement).closest('a, input, button')) navigateTo(`/orders/${id}`)
}
</script>

<template>
  <section class="card" aria-label="Funnel orders" style="padding-bottom: 16px">
    <div class="card-head">
      <h2>Orders <span class="muted" style="font-weight: 400">· {{ data?.total ?? 0 }}</span></h2>
      <label class="search soft">
        <AdsIcon name="i-lucide-search" /><span class="sr">Search orders</span>
        <input v-model="search" type="search" placeholder="Order #, name or phone" @keydown.enter="applySearch">
      </label>
    </div>

    <p v-if="failed" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>Could not load the orders. <button type="button" class="link-cell" style="border: 0; background: none; padding: 0; cursor: pointer" @click="load">Try again</button></span></p>

    <div class="table-wrap">
      <table style="min-width: 760px">
        <thead>
          <tr><th>Order</th><th>Customer</th><th>Destination</th><th>Source</th><th>Items</th><th class="num">Total</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr v-if="loading && !rows.length"><td colspan="7" class="empty">Loading…</td></tr>
          <tr v-else-if="!rows.length"><td colspan="7" class="empty">{{ search.trim() ? 'No order matches this search.' : 'No order has been placed on this funnel yet.' }}</td></tr>
          <tr v-for="o in rows" v-else :key="o.id" class="clickable" @click="rowClick($event, o.id)">
            <td><NuxtLink class="link-cell" :to="`/orders/${o.id}`">#{{ o.id.slice(0, 8) }}</NuxtLink><span class="sub">{{ fmtDate(o.createdAt) }}</span></td>
            <td style="white-space: nowrap">{{ o.customer.name ?? '—' }}<span class="sub">{{ o.customer.phone }}</span></td>
            <td><OrderDestination :address="o.address" :shipping-type="o.shippingType" /></td>
            <td style="max-width: 180px"><template v-if="o.attribution">{{ o.attribution.platform }}<span v-if="o.attribution.campaign" class="sub" style="overflow: hidden; text-overflow: ellipsis" :title="o.attribution.campaign">{{ o.attribution.campaign }}</span></template><span v-else class="muted">—</span></td>
            <td class="muted" style="max-width: 240px">{{ itemsText(o) }}</td>
            <td class="num"><span class="strong"><AdsPrice :amount-cents="o.totalCents" /></span></td>
            <td>
              <div style="display: flex; flex-wrap: wrap; gap: 4px">
                <AdsOrderStatus :state="CALL_CENTER_STATE_TO_ORDER_STATE[o.callCenterState]" />
                <AdsOrderStatus v-if="o.shippingState" :state="SHIPPING_STATE_TO_ORDER_STATE[o.shippingState]" />
                <span v-if="o.isDuplicate" class="pill returned" title="Same customer + product within the last 2 days">Duplicate?</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AdsPagination :total="data?.total ?? 0" :page="page" :page-size="pageSize" item-label="orders" @update:page="goToPage" @update:page-size="changePageSize" />
  </section>
</template>
