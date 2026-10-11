<script setup lang="ts">
import { CALL_CENTER_STATE_TO_ORDER_STATE, formatPhoneLocal, ORDER_STATE_LABELS, PRICE_EDITABLE_STATES, SHIPPING_STATE_TO_ORDER_STATE, type AdminOrderDetail, type OrderState, type ShippingCompanyView } from '@amalice/shared'
import { VALID_TRANSITIONS } from '~/composables/order-transitions'
import { toast } from 'vue-sonner'
import { Archive, ArchiveRestore, ArrowLeft, FileDown, PackageCheck, PackageX, Pencil, Plus, StickyNote, Truck, User, X } from 'lucide-vue-next'



// Orders states that can still take an added item — mirrors
// OrderItemsService.canAddOrderItems server-side (kept in sync by hand
// here, same as every other client-side gate in this app: it's UX only,
// the server re-validates). Once shipped, an order's item list is frozen.
const ADD_ITEM_STATES: OrderState[] = ['PendingCallCenter', 'CallCenterNoAnswer', 'WrongNumber', 'Postponed', 'Confirmed', 'OnHold', 'Packed']

const route = useRoute()
const id = route.params.id as string
useHead({ title: `Order ${id.slice(0, 8)}` })

const api = useAdminApi()
const { run } = useApiAction()
const { data: order, pending, error, refresh } = await useAdminFetch<AdminOrderDetail>(`/admin/orders/${id}`, { key: `admin-order-${id}` })

const transitioning = ref<OrderState | null>(null)

async function transition(to: OrderState, postponedUntil?: string) {
  transitioning.value = to
  await run(() => api(`/admin/orders/${id}/transition`, { method: 'POST', body: { to, postponedUntil } }), {
    success: `Order moved to ${ORDER_STATE_LABELS[to] ?? to}`,
    errorFallback: 'Could not update the order'
  })
  await refresh()
  transitioning.value = null
}

// Soft-hide (see Order.archived's Prisma comment) — reversible, never
// touches `state`. Kept as a single toggle button rather than a
// confirmation modal: unarchiving is one click away if this was a mistake.
const archiving = ref(false)

async function toggleArchive() {
  if (!order.value) return
  archiving.value = true
  const nowArchived = order.value.archived
  await run(() => api(`/admin/orders/${id}/${nowArchived ? 'unarchive' : 'archive'}`, { method: 'POST' }), {
    success: nowArchived ? 'Order restored from the archive' : 'Order archived — hidden from Orders/Call Center/Fulfillment/Shipping',
    errorFallback: 'Could not update the order'
  })
  await refresh()
  archiving.value = false
}

// Postpone requires a follow-up date/time (server rejects a bare
// `{to: 'Postponed'}` — see TransitionOrderSchema's refine in packages/shared).
// 'Postponed' is a reachable next state from PendingCallCenter (see
// VALID_TRANSITIONS), so the generic "Advance status" button for it needs
// the same date gate as the dedicated call-center pages.
const postponeModalOpen = ref(false)
const postponeDate = ref('')

function openPostpone() {
  const d = new Date(Date.now() + 4 * 60 * 60 * 1000)
  d.setSeconds(0, 0)
  postponeDate.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  postponeModalOpen.value = true
}

async function confirmPostpone() {
  if (!postponeDate.value) return
  const iso = new Date(postponeDate.value).toISOString()
  postponeModalOpen.value = false
  await transition('Postponed', iso)
}

// ---- Call-center price override (ADM-12) — shipping fee and/or total,
// only while the order is still pre-confirmation (see PRICE_EDITABLE_STATES).
// Server re-enforces the state check regardless of this client-side gate.
const priceModalOpen = ref(false)
const editShippingDzd = ref<number | null>(null)
const editTotalDzd = ref<number | null>(null)
const savingPrice = ref(false)

function openPriceEditor() {
  if (!order.value) return
  editShippingDzd.value = order.value.shippingPriceCents / 100
  editTotalDzd.value = order.value.totalCents / 100
  priceModalOpen.value = true
}

