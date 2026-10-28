<script setup lang="ts">
import { POS_SOURCES, type Commune, type OrderState, type PosOrder, type PosOrderResult, type PosProductOffer, type PosProduct, type PosRecentOrder, type ShippingType, type Wilaya } from '@amalice/shared'
import { toast } from 'vue-sonner'

definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent'] })
useHead({ title: 'POS' })

const api = useAdminApi()
const posApi = usePosApi()
const { run } = useApiAction()
const { resolveImageUrl } = useResolveImageUrl()

// ---------- source ----------
const SOURCE_KEY = 'amalice.pos.source'
const source = ref<string>('whatsapp')
const sourceNote = ref('')
onMounted(() => {
  try {
    const saved = localStorage.getItem(SOURCE_KEY)
    if (saved && POS_SOURCES.some((s) => s.id === saved)) source.value = saved
  } catch { /* storage unavailable: keep the default */ }
})
watch(source, (v) => {
  try { localStorage.setItem(SOURCE_KEY, v) } catch { /* ignore */ }
})
const sourceLabel = computed(() => POS_SOURCES.find((s) => s.id === source.value)?.label ?? source.value)
const sourceOptions = POS_SOURCES.map((s) => ({ label: s.label, value: s.id }))

// ---------- customer ----------
const customerName = ref('')
const phone = ref('')
const wilayaId = ref<string | null>(null)
const commune = ref<string | null>(null)
const addressLine = ref('')
const shippingType = ref<ShippingType>('Home')

const wilayas = ref<Wilaya[]>([])
const communes = ref<Commune[]>([])
const loadingCommunes = ref(false)

