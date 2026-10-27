<script setup lang="ts">
import { DELIVERY_STAGES, DELIVERY_STAGE_LABELS, formatPhoneLocal, type DeliveryListItem, type DeliveryListResponse, type DeliveryStage, type ShippingCompanyView } from '@amalice/shared'
import { toast } from 'vue-sonner'

// Delivery details: every order that was sent to a shipping company (or an own
// driver) in one list — the order and customer, the products, the company, the
// shipment (tracking, fees, confirmation), the courier's status in its own words,
// the driver or stop desk, and the latest remarks and delivery attempts. It reads
// the shipping companies' own API: ONE get/trackings/info request per company for the whole
// page (status, driver, stop desk, delivery history). No polling and no automatic re-reads;
// the remarks, fees and courier actions are on the order's own page. If a company can't be
// reached its cards say so.
definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager', 'Finance', 'Support', 'Warehouse'] })
useHead({ title: 'Delivery details' })

const api = useAdminApi()
const { run } = useApiAction()
const { resolveImageUrl } = useResolveImageUrl()
const auth = useAuthStore()

const stage = ref<DeliveryStage>('all')
const company = ref('')
const search = ref('')
const page = ref(1)
const pageSize = ref(25)
const data = ref<DeliveryListResponse | null>(null)
const loading = ref(true)
const openHistory = ref<Set<string>>(new Set())

const { data: companies } = await useAdminFetch<ShippingCompanyView[]>('/admin/shipping-companies', { key: 'admin-deliveries-companies' }).catch(() => ({ data: ref<ShippingCompanyView[] | null>(null) }))
const companyOptions = computed(() => [{ label: 'All shipping companies', value: '' }, ...(companies.value ?? []).filter((c) => c.id && c.isLinked).map((c) => ({ label: c.name, value: c.id! }))])

async function load(refresh = false) {
  loading.value = true
  const query: Record<string, string | number> = { stage: stage.value, page: page.value, pageSize: pageSize.value }
  if (refresh) query.refresh = '1'
  if (company.value) query.company = company.value
  if (search.value.trim()) query.search = search.value.trim()
  const res = await run(() => api<DeliveryListResponse>('/admin/deliveries', { query }), { errorFallback: 'Could not load the deliveries' })
  if (res) data.value = res
  loading.value = false
}
await load()

watch([stage, company, pageSize], () => { page.value = 1; load() })
watch(page, () => load())
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(() => { page.value = 1; load() }, 350)
})

const tabs = computed(() => DELIVERY_STAGES.map((s) => ({ label: DELIVERY_STAGE_LABELS[s], value: s, count: data.value?.counts[s] ?? 0 })))

function toggleHistory(id: string) {
  const next = new Set(openHistory.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  openHistory.value = next
}

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}
function fmtShort(iso: string) {
  return new Date(iso).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
const dzd = (cents: number | null) => (cents == null ? '—' : `${Math.round(cents / 100).toLocaleString('en')} DA`)
async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast.success('Copied') } catch { toast.error('Could not copy') }
}
function stageTone(d: DeliveryListItem): string {
  if (d.orderState === 'DeliveryFailed' || d.orderState === 'ReturnedToOrigin' || d.orderState === 'CancelledShipping') return 'returned'
  if (['Delivered', 'CashCollected', 'Reconciled', 'Settled'].includes(d.orderState)) return 'delivered'
  if (d.orderState === 'OutForDelivery') return 'shipping'
  return 'new'
}
</script>