async function savePrice() {
  if (!order.value || editShippingDzd.value == null || editTotalDzd.value == null) return
  const shippingCents = Math.round(editShippingDzd.value * 100)
  const totalCents = Math.round(editTotalDzd.value * 100)
  if (!Number.isFinite(shippingCents) || !Number.isFinite(totalCents) || shippingCents < 0 || totalCents < 0) {
    toast.warning('Enter valid amounts')
    return
  }
  savingPrice.value = true
  const body: { shippingPriceCents?: number; totalCents?: number } = {}
  if (shippingCents !== order.value.shippingPriceCents) body.shippingPriceCents = shippingCents
  if (totalCents !== order.value.totalCents) body.totalCents = totalCents
  if (Object.keys(body).length === 0) {
    savingPrice.value = false
    priceModalOpen.value = false
    return
  }
  const result = await run(() => api(`/admin/orders/${id}/price`, { method: 'PATCH', body }), {
    success: 'Price updated',
    errorFallback: 'Could not update the price'
  })
  savingPrice.value = false
  if (result !== undefined) priceModalOpen.value = false
  await refresh()
}

// ---- Notes — free text per order, mirrored into the Google Sheets
// integration's Notes column (see GoogleSheetsService.updateNotes), so this
// generic order page and the call-center pages stay in sync either way.
const notesModalOpen = ref(false)
const notesText = ref('')
const savingNotes = ref(false)

function openNotes() {
  notesText.value = order.value?.notes ?? ''
  notesModalOpen.value = true
}

async function saveNotes() {
  savingNotes.value = true
  const result = await run(
    () => api(`/admin/orders/${id}/notes`, { method: 'PATCH', body: { notes: notesText.value.trim() || null } }),
    { success: 'Notes saved', errorFallback: 'Could not save notes' }
  )
  savingNotes.value = false
  if (result !== undefined) notesModalOpen.value = false
  await refresh()
}

// ---- Customer / delivery info edit — only while the order is still
// pre-confirmation (see PRICE_EDITABLE_STATES); editing address/shipping
// method after Confirmed would desync what's already been picked/dispatched.
// Address only stores plain name strings, not a wilayaId/communeId FK (see
// Address's Prisma comment), so the select's *name* is what actually gets
// sent — the wilaya id is only used locally to drive the commune fetch.
interface WilayaOption { id: string; name: string }
interface CommuneOption { id: string; name: string; wilayaId: string }
const wilayaOptions = ref<WilayaOption[]>([])
const communeOptions = ref<CommuneOption[]>([])
const wilayaOptionsLoaded = ref(false)
async function ensureWilayas() {
  if (wilayaOptionsLoaded.value) return
  wilayaOptionsLoaded.value = true
  wilayaOptions.value = await api<WilayaOption[]>('/wilayas')
}

const customerModalOpen = ref(false)
const editCustomerName = ref('')
const editCustomerPhone = ref('')
const editWilayaId = ref<string | undefined>(undefined)
const editCommuneName = ref('')
const editAddressLine1 = ref('')
const editShippingType = ref<'Home' | 'Desk' | undefined>(undefined)
const savingCustomer = ref(false)

async function openCustomerEditor() {
  if (!order.value) return
  await ensureWilayas()
  editCustomerName.value = order.value.customer.name ?? ''
  editCustomerPhone.value = formatPhoneLocal(order.value.customer.phone)
  editAddressLine1.value = order.value.address.line1
  editCommuneName.value = order.value.address.city
  editShippingType.value = order.value.shippingType ?? undefined
  const matchedWilaya = wilayaOptions.value.find((w) => w.name === order.value!.address.region)
  editWilayaId.value = matchedWilaya?.id ?? undefined
  if (editWilayaId.value) await loadCommunes(editWilayaId.value)
  customerModalOpen.value = true
}

async function loadCommunes(wilayaId: string) {
  communeOptions.value = await api<CommuneOption[]>('/communes', { query: { wilayaId } })
}
watch(editWilayaId, (id, oldId) => {
  if (id && id !== oldId) {
    editCommuneName.value = ''
    loadCommunes(id)
  }
})

async function saveCustomer() {
  if (!order.value) return
  const wilayaName = wilayaOptions.value.find((w) => w.id === editWilayaId.value)?.name
  savingCustomer.value = true
  const body: Record<string, string> = {}
  if (editCustomerName.value.trim() !== (order.value.customer.name ?? '')) body.customerName = editCustomerName.value.trim()
  if (editCustomerPhone.value.trim() && editCustomerPhone.value.trim() !== formatPhoneLocal(order.value.customer.phone)) body.customerPhone = editCustomerPhone.value.trim()
  if (wilayaName && wilayaName !== order.value.address.region) body.wilaya = wilayaName
  if (editCommuneName.value && editCommuneName.value !== order.value.address.city) body.commune = editCommuneName.value
  if (editAddressLine1.value.trim() && editAddressLine1.value.trim() !== order.value.address.line1) body.addressLine1 = editAddressLine1.value.trim()
  if (editShippingType.value && editShippingType.value !== order.value.shippingType) body.shippingType = editShippingType.value
  if (Object.keys(body).length === 0) {
    savingCustomer.value = false
    customerModalOpen.value = false
    return
  }
  const result = await run(() => api(`/admin/orders/${id}/customer-info`, { method: 'PATCH', body }), {
    success: 'Customer info updated',
    errorFallback: 'Could not update customer info'
  })
  savingCustomer.value = false
  if (result === undefined) return
  customerModalOpen.value = false
  await refresh()
}