onMounted(async () => {
  const list = await run(() => api<Wilaya[]>('/wilayas'), { errorFallback: 'Could not load the wilayas' })
  wilayas.value = [...(list ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
})
const wilayaOptions = computed(() => wilayas.value.map((w) => ({ label: w.name, value: w.id })))
const communeOptions = computed(() => communes.value.map((c) => ({ label: c.name, value: c.name })))
const wilaya = computed(() => wilayas.value.find((w) => w.id === wilayaId.value) ?? null)

let communeReq = 0
watch(wilayaId, async (id) => {
  commune.value = null
  communes.value = []
  if (!id) return
  const req = ++communeReq
  loadingCommunes.value = true
  const list = await run(() => api<Commune[]>('/communes', { query: { wilayaId: id } }), { errorFallback: 'Could not load the communes' })
  if (req !== communeReq) return
  communes.value = [...(list ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  loadingCommunes.value = false
})

function rateOf(type: ShippingType): { enabled: boolean; priceCents: number | null } {
  const w = wilaya.value
  if (!w) return { enabled: false, priceCents: null }
  return type === 'Home'
    ? { enabled: w.homeDeliveryEnabled, priceCents: w.homeDeliveryPriceCents }
    : { enabled: w.deskDeliveryEnabled, priceCents: w.deskDeliveryPriceCents }
}
const homeRate = computed(() => rateOf('Home'))
const deskRate = computed(() => rateOf('Desk'))
const deliveryHint = computed(() => {
  if (!wilaya.value) return ''
  const off = [!homeRate.value.enabled && 'home delivery', !deskRate.value.enabled && 'desk delivery'].filter(Boolean)
  return off.length ? `${wilaya.value.name}: ${off.join(' and ')} not available.` : ''
})
// Keep the chosen type on one that this wilaya actually offers.
watch(wilaya, () => {
  if (!rateOf(shippingType.value).enabled) {
    const other: ShippingType = shippingType.value === 'Home' ? 'Desk' : 'Home'
    if (rateOf(other).enabled) shippingType.value = other
  }
})
const typeAvailable = computed(() => rateOf(shippingType.value).enabled)

// ---------- products ----------
interface Line {
  key: number
  product: PosProduct
  variantId: string | null
  quantity: number
  unitCents: number
  offerId: string | null
}
let lineKey = 0
const lines = ref<Line[]>([])
const search = ref('')
const results = ref<PosProduct[]>([])
const searching = ref(false)
const searched = ref(false)

let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchReq = 0
watch(search, (q) => {
  clearTimeout(searchTimer)
  const term = q.trim()
  if (!term) { results.value = []; searched.value = false; searching.value = false; return }
  searching.value = true
  searchTimer = setTimeout(async () => {
    const req = ++searchReq
    const list = await run(() => posApi.searchProducts(term), { errorFallback: 'Product search failed' })
    if (req !== searchReq) return
    results.value = list ?? []
    searched.value = true
    searching.value = false
  }, 300)
})

function catalogCents(l: Line): number {
  const v = l.product.variants.find((x) => x.id === l.variantId)
  return v ? v.priceCents : l.product.priceCents
}
function addProduct(p: PosProduct) {
  const only = p.variants.length === 1 ? p.variants[0]! : null
  const first = p.requireOfferSelection ? (p.offers[0] ?? null) : null
  lines.value.push({ key: ++lineKey, product: p, variantId: only?.id ?? null, quantity: first ? first.totalQuantity : 1, unitCents: only ? only.priceCents : p.priceCents, offerId: first?.id ?? null })
  search.value = ''
  results.value = []
  searched.value = false
}
function setVariant(l: Line, id: string | null) {
  const before = catalogCents(l)
  const wasCustom = l.unitCents !== before
  l.variantId = id
  if (!wasCustom || l.offerId) l.unitCents = catalogCents(l)
}
function variantOptions(p: PosProduct) {
  return p.variants.map((v) => ({ label: v.label || v.sku, value: v.id }))
}
function stockOf(l: Line): number {
  const v = l.product.variants.find((x) => x.id === l.variantId)
  return v ? v.stockQuantity : l.product.stockQuantity
}
function step(l: Line, d: number) {
  l.quantity = Math.max(0.5, Math.round((l.quantity + d) * 2) / 2)
}
function setQty(l: Line, v: number | null) {
  if (v == null || !Number.isFinite(v)) return
  l.quantity = Math.max(0.5, Math.round(v * 2) / 2)
}
function setUnitDa(l: Line, v: number | null) {
  l.unitCents = v == null || !Number.isFinite(v) ? 0 : Math.max(0, Math.round(v * 100))
}
function offerOf(l: Line): PosProductOffer | null {
  return l.offerId ? (l.product.offers.find((o) => o.id === l.offerId) ?? null) : null
}
function setOffer(l: Line, offer: PosProductOffer | null) {
  if (!offer) {
    if (l.product.requireOfferSelection) return
    l.offerId = null
    return
  }
  l.offerId = offer.id
  l.quantity = offer.totalQuantity
  l.unitCents = catalogCents(l) // an offer decides the price: drop any custom price
}
// Same maths as the API: the offer decides the line price.
function lineTotal(l: Line): number {
  const o = offerOf(l)
  if (!o) return Math.round(l.quantity * l.unitCents)
  if (o.type === 'FixedBundlePrice') return Math.round(o.bundlePriceCents ?? o.priceCents)
  if (o.type === 'BuyXGetYFree') return Math.round(l.product.priceCents * o.requiredQuantity)
  return Math.round(o.totalQuantity * catalogCents(l))
}
const hasFreeShippingOffer = computed(() => lines.value.some((l) => offerOf(l)?.type === 'FreeShipping'))
function removeLine(key: number) { lines.value = lines.value.filter((l) => l.key !== key) }
const stockNum = (n: number) => String(Math.round(n * 100) / 100)

// ---------- details ----------
const feeOverrideCents = ref<number | null>(null)
const defaultFeeCents = computed(() => rateOf(shippingType.value).priceCents ?? 0)
const feeCents = computed(() => feeOverrideCents.value ?? defaultFeeCents.value)
const feeIsCustom = computed(() => feeOverrideCents.value !== null && feeOverrideCents.value !== defaultFeeCents.value)
function setFeeDa(v: number | null) {
  feeOverrideCents.value = v == null || !Number.isFinite(v) ? 0 : Math.max(0, Math.round(v * 100))
}
const note = ref('')
const deliveryNote = ref('')
const confirmNow = ref(true)

// ---------- summary ----------
const itemsCents = computed(() => lines.value.reduce((s, l) => s + lineTotal(l), 0))
const totalCents = computed(() => Math.round(itemsCents.value + feeCents.value))

const valid = computed(() =>
  customerName.value.trim().length >= 2 &&
  phone.value.trim().length >= 8 &&
  !!wilayaId.value &&
  !!commune.value &&
  typeAvailable.value &&
  lines.value.length > 0 &&
  lines.value.every((l) => (l.product.variants.length === 0 || !!l.variantId) && l.quantity >= 0.5)
)

// ---------- recent ----------
const recent = ref<PosRecentOrder[]>([])
async function loadRecent() {
  try { recent.value = await posApi.recent() } catch { /* the list is a convenience */ }
}
onMounted(loadRecent)
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

// ---------- submit ----------
const idempotencyKey = ref('')
onMounted(() => { idempotencyKey.value = crypto.randomUUID() })
const submitting = ref(false)
const created = ref<PosOrderResult | null>(null)

async function submit() {
  if (!valid.value || submitting.value) return
  const body: PosOrder = {
    source: source.value,
    sourceNote: sourceNote.value.trim() || undefined,
    customerName: customerName.value.trim(),
    phone: phone.value.trim(),
    wilayaId: wilayaId.value!,
    commune: commune.value!,
    addressLine: addressLine.value.trim() || undefined,
    shippingType: shippingType.value,
    items: lines.value.map((l) => ({
      productId: l.product.id,
      variantId: l.variantId ?? undefined,
      quantity: l.quantity,
      offerId: l.offerId ?? undefined,
      unitPriceCents: !l.offerId && l.unitCents !== catalogCents(l) ? l.unitCents : undefined
    })),
    shippingPriceCents: feeIsCustom.value ? feeCents.value : undefined,
    note: note.value.trim() || undefined,
    deliveryNote: deliveryNote.value.trim() || undefined,
    confirmNow: confirmNow.value,
    idempotencyKey: idempotencyKey.value
  }
  submitting.value = true
  const res = await run(() => posApi.createOrder(body), { errorFallback: 'Could not create the order' })
  submitting.value = false
  if (!res) return
  created.value = res
  idempotencyKey.value = crypto.randomUUID()
  toast.success(`Order #${res.orderId.slice(0, 8)} created`)
  loadRecent()
}

function newOrder() {
  created.value = null
  customerName.value = ''
  phone.value = ''
  wilayaId.value = null
  commune.value = null
  addressLine.value = ''
  shippingType.value = 'Home'
  lines.value = []
  search.value = ''
  feeOverrideCents.value = null
  note.value = ''
  deliveryNote.value = ''
  confirmNow.value = true
  sourceNote.value = ''
}
</script>

<template>
  <AdsPage title="POS" description="Enter orders received on social media, chat or phone">
    <div class="split wide-side">
      <div class="stack">
        <!-- 1. Source -->
        <AdsCard title="Source">
          <div class="chips" role="tablist" aria-label="Order source">
            <button v-for="s in sourceOptions" :key="s.value" type="button" class="chip-btn" role="tab" :aria-selected="source === s.value" @click="source = s.value as string">{{ s.label }}</button>
          </div>
          <AdsField label="Page / account / note">
            <AdsInput v-model="sourceNote" placeholder="e.g. page name, WhatsApp number, post link" maxlength="200" />
          </AdsField>
        </AdsCard>

        <!-- 2. Customer -->
        <AdsCard title="Customer">
          <div class="grid-2">
            <AdsField label="Name" required><AdsInput v-model="customerName" placeholder="Full name" maxlength="120" /></AdsField>
            <AdsField label="Phone" required><AdsInput v-model="phone" type="tel" placeholder="05XX XX XX XX" maxlength="20" /></AdsField>
          </div>
          <div class="grid-2">
            <AdsField label="Wilaya" required :help="deliveryHint">
              <AdsSearchSelect v-model="wilayaId" :options="wilayaOptions" placeholder="Select a wilaya" />
            </AdsField>
            <AdsField label="Commune" required>
              <AdsSearchSelect v-model="commune" :options="communeOptions" :disabled="!wilayaId || loadingCommunes" :placeholder="loadingCommunes ? 'Loading…' : 'Select a commune'" />
            </AdsField>
          </div>
          <AdsField label="Address">
            <AdsTextarea v-model="addressLine" :rows="2" placeholder="Street, neighbourhood, landmark (optional)" maxlength="300" />
          </AdsField>
          <AdsField label="Delivery type" required>
            <div class="chips" role="tablist" aria-label="Delivery type">
              <button type="button" class="chip-btn" role="tab" :aria-selected="shippingType === 'Home'" :disabled="!!wilaya && !homeRate.enabled" :style="wilaya && !homeRate.enabled ? 'opacity:.45;cursor:not-allowed' : ''" @click="shippingType = 'Home'">
                Home<span v-if="wilaya && homeRate.enabled && homeRate.priceCents != null" class="count"><AdsPrice :amount-cents="homeRate.priceCents" /></span>
              </button>
              <button type="button" class="chip-btn" role="tab" :aria-selected="shippingType === 'Desk'" :disabled="!!wilaya && !deskRate.enabled" :style="wilaya && !deskRate.enabled ? 'opacity:.45;cursor:not-allowed' : ''" @click="shippingType = 'Desk'">
                Desk<span v-if="wilaya && deskRate.enabled && deskRate.priceCents != null" class="count"><AdsPrice :amount-cents="deskRate.priceCents" /></span>
              </button>
            </div>
          </AdsField>
        </AdsCard>

        <!-- 3. Products -->
        <AdsCard title="Products">
          <AdsField label="Search a product">
            <AdsInput v-model="search" icon="i-lucide-search" placeholder="Name or SKU" autocomplete="off" />
          </AdsField>
          <p v-if="searching" class="muted">Searching…</p>
          <div v-else-if="results.length" class="stack" style="gap: 4px">
            <button v-for="p in results" :key="p.id" type="button" class="btn" style="justify-content: flex-start; gap: 12px; height: auto; padding: 8px 12px; text-align: start" @click="addProduct(p)">
              <span class="thumb"><img v-if="p.imageUrl" :src="resolveImageUrl(p.imageUrl)" alt="" style="width: 100%; height: 100%; object-fit: cover; border-radius: var(--r)"><AdsIcon v-else name="i-lucide-package" /></span>
              <span style="flex: 1; min-width: 0; white-space: normal">
                <span class="strong" style="display: block">{{ p.name }}</span>
                <span class="muted">Stock {{ stockNum(p.stockQuantity) }}<template v-if="p.variants.length"> · {{ p.variants.length }} variants</template></span>
              </span>
              <AdsPrice :amount-cents="p.priceCents" />
            </button>
          </div>
          <p v-else-if="searched" class="muted">No product found.</p>

          <div v-if="lines.length" class="stack" style="gap: 12px">
            <div v-for="l in lines" :key="l.key" class="stack" style="gap: 10px; border: 1px solid var(--line); border-radius: var(--r); padding: 12px">
              <div style="display: flex; gap: 12px; align-items: center">
                <span class="thumb"><img v-if="l.product.imageUrl" :src="resolveImageUrl(l.product.imageUrl)" alt="" style="width: 100%; height: 100%; object-fit: cover; border-radius: var(--r)"><AdsIcon v-else name="i-lucide-package" /></span>
                <span class="strong" style="flex: 1; min-width: 0">{{ l.product.name }}</span>
                <AdsLozenge v-if="offerOf(l)" tone="confirmed">{{ offerOf(l)!.label }}</AdsLozenge>
                <button type="button" class="row-btn" aria-label="Remove line" @click="removeLine(l.key)"><AdsIcon name="i-lucide-trash-2" /></button>
              </div>
              <div v-if="l.product.offers.length" class="stack" style="gap: 6px">
                <span class="muted">Offer</span>
                <div class="chips" role="tablist" aria-label="Offer">
                  <button v-if="!l.product.requireOfferSelection" type="button" class="chip-btn" role="tab" :aria-selected="!l.offerId" @click="setOffer(l, null)">No offer</button>
                  <button v-for="o in l.product.offers" :key="o.id" type="button" class="chip-btn" role="tab" :aria-selected="l.offerId === o.id" @click="setOffer(l, o)">
                    {{ o.label }}<span class="count">{{ stockNum(o.totalQuantity) }} pcs · <AdsPrice :amount-cents="o.type === 'FixedBundlePrice' ? (o.bundlePriceCents ?? o.priceCents) : o.priceCents" /></span>
                  </button>
                </div>
                <p v-if="l.product.requireOfferSelection" class="muted">This product is sold through offers only.</p>
              </div>
              <div class="grid-2">
                <AdsField v-if="l.product.variants.length" label="Variant" required>
                  <AdsSelect :model-value="l.variantId" :options="variantOptions(l.product)" placeholder="Choose a variant" @update:model-value="setVariant(l, $event)" />
                </AdsField>
                <AdsField label="Quantity">
                  <div style="display: flex; gap: 6px; align-items: center">
                    <button type="button" class="icon-btn" aria-label="Decrease" :disabled="!!l.offerId || l.quantity <= 0.5" @click="step(l, -0.5)"><AdsIcon name="i-lucide-minus" /></button>
                    <AdsNumberInput :model-value="l.quantity" :min="0.5" :step="0.5" :disabled="!!l.offerId" style="text-align: center" @update:model-value="setQty(l, $event ?? null)" />
                    <button type="button" class="icon-btn" aria-label="Increase" :disabled="!!l.offerId" @click="step(l, 0.5)"><AdsIcon name="i-lucide-plus" /></button>
                  </div>
                </AdsField>
                <AdsField label="Unit price (DA)">
                  <AdsNumberInput :model-value="l.unitCents / 100" :min="0" :step="1" :disabled="!!l.offerId" @update:model-value="setUnitDa(l, $event ?? null)" />
                  <span v-if="!l.offerId && l.unitCents !== catalogCents(l)" class="hint"><AdsLozenge tone="vip">custom price</AdsLozenge> catalogue: <AdsPrice :amount-cents="catalogCents(l)" /></span>
                </AdsField>
                <AdsField label="Line total">
                  <div class="strong" style="min-height: 40px; display: flex; align-items: center"><AdsPrice :amount-cents="lineTotal(l)" /></div>
                </AdsField>
              </div>
              <p v-if="l.quantity > stockOf(l)" class="muted">Only {{ stockNum(stockOf(l)) }} in stock — the order can still be created.</p>
            </div>
          </div>
        </AdsCard>

        <!-- 4. Details -->
        <AdsCard title="Details">
          <AdsField label="Delivery fee (DA)">
            <AdsNumberInput :model-value="feeCents / 100" :min="0" :step="1" @update:model-value="setFeeDa($event ?? null)" />
            <span v-if="feeIsCustom" class="hint">
              <AdsLozenge tone="vip">custom fee</AdsLozenge>
              Configured rate: <AdsPrice :amount-cents="defaultFeeCents" /> ·
              <a href="#" @click.prevent="feeOverrideCents = null">Reset</a>
            </span>
            <span v-if="hasFreeShippingOffer" class="hint">
              Free shipping offer: set the delivery fee to 0 if you want to honour it ·
              <a href="#" @click.prevent="setFeeDa(0)">Set fee to 0</a>
            </span>
          </AdsField>
          <AdsField label="Internal note"><AdsTextarea v-model="note" :rows="2" maxlength="1000" placeholder="Visible to staff only" /></AdsField>
          <AdsField label="Note for the courier" help="Printed on the shipment (max 255 characters)."><AdsInput v-model="deliveryNote" maxlength="255" /></AdsField>
          <AdsSwitch v-model="confirmNow" label="The customer already confirmed — create the order as Confirmed" :description="confirmNow ? 'Stock is taken and the order goes to fulfillment.' : 'The order goes to the call-center queue to be called.'" />
        </AdsCard>
      </div>

      <!-- Summary -->
      <div class="stack" style="position: sticky; top: 16px">
        <AdsCard title="Summary">
          <template v-if="created">
            <div class="stack" style="gap: 12px">
              <AdsLozenge tone="confirmed">Order #{{ created.orderId.slice(0, 8) }} created</AdsLozenge>
              <p class="muted">Total to collect: <AdsPrice :amount-cents="created.totalCents" /><template v-if="created.riskLevel"> · risk {{ created.riskLevel }}</template></p>
              <p v-if="created.duplicateOfOrderId" class="muted" style="color: var(--warn-fg)">
                A similar recent order exists for this customer:
                <NuxtLink :to="`/orders/${created.duplicateOfOrderId}`">view it</NuxtLink>.
              </p>
              <NuxtLink :to="`/orders/${created.orderId}`" class="btn btn-block">Open the order</NuxtLink>
              <button type="button" class="btn btn-primary btn-block" @click="newOrder">New order</button>
            </div>
          </template>
          <template v-else>
            <dl class="stack" style="gap: 8px">
              <div style="display: flex; justify-content: space-between"><dt class="muted">Source</dt><dd>{{ sourceLabel }}</dd></div>
              <div style="display: flex; justify-content: space-between"><dt class="muted">Items</dt><dd><AdsPrice :amount-cents="itemsCents" /></dd></div>
              <div style="display: flex; justify-content: space-between"><dt class="muted">Delivery</dt><dd><AdsPrice :amount-cents="feeCents" /></dd></div>
              <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--line); padding-top: 10px"><dt class="strong">Total to collect (COD)</dt><dd class="strong"><AdsPrice :amount-cents="totalCents" /></dd></div>
            </dl>
            <button type="button" class="btn btn-primary btn-block" :disabled="!valid || submitting" @click="submit">{{ submitting ? 'Creating…' : 'Create order' }}</button>
          </template>
        </AdsCard>

        <AdsCard title="Recent POS orders" flush>
          <p v-if="!recent.length" class="muted" style="padding: 16px 20px">No POS orders yet.</p>
          <ul v-else style="list-style: none; margin: 0; padding: 0">
            <li v-for="o in recent" :key="o.id" style="padding: 12px 20px; border-top: 1px solid var(--line-soft); display: flex; gap: 10px; align-items: center; justify-content: space-between">
              <NuxtLink :to="`/orders/${o.id}`" style="min-width: 0; flex: 1">
                <span class="strong" style="display: block; overflow: hidden; text-overflow: ellipsis">{{ o.customerName || o.phone }}</span>
                <span class="muted" style="display: block">{{ fmtTime(o.createdAt) }} · {{ o.city }}</span>
              </NuxtLink>
              <span style="text-align: end">
                <AdsPrice :amount-cents="o.totalCents" style="display: block" />
                <AdsOrderStatus :state="o.state as OrderState" />
              </span>
            </li>
          </ul>
        </AdsCard>
      </div>
    </div>
  </AdsPage>
</template>