<template>
  <AdsPage title="Delivery details" :description="`${data?.total ?? 0} deliveries · Every order sent to a shipping company`">
    <template #actions>
      <span v-if="data" class="pill confirmed">Live from the couriers · {{ new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}</span>
      <button class="btn" type="button" :disabled="loading" @click="load(true)"><AdsIcon name="i-lucide-refresh-cw" />{{ loading ? 'Reading…' : 'Refresh from couriers' }}</button>
    </template>

    <section class="card" aria-label="Filters">
      <AdsTabs v-model="stage" :items="tabs" />
      <div class="filters">
        <AdsSearch v-model="search" soft placeholder="Tracking number, order, customer, phone, driver…" label="Search deliveries" />
        <AdsSelect v-model="company" :options="companyOptions" size="sm" aria-label="Shipping company" style="max-width: 240px" />
      </div>
    </section>

    <p v-for="e in data?.liveErrors ?? []" :key="e.company + e.message" class="notice danger"><AdsIcon name="i-lucide-alert-triangle" /><span><b>{{ e.company }}</b> could not be reached: {{ e.message }}. Its parcels below show what was last stored.</span></p>

    <div v-if="loading && !data" class="empty">Reading the shipping companies…</div>
    <div v-else-if="!data?.items.length" class="card"><div class="empty" style="padding: 48px 20px">No deliveries match.</div></div>

    <article v-for="d in data?.items" :key="d.shipmentId" class="card dl">
      <!-- Header: parcel + stage -->
      <header class="dl-head">
        <div class="ids">
          <span v-if="d.trackingReference" class="mono trk">{{ d.trackingReference }}</span>
          <span v-else class="muted">No tracking number</span>
          <button v-if="d.trackingReference" class="btn btn-sm btn-ghost" type="button" aria-label="Copy tracking number" @click="copy(d.trackingReference!)"><AdsIcon name="i-lucide-copy" /></button>
          <NuxtLink :to="`/orders/${d.orderId}`" class="link-cell">Order #{{ d.orderId.slice(0, 8) }}</NuxtLink>
        </div>
        <div class="badges">
          <span class="pill shipping">{{ d.courier.name }}</span>
          <span class="pill outline">{{ d.via === 'api' ? 'Sent via API' : 'Recorded manually' }}</span>
          <span v-if="d.via === 'api'" class="pill" :class="d.confirmed ? 'confirmed' : 'new'">{{ d.confirmed ? 'Confirmed by courier' : 'Awaiting confirmation' }}</span>
          <span v-if="d.via === 'api'" class="pill" :class="d.source.live ? 'confirmed' : 'returned'" :title="d.source.error ?? ''">{{ d.source.live ? 'Live' : 'Stored data' }}</span>
        </div>
      </header>

      <!-- Stage -->
      <div class="stage">
        <div>
          <span class="muted">Shipping stage at the courier</span>
          <b>{{ d.courierStatusLabel ?? (d.via === 'manual' ? 'Not reported (manual)' : 'Not reported yet') }}</b>
          <small v-if="d.courierStatusCode" class="mono muted">{{ d.courierStatusCode }}</small>
        </div>
        <div>
          <span class="muted">Order status in our system</span>
          <AdsOrderStatus :state="d.orderState as never" />
        </div>
        <div v-if="d.lastFailureReason" class="warnbox">
          <AdsIcon name="i-lucide-alert-triangle" />
          <span><b>Last delivery attempt:</b> {{ d.lastFailureReason }}<template v-if="d.postponedTo"> · postponed to {{ fmt(d.postponedTo) }}</template></span>
        </div>
      </div>

      <div class="grid">
        <!-- Customer + address -->
        <section>
          <h3>Customer &amp; delivery address</h3>
          <p class="strong">{{ d.customer.name ?? 'No name given' }}</p>
          <a :href="`tel:${d.customer.phone}`" class="mono">{{ formatPhoneLocal(d.customer.phone) }}</a>
          <p class="muted">{{ d.address.line1 }}, {{ d.address.city }}, {{ d.address.region }}</p>
          <p class="muted">{{ d.shippingType === 'Desk' ? 'Stop desk delivery' : d.shippingType === 'Home' ? 'Home delivery' : 'Delivery type not set' }}</p>
        </section>

        <!-- Products -->
        <section>
          <h3>Products</h3>
          <ul class="items">
            <li v-for="(i, idx) in d.items" :key="idx">
              <img v-if="i.imageUrl" :src="resolveImageUrl(i.imageUrl)" alt="" loading="lazy">
              <span v-else class="ph"><AdsIcon name="i-lucide-package" /></span>
              <span><b>{{ i.name }}</b><small v-if="i.variantLabel" class="muted"> {{ i.variantLabel }}</small><span class="muted"> × {{ i.quantity }}</span></span>
            </li>
          </ul>
          <p class="cod">Cash to collect: <b>{{ dzd(d.codCents) }}</b></p>
        </section>

        <!-- Shipment -->
        <section>
          <h3>Shipment</h3>
          <dl class="kv">
            <div><dt>Sent</dt><dd>{{ fmt(d.dispatchedAt) }}</dd></div>
            <div v-if="d.via === 'api'"><dt>Confirmed</dt><dd>{{ d.confirmed ? fmt(d.confirmedAt) : 'Not yet' }}</dd></div>
            <div><dt>Courier fee</dt><dd>{{ dzd(d.carrierFeeCents) }}<span v-if="d.returnFeeCents != null" class="muted"> · return {{ dzd(d.returnFeeCents) }}</span></dd></div>
            <div v-if="d.via === 'api'"><dt>Last checked</dt><dd>{{ fmt(d.lastSyncedAt) }}</dd></div>
          </dl>
        </section>

        <!-- Driver / desk -->
        <section>
          <h3>Driver / stop desk</h3>
          <template v-if="d.driverName || d.driverPhone || d.desk">
            <p v-if="d.driverName || d.driverPhone"><AdsIcon name="i-lucide-truck" /> <b>{{ d.driverName ?? 'Driver' }}</b> <a v-if="d.driverPhone" :href="`tel:${d.driverPhone}`" class="mono">{{ d.driverPhone }}</a></p>
            <template v-if="d.desk">
              <p><AdsIcon name="i-lucide-package" /> Stop desk <b>{{ d.desk.commune ?? '' }}</b></p>
              <p v-if="d.desk.address" class="muted">{{ d.desk.address }}</p>
              <p v-if="d.desk.phone"><a :href="`tel:${d.desk.phone}`" class="mono">{{ d.desk.phone }}</a></p>
              <p v-if="d.desk.mapLink"><a :href="d.desk.mapLink" target="_blank" rel="noopener">Open map</a></p>
            </template>
          </template>
          <p v-else class="muted">No driver or desk reported yet.</p>
        </section>
      </div>

      <!-- Remarks -->
      <footer v-if="d.remarks.length" class="remarks">
        <h3>Latest remarks &amp; delivery attempts</h3>
        <ul>
          <li v-for="(r, idx) in d.remarks" :key="idx">
            <span class="pill neutral">{{ r.kind === 'attempt' ? 'Attempt' : 'Remark' }}</span>
            <span class="muted mono">{{ fmtShort(r.at) }}</span>
            <span v-if="r.station" class="pill outline">{{ r.station }}</span>
            <span v-if="r.by" class="pill shipping">{{ r.by }}</span>
            <span class="txt">{{ r.text }}</span>
          </li>
        </ul>
      </footer>
      <footer v-else class="remarks muted">No remarks from the courier yet.</footer>

      <!-- Full delivery history (get/trackings/info) -->
      <div v-if="d.history.length" class="hist">
        <button class="btn btn-sm btn-ghost" type="button" @click="toggleHistory(d.shipmentId)"><AdsIcon :name="openHistory.has(d.shipmentId) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" />Full courier history ({{ d.history.length }})</button>
        <ol v-if="openHistory.has(d.shipmentId)">
          <li v-for="(h, idx) in d.history" :key="idx">
            <span class="muted mono">{{ h.at ? fmt(h.at) : '—' }}</span>
            <b>{{ h.reason ?? 'Update' }}</b>
            <span v-if="h.details"> — {{ h.details }}</span>
            <span v-if="h.postponedTo" class="muted"> · postponed to {{ h.postponedTo }}</span>
            <span v-if="h.station" class="pill outline">{{ h.station }}</span>
            <span v-if="h.driver" class="pill shipping">{{ h.driver }}</span>
          </li>
        </ol>
      </div>

      <div class="more"><NuxtLink :to="`/orders/${d.orderId}`" class="btn btn-sm"><AdsIcon name="i-lucide-clipboard-list" />Full details, remarks, fees &amp; courier actions</NuxtLink></div>
    </article>

    <AdsPagination v-if="data" :total="data.total" :page="page" :page-size="pageSize" item-label="deliveries" :page-size-options="[10, 25, 50, 100]" @update:page="(p) => (page = p)" @update:page-size="(s) => (pageSize = s)" />
  </AdsPage>
</template>

<style scoped>
.filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.dl { gap: 14px; }
.dl-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 14px; }
.ids { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
.trk { font-size: 15px; font-weight: 700; color: var(--pine); }
.badges { display: flex; flex-wrap: wrap; gap: 6px; }
.stage { display: flex; flex-wrap: wrap; gap: 14px 28px; align-items: flex-start; padding: 10px 12px; border-radius: var(--r); background: var(--ivory, #f6f2e9); }
.stage > div { display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
.stage b { font-size: 14px; }
.warnbox { flex-direction: row !important; align-items: flex-start; gap: 8px; color: var(--warn-fg, #8a5a00); flex: 1 1 280px; }
.warnbox svg { width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px 24px; }
.grid h3, .remarks h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-2); margin-bottom: 6px; }
.grid p { margin: 2px 0; font-size: 13px; overflow-wrap: anywhere; }
.grid p svg { width: 14px; height: 14px; vertical-align: -2px; color: var(--teal); }
.items { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.items li { display: flex; align-items: center; gap: 10px; font-size: 13px; }
.items img, .items .ph { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; flex-shrink: 0; background: var(--mist); display: grid; place-items: center; }
.cod { margin-top: 8px !important; }
.kv { margin: 0; display: grid; gap: 6px; }
.kv div { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; }
.kv dt { color: var(--text-2); }
.kv dd { margin: 0; text-align: end; }
.remarks { padding: 10px 12px; border-radius: var(--r); background: var(--ivory, #f6f2e9); font-size: 13px; }
.remarks ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.remarks li { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
.remarks .txt { overflow-wrap: anywhere; }
.hist ol { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 6px; font-size: 13px; }
.hist li { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
.more { display: flex; }
</style>