// ---- Shipping assignment — required before dispatch is possible; dispatch
// never falls back to a "default" shipping company (see FulfillmentService.
// assignShippingCompany/assignManual). ----
const { data: shippingCompanies } = await useAdminFetch<ShippingCompanyView[]>('/admin/shipping-companies', { key: 'admin-shipping-companies-picker' })
const linkedCompanies = computed(() => (shippingCompanies.value ?? []).filter((c) => c.isLinked && c.id))
const companyOptions = computed(() => linkedCompanies.value.map((c) => ({ label: c.name, value: c.id as string })))
const selectedCompanyId = ref<string | undefined>(undefined)
const assigning = ref(false)

async function assignCompany() {
  if (!selectedCompanyId.value) return
  assigning.value = true
  const companyName = companyOptions.value.find((c) => c.value === selectedCompanyId.value)?.label
  await run(() => api(`/admin/fulfillment/orders/${id}/assign-company`, { method: 'POST', body: { shippingCompanyId: selectedCompanyId.value } }), {
    success: companyName ? `Assigned to ${companyName}` : 'Shipping company assigned',
    errorFallback: 'Could not assign the shipping company'
  })
  await refresh()
  assigning.value = false
}

async function assignManual() {
  assigning.value = true
  await run(() => api(`/admin/fulfillment/orders/${id}/assign-manual`, { method: 'POST' }), {
    success: 'Assigned to manual delivery',
    errorFallback: 'Could not assign manual delivery'
  })
  await refresh()
  assigning.value = false
}

// Manual dispatch — records a shipment without calling the shipping
// company's API (see FulfillmentService.dispatchManual): either true
// in-house delivery, or an order assigned to a company that staff arranged
// directly with that company instead of through our DHD integration.
// Either way there's no API call to generate a tracking number, so it's
// typed in by hand — required, not optional (server enforces this too).
const manualTrackingReference = ref('')
const dispatchingManual = ref(false)
async function dispatchManual() {
  if (!manualTrackingReference.value.trim()) {
    toast.warning('Enter a tracking reference')
    return
  }
  dispatchingManual.value = true
  const result = await run(
    () => api(`/admin/fulfillment/orders/${id}/dispatch-manual`, { method: 'POST', body: { trackingReference: manualTrackingReference.value.trim() } }),
    {
      success: order.value?.fulfillmentMethod === 'Manual' ? 'Handed to delivery driver' : 'Recorded as manually dispatched',
      errorFallback: 'Could not dispatch manually'
    }
  )
  if (result !== undefined) manualTrackingReference.value = ''
  await refresh()
  dispatchingManual.value = false
}

// ---- Shipment actions (DHD "Commandes" API — see apps/api's
// FulfillmentService for requestPickup/cancelShipmentForOrder/
// getShipmentLabel) ----
const shipmentActing = ref<'dispatch' | 'pickup' | 'cancel' | 'label' | null>(null)

async function dispatchToCourier() {
  shipmentActing.value = 'dispatch'
  await run(() => api(`/admin/fulfillment/orders/${id}/dispatch`, { method: 'POST' }), {
    success: 'Order dispatched to courier',
    errorFallback: 'Could not dispatch the order'
  })
  await refresh()
  shipmentActing.value = null
}

async function requestPickup() {
  shipmentActing.value = 'pickup'
  await run(() => api(`/admin/fulfillment/orders/${id}/request-pickup`, { method: 'POST', body: { askCollection: true } }), {
    success: 'Pickup requested with DHD',
    errorFallback: 'Could not request pickup'
  })
  await refresh()
  shipmentActing.value = null
}

async function cancelShipment() {
  shipmentActing.value = 'cancel'
  await run(() => api(`/admin/fulfillment/orders/${id}/cancel-shipment`, { method: 'POST' }), {
    success: 'Shipment cancelled',
    errorFallback: 'Could not cancel the shipment'
  })
  await refresh()
  shipmentActing.value = null
}

