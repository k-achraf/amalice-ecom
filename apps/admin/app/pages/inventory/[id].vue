<script setup lang="ts">
import { ORDER_STATE_LABELS, STOCK_BUCKETS, STOCK_BUCKET_LABELS, type StockBucketKey, type StockDetails, type StockMovementsResponse } from '@amalice/shared'

// Stock details for ONE product: recorded vs physical stock, where every unit is by what
// became of its orders, a per-variant breakdown and the stock movement log.
definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager', 'Warehouse'] })

const route = useRoute()
const productId = computed(() => String(route.params.id))
const stockApi = useStockDetailsApi()
const { run } = useApiAction()

const data = ref<StockDetails | null>(null)
const loading = ref(true)
const failed = ref(false)

useHead({ title: computed(() => data.value?.product.name ?? 'Stock details') })

async function load() {
  loading.value = true
  const res = await run(() => stockApi.details(productId.value), { errorFallback: 'Could not load the stock details' })
  if (res) { data.value = res; failed.value = false } else failed.value = true
  loading.value = false
}

// ---- Movements ----
const MOVEMENT_REASONS = ['Sale', 'Release', 'Return', 'Restock', 'Correction', 'Damage']
const REASON_PILL: Record<string, string> = { Sale: 'shipping', Release: 'new', Return: 'returned', Restock: 'confirmed', Correction: 'neutral', Damage: 'out' }
const mPage = ref(1)
const mPageSize = 25
const mVariant = ref('')
const mReason = ref('')
const movements = ref<StockMovementsResponse | null>(null)
const mLoading = ref(true)

async function loadMovements() {
  mLoading.value = true
  const res = await run(() => stockApi.movements(productId.value, {
    page: mPage.value,
    pageSize: mPageSize,
    ...(mVariant.value && { variantId: mVariant.value }),
    ...(mReason.value && { reason: mReason.value })
  }), { errorFallback: 'Could not load the stock movements' })
  if (res) movements.value = res
  mLoading.value = false
}

async function refreshAll() { await Promise.all([load(), loadMovements()]) }
await refreshAll()
watch([mVariant, mReason], () => { mPage.value = 1; loadMovements() })
watch(mPage, () => loadMovements())
watch(productId, () => { mPage.value = 1; mVariant.value = ''; mReason.value = ''; refreshAll() })

// ---- Derived ----
const hasVariants = computed(() => !!data.value && (data.value.product.hasVariants || data.value.rows.length > 1))
const variantOptions = computed(() => [{ label: 'All variants', value: '' }, ...(data.value?.rows ?? []).filter((r) => r.variantId).map((r) => ({ label: r.label, value: r.variantId as string }))])
const reasonOptions = computed(() => [{ label: 'All reasons', value: '' }, ...MOVEMENT_REASONS.map((r) => ({ label: r, value: r }))])
const lowStock = computed(() => !!data.value && data.value.onHand <= data.value.product.lowStockThreshold)

const n = (v: number) => v.toLocaleString('en-US')
const BAR_SEGMENTS = computed(() => {
  const d = data.value
  if (!d) return []
  const segs = [
    { key: 'warehouse', label: 'In the warehouse', units: d.physicalInWarehouse, color: 'var(--teal)' },
    { key: 'withCourier', label: STOCK_BUCKET_LABELS.withCourier, units: d.buckets.withCourier.units, color: 'var(--brass)' },
    { key: 'delivered', label: STOCK_BUCKET_LABELS.delivered, units: d.buckets.delivered.units, color: 'var(--sage)' },
    { key: 'returning', label: STOCK_BUCKET_LABELS.returning, units: d.buckets.returning.units, color: 'var(--danger)' }
  ]
  const total = segs.reduce((s, x) => s + x.units, 0)
  return segs.map((s) => ({ ...s, pct: total ? (s.units / total) * 100 : 0 }))
})
const barTotal = computed(() => BAR_SEGMENTS.value.reduce((s, x) => s + x.units, 0))

const stateRows = computed(() => {
  const d = data.value
  if (!d) return []
  return STOCK_BUCKETS.flatMap((b) => d.buckets[b].byState.map((s) => ({ bucket: b, bucketLabel: STOCK_BUCKET_LABELS[b], ...s })))
})

const variantTotals = computed(() => {
  const rows = data.value?.rows ?? []
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0)
  const bucket = (b: StockBucketKey) => ({ units: sum((r) => r.buckets[b].units), orders: sum((r) => r.buckets[b].orders) })
  return { onHand: sum((r) => r.onHand), reserved: sum((r) => r.reservedUnits), physical: sum((r) => r.physicalInWarehouse), bucket }
})