async function downloadLabel() {
  shipmentActing.value = 'label'
  await run(async () => {
    const blob = await api<Blob>(`/admin/fulfillment/orders/${id}/label`, { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `label-${id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }, { errorFallback: 'Could not download the label' })
  shipmentActing.value = null
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString()
}

const dzdFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'DZD' })
function formatDzd(cents: number) {
  return dzdFormatter.format(cents / 100)
}

const shippingTypeLabel: Record<'Home' | 'Desk', string> = { Home: 'Home delivery', Desk: 'Desk delivery (courier office)' }

// Order.totalCents = items + shipping (see Prisma schema comment); there's no
// stored subtotal column, so it's derived here from the line items the API
// already returns — same number the server used, just not persisted twice.
const itemsSubtotalCents = computed(() => order.value?.items.reduce((sum, item) => sum + item.lineTotalCents, 0) ?? 0)

// ---- Add item (upsells system: call-center/admin manual add) ----
const showAddItem = ref(false)
interface ProductOption { id: string; name: string; slug: string; priceCents: number }
interface ProductVariantOption { id: string; priceCents: number; stockQuantity: number; attributes: Record<string, string> }
const productOptions = ref<ProductOption[]>([])
const productOptionsLoaded = ref(false)
const selectedProductId = ref<string | undefined>(undefined)
const selectedVariantId = ref<string | undefined>(undefined)
const productVariants = ref<ProductVariantOption[]>([])
const addQuantity = ref(1)
const addPriceOverrideDzd = ref<number | null>(null)
const addAsUpsell = ref(false)
const addingItem = ref(false)

async function openAddItem() {
  showAddItem.value = true
  selectedProductId.value = undefined
  selectedVariantId.value = undefined
  productVariants.value = []
  addQuantity.value = 1
  addPriceOverrideDzd.value = null
  addAsUpsell.value = false
  if (productOptionsLoaded.value) return
  productOptionsLoaded.value = true
  const res = await api<{ items: ProductOption[] }>('/admin/products?pageSize=100')
  productOptions.value = res.items
}

watch(selectedProductId, async (productId) => {
  selectedVariantId.value = undefined
  productVariants.value = []
  const product = productOptions.value.find((p) => p.id === productId)
  if (!product) return
  const detail = await api<{ variants: ProductVariantOption[] }>(`/products/${product.slug}`)
  productVariants.value = detail.variants
})

function variantLabelFor(v: ProductVariantOption) {
  return Object.values(v.attributes).join(' / ')
}

async function submitAddItem() {
  if (!selectedProductId.value) {
    toast.warning('Pick a product')
    return
  }
  addingItem.value = true
  try {
    order.value = await api<AdminOrderDetail>(`/admin/orders/${id}/items`, {
      method: 'POST',
      body: {
        productId: selectedProductId.value,
        variantId: selectedVariantId.value,
        quantity: addQuantity.value,
        priceCentsOverride: addPriceOverrideDzd.value == null ? undefined : Math.round(addPriceOverrideDzd.value * 100),
        isUpsell: addAsUpsell.value
      }
    })
    showAddItem.value = false
    toast.success('Item added to order')
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.error('Failed to add item', { description: data?.message })
  } finally {
    addingItem.value = false
  }
}
</script>

<template>
  <AdsPage :title="`Order ${id.slice(0, 8)}`" wide>
    <template #breadcrumb>
      <nav class="mb-2 flex items-center gap-1 text-sm text-ads-subtle" aria-label="Breadcrumb">
        <NuxtLink to="/orders" class="inline-flex items-center gap-1 hover:text-ads-primary hover:underline"><ArrowLeft class="size-3.5" /> Orders</NuxtLink>
      </nav>
    </template>
    <template v-if="order" #actions>
      <AdsButton appearance="outline" :loading="archiving" @click="toggleArchive">
        <component :is="order.archived ? ArchiveRestore : Archive" /> {{ order.archived ? 'Unarchive' : 'Archive' }}
      </AdsButton>
    </template>

    <div v-if="pending" class="py-24 text-center text-ads-subtlest">Loading…</div>
    <div v-else-if="error" class="py-24 text-center">
      <PackageX class="mx-auto mb-3 size-10 text-ads-subtlest" />
      <p class="text-lg font-medium text-ads-text">Order not found</p>
      <p class="mt-1 text-ads-subtle">It may have been removed, or the link is wrong.</p>
      <AdsButton to="/orders" class="mt-4">Back to orders</AdsButton>
    </div>

    <div v-else-if="order" class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Main column: items + status actions -->
      <div class="space-y-4 lg:col-span-2">
        <AdsBanner v-if="order.archived">
          This order is archived — hidden from Orders, Call Center, Fulfillment, and Shipping. Click "Unarchive" above to restore it.
        </AdsBanner>

        <AdsBanner v-if="order.isDuplicate" tone="warning">
          This looks like a possible duplicate — same customer and at least one shared product within the last 2 days.
          <NuxtLink v-if="order.duplicateOfOrderId" :to="`/orders/${order.duplicateOfOrderId}`" class="font-medium underline">View the earlier order</NuxtLink>
        </AdsBanner>

        <AdsCard>
          <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-xs font-semibold text-ads-subtle">Total due (COD)</p>
              <AdsPrice :amount-cents="order.totalCents" class="ads-tabular text-2xl font-semibold text-ads-text" />
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <AdsOrderStatus :state="CALL_CENTER_STATE_TO_ORDER_STATE[order.callCenterState]" />
              <AdsOrderStatus v-if="order.shippingState" :state="SHIPPING_STATE_TO_ORDER_STATE[order.shippingState]" />
            </div>
          </div>

          <div class="mb-2 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-ads-subtle">Items</h2>
            <AdsButton v-if="ADD_ITEM_STATES.includes(order.state)" size="sm" appearance="outline" @click="openAddItem"><Plus /> Add item</AdsButton>
          </div>
          <ul class="divide-y divide-ads-border border-y border-ads-border">
            <li v-for="item in order.items" :key="item.id" class="flex items-center justify-between gap-4 py-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <NuxtLink to="/inventory" class="font-medium text-ads-text hover:text-ads-primary hover:underline">{{ item.product.name }}</NuxtLink>
                  <AdsLozenge v-if="item.isUpsell" appearance="purple">Upsell</AdsLozenge>
                  <AdsLozenge v-if="item.offerId" appearance="green">Offer</AdsLozenge>
                </div>
                <p v-if="item.variantLabel" class="text-xs text-ads-subtlest">{{ item.variantLabel }}</p>
                <p class="text-xs text-ads-subtlest">Qty {{ item.quantity }} × <AdsPrice :amount-cents="item.unitPriceCents" /></p>
              </div>
              <AdsPrice :amount-cents="item.lineTotalCents" class="ads-tabular shrink-0 font-medium text-ads-text" />
            </li>
          </ul>

          <!-- Subtotal is derived (no stored column, see itemsSubtotalCents);
               shipping and total come straight from the order record. -->
          <dl class="mt-3 space-y-1.5 text-sm">
            <div class="flex items-center justify-between">
              <dt class="text-ads-subtle">Items subtotal</dt>
              <dd><AdsPrice :amount-cents="itemsSubtotalCents" class="ads-tabular" /></dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-ads-subtle">Shipping<template v-if="order.shippingType"> — {{ shippingTypeLabel[order.shippingType] }}</template></dt>
              <dd><AdsPrice :amount-cents="order.shippingPriceCents" class="ads-tabular" /></dd>
            </div>
            <div class="flex items-center justify-between border-t border-ads-border pt-2 text-base font-semibold text-ads-text">
              <dt>Total due (COD)</dt>
              <dd><AdsPrice :amount-cents="order.totalCents" class="ads-tabular" /></dd>
            </div>
          </dl>

          <!-- Price override — only while the order hasn't been confirmed yet
               (see PRICE_EDITABLE_STATES). -->
          <AdsButton v-if="PRICE_EDITABLE_STATES.includes(order.state)" size="sm" appearance="outline" class="mt-3" @click="openPriceEditor">
            <Pencil /> Edit price / shipping fee
          </AdsButton>
        </AdsCard>

        <!-- Manual transition: only valid next states are offered (server re-validates). -->
        <AdsCard v-if="VALID_TRANSITIONS[order.state]?.length" title="Advance status">
          <div class="flex flex-wrap gap-2">
            <AdsButton
              v-for="next in VALID_TRANSITIONS[order.state]"
              :key="next"
              :appearance="next === 'Cancelled' ? 'danger' : 'primary'"
              :loading="transitioning === next"
              @click="next === 'Postponed' ? openPostpone() : transition(next)"
            >
              {{ ORDER_STATE_LABELS[next as OrderState] ?? next }}
            </AdsButton>
          </div>
          <p class="mt-3 text-xs text-ads-subtlest">Only valid transitions are shown. The server re-validates each one.</p>
        </AdsCard>

        <!-- Notes — shared with the call-center pages and mirrored into Google Sheets. -->
        <AdsCard title="Notes">
          <template #actions>
            <AdsButton size="sm" appearance="subtle" @click="openNotes"><StickyNote /> {{ order.notes ? 'Edit note' : 'Add note' }}</AdsButton>
          </template>
          <p v-if="order.notes" class="whitespace-pre-wrap text-sm text-ads-text">{{ order.notes }}</p>
          <p v-else class="text-sm text-ads-subtlest">No notes yet.</p>
        </AdsCard>

        <!-- Shipping assignment — required before dispatch; never defaults to any company. -->
        <AdsCard v-if="!order.shipment" title="Shipping">
          <p v-if="order.fulfillmentMethod === 'Unassigned'" class="mb-3 text-sm text-ads-subtle">
            Assign a shipping company or manual (in-house) delivery before this order can be dispatched.
          </p>
          <p v-else class="mb-3 text-sm text-ads-subtle">
            Assigned to
            <span class="font-medium text-ads-text">{{ order.fulfillmentMethod === 'Manual' ? 'Manual delivery' : order.shippingCompanyName }}</span>
            — reassign below if needed.
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <AdsSelect v-model="selectedCompanyId" :options="companyOptions" placeholder="Choose a shipping company…" class="w-60" />
            <AdsButton appearance="primary" :loading="assigning" :disabled="!selectedCompanyId" @click="assignCompany">Assign company</AdsButton>
            <AdsButton appearance="outline" :loading="assigning" @click="assignManual"><User /> Manual delivery (own driver)</AdsButton>
          </div>
          <p v-if="!companyOptions.length" class="mt-2 text-xs text-ads-subtlest">
            No shipping companies linked yet — link one under Settings → Shipping Companies, or use manual delivery.
          </p>

          <div v-if="order.state === 'Packed' && order.fulfillmentMethod !== 'Unassigned'" class="mt-4 flex flex-col gap-3 border-t border-ads-border pt-4">
            <AdsButton v-if="order.fulfillmentMethod === 'ShippingCompany'" appearance="primary" class="self-start" :loading="shipmentActing === 'dispatch'" @click="dispatchToCourier">
              <Truck /> Dispatch to courier
            </AdsButton>
            <p v-if="order.fulfillmentMethod === 'ShippingCompany'" class="text-xs text-ads-subtlest">
              Or, if this shipment was arranged directly with the courier (phone/portal) instead of through our API, record it manually below:
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <AdsInput v-model="manualTrackingReference" placeholder="Tracking reference" class="w-60" />
              <AdsButton appearance="outline" :loading="dispatchingManual" :disabled="!manualTrackingReference.trim()" @click="dispatchManual">
                <PackageCheck /> {{ order.fulfillmentMethod === 'Manual' ? 'Hand to delivery driver' : 'Dispatch manually' }}
              </AdsButton>
            </div>
          </div>
        </AdsCard>

        <!-- Shipment / fulfillment -->
        <AdsCard v-if="order.shipment" title="Shipment">
          <dl class="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div><dt class="text-xs font-semibold text-ads-subtle">Courier</dt><dd class="text-ads-text">{{ order.shipment.courier.name }}</dd></div>
            <div><dt class="text-xs font-semibold text-ads-subtle">Tracking ref</dt><dd class="ads-tabular text-ads-text">{{ order.shipment.trackingReference ?? '— (manual delivery)' }}</dd></div>
            <div><dt class="text-xs font-semibold text-ads-subtle">Courier status</dt><dd class="text-ads-text">{{ order.shipment.courierStatus ?? '—' }}</dd></div>
            <!-- From a courier webhook payload once a driver is assigned (see DhdWebhookService). -->
            <div v-if="order.shipment.driverName || order.shipment.driverPhone">
              <dt class="text-xs font-semibold text-ads-subtle">Driver</dt>
              <dd class="text-ads-text">
                {{ order.shipment.driverName || '—' }}
                <a v-if="order.shipment.driverPhone" :href="`tel:${order.shipment.driverPhone}`" class="ads-tabular text-ads-primary hover:underline">{{ order.shipment.driverPhone }}</a>
              </dd>
            </div>
          </dl>
          <div class="mt-4 flex flex-wrap gap-2">
            <!-- DHD "Commandes" actions — only meaningful for a real courier tracking reference. -->
            <template v-if="order.shipment.trackingReference">
              <AdsButton appearance="outline" :loading="shipmentActing === 'pickup'" @click="requestPickup"><PackageCheck /> Request pickup</AdsButton>
              <AdsButton appearance="outline" :loading="shipmentActing === 'label'" @click="downloadLabel"><FileDown /> Download label</AdsButton>
            </template>
            <AdsButton appearance="danger" :loading="shipmentActing === 'cancel'" @click="cancelShipment"><X /> Cancel shipment</AdsButton>
          </div>
        </AdsCard>
      </div>

      <!-- Side column: customer + address + timeline -->
      <div class="space-y-4">
        <AdsCard title="Customer">
          <template v-if="PRICE_EDITABLE_STATES.includes(order.state)" #actions>
            <AdsButton size="sm" appearance="subtle" @click="openCustomerEditor"><Pencil /> Edit</AdsButton>
          </template>
          <NuxtLink :to="`/customers/${order.customer.id}`" class="block font-medium text-ads-primary hover:underline">{{ order.customer.name ?? '—' }}</NuxtLink>
          <p class="ads-tabular text-sm text-ads-subtle">{{ order.customer.phone }}</p>
        </AdsCard>

        <AdsCard title="Delivery address">
          <template v-if="PRICE_EDITABLE_STATES.includes(order.state)" #actions>
            <AdsButton size="sm" appearance="subtle" @click="openCustomerEditor"><Pencil /> Edit</AdsButton>
          </template>
          <address class="text-sm not-italic leading-relaxed text-ads-text">
            {{ order.address.line1 || '-' }}<br>
            <span v-if="order.address.line2">{{ order.address.line2 }}<br></span>
            {{ order.address.city || '-' }}, {{ order.address.region || '-' }}<br>
            {{ order.address.country || '-' }}
          </address>
          <dl v-if="order.shippingType" class="mt-3 space-y-1.5 border-t border-ads-border pt-3 text-sm">
            <div class="flex items-center justify-between"><dt class="text-ads-subtle">Wilaya</dt><dd class="text-ads-text">{{ order.address.region || '-' }}</dd></div>
            <div class="flex items-center justify-between"><dt class="text-ads-subtle">City / commune</dt><dd class="text-ads-text">{{ order.address.city || '-' }}</dd></div>
            <div class="flex items-center justify-between"><dt class="text-ads-subtle">Shipping method</dt><dd class="text-ads-text">{{ shippingTypeLabel[order.shippingType] }}</dd></div>
            <div class="flex items-center justify-between"><dt class="text-ads-subtle">Shipping price</dt><dd><AdsPrice :amount-cents="order.shippingPriceCents" class="ads-tabular" /></dd></div>
          </dl>
        </AdsCard>

        <AdsCard title="Timeline">
          <p class="text-sm text-ads-subtle">Created {{ fmtDateTime(order.createdAt) }}</p>
          <p class="text-sm text-ads-subtle">Last update {{ fmtDateTime(order.updatedAt) }}</p>
          <dl v-if="order.cashReconciliation" class="mt-3 space-y-1.5 border-t border-ads-border pt-3 text-sm">
            <div class="flex items-center justify-between"><dt class="text-ads-subtle">Expected cash</dt><dd><AdsPrice :amount-cents="order.cashReconciliation.expectedCents" class="ads-tabular" /></dd></div>
            <div v-if="order.cashReconciliation.collectedCents != null" class="flex items-center justify-between text-teal">
              <dt>Collected</dt><dd><AdsPrice :amount-cents="order.cashReconciliation.collectedCents" class="ads-tabular" /></dd>
            </div>
            <p v-else class="text-ads-subtlest">Not yet reconciled</p>
          </dl>
        </AdsCard>
      </div>
    </div>
  </AdsPage>

  <!-- Add item (upsells system: call-center/admin manual add) -->
  <AdsDialog v-model:open="showAddItem" title="Add item to order">
    <AdsField label="Product">
      <AdsSelect v-model="selectedProductId" :options="productOptions.map((p) => ({ label: p.name, value: p.id }))" placeholder="Choose a product…" />
    </AdsField>
    <AdsField v-if="productVariants.length" label="Variant">
      <AdsSelect v-model="selectedVariantId" :options="productVariants.map((v) => ({ label: variantLabelFor(v), value: v.id }))" placeholder="Choose a variant…" />
    </AdsField>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <AdsField label="Quantity"><AdsNumberInput v-model="addQuantity" :min="1" /></AdsField>
      <AdsField label="Price override (DZD)" help="Blank = normal price"><AdsNumberInput v-model="addPriceOverrideDzd" :min="0" /></AdsField>
    </div>
    <div class="flex items-center justify-between gap-4 rounded-ads-lg border border-ads-border p-3">
      <div>
        <p class="text-sm font-medium text-ads-text">Mark as upsell</p>
        <p class="text-xs text-ads-subtlest">Flags this line as added via the upsells system, not the original order.</p>
      </div>
      <AdsSwitch v-model="addAsUpsell" aria-label="Mark as upsell" />
    </div>
    <template #footer>
      <AdsButton appearance="subtle" @click="showAddItem = false">Cancel</AdsButton>
      <AdsButton appearance="primary" :loading="addingItem" @click="submitAddItem">Add item</AdsButton>
    </template>
  </AdsDialog>

  <!-- Call-center price override (ADM-12) -->
  <AdsDialog v-model:open="priceModalOpen" title="Edit price / shipping fee" description="Only available before the order is confirmed — call-center's negotiation window." width="sm">
    <AdsField label="Shipping fee (DZD)"><AdsNumberInput v-model="editShippingDzd" :min="0" /></AdsField>
    <AdsField label="Total due — COD (DZD)" help="Overrides the total directly; the items subtotal itself isn't editable here."><AdsNumberInput v-model="editTotalDzd" :min="0" /></AdsField>
    <template #footer>
      <AdsButton appearance="subtle" @click="priceModalOpen = false">Cancel</AdsButton>
      <AdsButton appearance="primary" :loading="savingPrice" @click="savePrice">Save</AdsButton>
    </template>
  </AdsDialog>

  <!-- Notes -->
  <AdsDialog v-model:open="notesModalOpen" title="Order note" width="sm">
    <AdsTextarea v-model="notesText" :rows="5" placeholder="Notes for this order…" />
    <template #footer>
      <AdsButton appearance="subtle" @click="notesModalOpen = false">Cancel</AdsButton>
      <AdsButton appearance="primary" :loading="savingNotes" @click="saveNotes">Save</AdsButton>
    </template>
  </AdsDialog>

  <!-- Postpone date picker -->
  <AdsDialog v-model:open="postponeModalOpen" title="Postpone — pick a follow-up date" description="The order stays out of the queues until this date/time is reached." width="sm">
    <AdsField label="Follow up at"><AdsInput v-model="postponeDate" type="datetime-local" /></AdsField>
    <template #footer>
      <AdsButton appearance="subtle" @click="postponeModalOpen = false">Cancel</AdsButton>
      <AdsButton appearance="primary" :disabled="!postponeDate" :loading="transitioning === 'Postponed'" @click="confirmPostpone">Postpone</AdsButton>
    </template>
  </AdsDialog>

  <!-- Customer / delivery info editor -->
  <AdsDialog v-model:open="customerModalOpen" title="Edit customer / delivery info">
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <AdsField label="Name"><AdsInput v-model="editCustomerName" /></AdsField>
      <AdsField label="Phone"><AdsInput v-model="editCustomerPhone" /></AdsField>
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <AdsField label="Wilaya">
        <AdsSelect :model-value="editWilayaId" :options="wilayaOptions.map((w) => ({ label: w.name, value: w.id }))" placeholder="Choose a wilaya…" @update:model-value="(v) => (editWilayaId = String(v))" />
      </AdsField>
      <AdsField label="Commune">
        <AdsSelect :model-value="editCommuneName || undefined" :options="communeOptions.map((c) => ({ label: c.name, value: c.name }))" placeholder="Choose a commune…" :disabled="!editWilayaId" @update:model-value="(v) => (editCommuneName = String(v))" />
      </AdsField>
    </div>
    <AdsField label="Address line"><AdsInput v-model="editAddressLine1" /></AdsField>
    <AdsField label="Shipping method">
      <AdsRadioGroup :model-value="editShippingType" :options="[{ label: 'Home delivery', value: 'Home' }, { label: 'Desk pickup', value: 'Desk' }]" @update:model-value="(v) => (editShippingType = v as 'Home' | 'Desk')" />
    </AdsField>
    <template #footer>
      <AdsButton appearance="subtle" @click="customerModalOpen = false">Cancel</AdsButton>
      <AdsButton appearance="primary" :loading="savingCustomer" @click="saveCustomer">Save</AdsButton>
    </template>
  </AdsDialog>
</template>