function fmt(iso: string) {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}
const plural = (c: number) => `${c} order${c === 1 ? '' : 's'}`
</script>

<template>
  <AdsPage :title="data?.product.name ?? 'Stock details'" :description="data?.product.sku ? `Stock details · ${data.product.sku}` : 'Stock details'">
    <template #breadcrumb>
      <NuxtLink to="/inventory"><AdsIcon name="i-lucide-arrow-left" />Inventory</NuxtLink>
    </template>
    <template #actions>
      <NuxtLink class="btn" :to="`/products/${productId}`"><AdsIcon name="i-lucide-pencil" />Edit product</NuxtLink>
      <button class="btn" type="button" :disabled="loading || mLoading" @click="refreshAll"><AdsIcon name="i-lucide-refresh-cw" />{{ loading || mLoading ? 'Loading…' : 'Refresh' }}</button>
    </template>

    <div v-if="loading && !data" class="card"><div class="empty" style="padding: 48px 20px">Loading the stock details…</div></div>
    <div v-else-if="failed && !data" class="card">
      <div class="empty" style="padding: 48px 20px">
        <p>Could not load the stock details.</p>
        <button class="btn" type="button" style="margin-top: 12px" @click="refreshAll">Try again</button>
      </div>
    </div>

    <template v-else-if="data">
      <section class="kpis" aria-label="Stock summary">
        <AdsKpiCard label="In stock (recorded)" :value="n(data.onHand)" :color="lowStock ? 'warning' : 'neutral'">
          <span v-if="lowStock" class="pill low">Low stock</span>
          <span v-else>Alert at {{ data.product.lowStockThreshold }} or less</span>
        </AdsKpiCard>
        <AdsKpiCard label="Physically in warehouse" :value="n(data.physicalInWarehouse)" color="dark" meta="Recorded stock + units reserved by confirmed orders" />
        <AdsKpiCard
          v-for="b in STOCK_BUCKETS"
          :key="b"
          :label="STOCK_BUCKET_LABELS[b]"
          :value="n(data.buckets[b].units)"
          unit="units"
          :color="b === 'returning' && data.buckets[b].units > 0 ? 'warning' : 'neutral'"
          :meta="plural(data.buckets[b].orders)"
        />
      </section>
      <p class="muted note">Stock is taken when an order is confirmed; unconfirmed and cancelled orders do not change it. Cancelled orders and abandoned carts are not counted.</p>
      <p class="muted note small">Abandoned carts with this product (not counted): {{ data.abandoned.orders }} cart{{ data.abandoned.orders === 1 ? '' : 's' }},{{ n(data.abandoned.units) }} unit{{ data.abandoned.units === 1 ? '' : 's' }}.</p>

      <section class="card" aria-label="Where the units are">
        <div class="card-head"><h2 class="strong">Where the units are</h2></div>
        <div class="body">
          <div v-if="barTotal" class="bar" role="img" :aria-label="BAR_SEGMENTS.map((s) => `${s.label}: ${s.units}`).join(', ')">
            <div v-for="s in BAR_SEGMENTS.filter((x) => x.units > 0)" :key="s.key" class="seg" :style="{ width: s.pct + '%', background: s.color }" :title="`${s.label}: ${s.units}`" />
          </div>
          <p v-else class="muted">No units to show yet.</p>
          <ul class="legend">
            <li v-for="s in BAR_SEGMENTS" :key="s.key"><span class="dot" :style="{ background: s.color }" />{{ s.label }} <b>{{ n(s.units) }}</b></li>
          </ul>
        </div>
        <div class="table-wrap">
          <table style="min-width: 520px">
            <thead><tr><th>Group</th><th>Order state</th><th class="num">Orders</th><th class="num">Units</th></tr></thead>
            <tbody>
              <tr v-if="!stateRows.length"><td colspan="4" class="empty">No orders contain this product yet.</td></tr>
              <tr v-for="s in stateRows" :key="s.bucket + s.state">
                <td>{{ s.bucketLabel }}</td>
                <td><NuxtLink :to="`/orders?productId=${productId}&state=${s.state}`" class="link-cell">{{ ORDER_STATE_LABELS[s.state] }}</NuxtLink></td>
                <td class="num">{{ n(s.orders) }}</td>
                <td class="num strong">{{ n(s.units) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="hasVariants" class="card" aria-label="By variant">
        <div class="card-head"><h2 class="strong">By variant</h2></div>
        <div class="table-wrap">
          <table style="min-width: 980px">
            <thead>
              <tr>
                <th>Variant</th><th class="num">In stock</th><th class="num">Reserved</th><th class="num">In warehouse</th>
                <th v-for="b in STOCK_BUCKETS" :key="b" class="num">{{ STOCK_BUCKET_LABELS[b] }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in data.rows" :key="r.variantId ?? 'product'">
                <td><span class="strong">{{ r.label }}</span><span v-if="r.sku" class="sub mono">{{ r.sku }}</span></td>
                <td class="num"><span class="pill" :class="r.onHand <= 0 ? 'out' : r.onHand <= r.lowStockThreshold ? 'low' : 'instock'">{{ n(r.onHand) }}</span></td>
                <td class="num">{{ n(r.reservedUnits) }}</td>
                <td class="num strong">{{ n(r.physicalInWarehouse) }}</td>
                <td v-for="b in STOCK_BUCKETS" :key="b" class="num" :title="plural(r.buckets[b].orders)">{{ n(r.buckets[b].units) }}</td>
              </tr>
              <tr class="total-row">
                <td class="strong">Total</td>
                <td class="num strong">{{ n(variantTotals.onHand) }}</td>
                <td class="num strong">{{ n(variantTotals.reserved) }}</td>
                <td class="num strong">{{ n(variantTotals.physical) }}</td>
                <td v-for="b in STOCK_BUCKETS" :key="b" class="num strong" :title="plural(variantTotals.bucket(b).orders)">{{ n(variantTotals.bucket(b).units) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <section class="card" aria-label="Stock movements">
      <div class="card-head">
        <h2 class="strong">Stock movements</h2>
        <div class="filters">
          <select v-if="hasVariants" v-model="mVariant" class="select sm" aria-label="Filter by variant" style="width: auto">
            <option v-for="o in variantOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <select v-model="mReason" class="select sm" aria-label="Filter by reason" style="width: auto">
            <option v-for="o in reasonOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <table style="min-width: 860px">
          <thead><tr><th>Date</th><th>Reason</th><th class="num">Change</th><th>Variant</th><th>Order</th><th>Note</th><th>By</th><th>Supplier</th></tr></thead>
          <tbody>
            <tr v-if="mLoading && !movements"><td colspan="8" class="empty">Loading…</td></tr>
            <tr v-else-if="!movements?.items.length"><td colspan="8" class="empty">No stock movements{{ mVariant || mReason ? ' match these filters' : ' yet' }}.</td></tr>
            <tr v-for="m in movements?.items ?? []" :key="m.id">
              <td style="white-space: nowrap">{{ fmt(m.createdAt) }}</td>
              <td><span class="pill" :class="REASON_PILL[m.reason] ?? 'neutral'">{{ m.reason }}</span></td>
              <td class="num strong" :style="{ color: m.delta > 0 ? 'var(--teal)' : m.delta < 0 ? 'var(--danger-fg)' : undefined }">{{ m.delta > 0 ? '+' : '' }}{{ m.delta }}</td>
              <td>{{ m.variantLabel ?? '—' }}</td>
              <td><NuxtLink v-if="m.orderId" :to="`/orders/${m.orderId}`" class="link-cell">#{{ m.orderId.slice(0, 8) }}</NuxtLink><template v-else>—</template></td>
              <td>{{ m.note ?? '—' }}</td>
              <td>{{ m.actorEmail ?? '—' }}</td>
              <td>{{ m.supplierName ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <AdsPagination v-if="movements" :total="movements.total" :page="mPage" :page-size="mPageSize" item-label="movements" :page-size-options="[mPageSize]" @update:page="(p) => (mPage = p)" />
    </section>
  </AdsPage>
</template>

<style scoped>
.note { font-size: 13px; margin: 0; }
.note.small { margin-top: -8px; font-size: 12px; }
.body { padding: 4px 20px 16px; display: grid; gap: 12px; }
.bar { display: flex; height: 18px; border-radius: var(--r-sm, 4px); overflow: hidden; background: var(--mist); }
.seg { height: 100%; min-width: 2px; }
.legend { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 13px; }
.legend li { display: flex; align-items: center; gap: 6px; }
.dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
.filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.total-row td { border-top: 2px solid var(--line-soft); background: var(--ivory, #f6f2e9); }
.sub { display: block; font-size: 12px; color: var(--text-2); }
</style>
