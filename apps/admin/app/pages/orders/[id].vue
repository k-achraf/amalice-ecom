<script setup lang="ts">
import { ATTRIBUTION_PLATFORM_LABELS, CALL_CENTER_STATE_TO_ORDER_STATE, formatPhoneLocal, ORDER_STATE_LABELS, PRICE_EDITABLE_STATES, SHIPPING_STATE_TO_ORDER_STATE, STATES_REQUIRING_SHIPMENT, type AddressSuggestion, type AdminOrderDetail, type OrderState, type ShippingCompanyView } from '@amalice/shared'
import { VALID_TRANSITIONS } from '~/composables/order-transitions'
import { toast } from 'vue-sonner'



// Orders states that can still take an added item — mirrors
// OrderItemsService.canAddOrderItems server-side (kept in sync by hand
// here, same as every other client-side gate in this app: it's UX only,
// the server re-validates). Once shipped, an order's item list is frozen.
const ADD_ITEM_STATES: OrderState[] = ['PendingCallCenter', 'CallCenterNoAnswer', 'WrongNumber', 'Postponed', 'Confirmed', 'OnHold', 'Packed']

const route = useRoute()
const id = route.params.id as string
const itemsEditOpen = ref(false)
useHead({ title: `Order ${id.slice(0, 8)}` })

const api = useAdminApi()
const { run } = useApiAction()
const auth = useAuthStore()
const { isSuperAdmin, confirmDelete } = useDangerDelete()
// Bumped after each read of the courier so the tracking card re-reads what that read stored.
const timelineKey = ref(0)

// Permanent delete (SuperAdmin): removes the order with its items, shipment and
// reconciliation rows. A parcel already created at a courier is NOT removed there.
const deleting = ref(false)
async function deleteOrder() {
  if (!order.value) return
  const warn = order.value.shipment ? ' It already has a courier shipment — the parcel is NOT cancelled at the courier.' : ''
  if (!confirmDelete(`Permanently delete order #${id.slice(0, 8)} (${order.value.customer.name ?? order.value.customer.phone})?${warn}`)) return
  deleting.value = true
  const res = await run(() => api(`/admin/orders/${id}`, { method: 'DELETE' }), { success: 'Order deleted', errorFallback: 'Could not delete the order' })
  deleting.value = false
  if (res !== undefined) await navigateTo('/orders')
}
const { data: order, pending, error, refresh } = await useAdminFetch<AdminOrderDetail>(`/admin/orders/${id}`, { key: `admin-order-${id}` })

// Non-empty tracking details of the order's source, labelled for the "Order source" card.
const attributionRows = computed<[string, string][]>(() => {
  const a = order.value?.attribution
  if (!a) return []
  const rows: [string, string | null | undefined][] = [
    ['Campaign', a.campaignName ?? a.utmCampaign], ['Campaign ID', a.campaignId],
    ['Ad set', a.adsetName ?? a.utmTerm], ['Ad set ID', a.adsetId],
    ['Ad', a.adName ?? a.utmContent], ['Ad ID', a.adId],
    ['Placement', a.placement], ['utm_source', a.utmSource], ['utm_medium', a.utmMedium],
    ['fbclid', a.fbclid], ['ttclid', a.ttclid], ['gclid', a.gclid],
    ['_fbp', a.fbp], ['_fbc', a.fbc], ['_ttp', a.ttp],
    ['Landing URL', a.landingUrl], ['Order page', a.pageUrl], ['Referrer', a.referrer],
    ['First visit', a.firstTouch ? [a.firstTouch.utmSource, a.firstTouch.utmCampaign ?? a.firstTouch.campaignName, a.firstTouch.landingUrl].filter(Boolean).join(' · ') : null],
    ['IP address', a.ipAddress], ['Device', a.deviceType], ['User agent', a.userAgent], ['Visitor ID', a.visitorId]
  ]
  return rows.filter((r): r is [string, string] => !!r[1])
})

const transitioning = ref<OrderState | null>(null)
// No in-transit states before a courier shipment exists (server enforces it too).
const needsShipment = computed(() => !!order.value && !order.value.shipment && (VALID_TRANSITIONS[order.value.state] ?? []).some((s) => STATES_REQUIRING_SHIPMENT.includes(s as OrderState)))
const nextStates = computed(() => (order.value ? (VALID_TRANSITIONS[order.value.state] ?? []).filter((s) => order.value!.shipment || !STATES_REQUIRING_SHIPMENT.includes(s as OrderState)) : []))

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

// ---- AI address suggestion — POST admin/orders/:id/address-suggestion only
// READS (wilaya / commune / street line matched against the real tables);
// "Apply" sends the differing fields through the same audited customer-info
// PATCH as a manual edit, so the pre-Confirmed window is enforced server-side.
const suggestionOpen = ref(false)
const suggestionLoading = ref(false)
const suggestionApplying = ref(false)
const suggestion = ref<AddressSuggestion | null>(null)

async function openAddressSuggestion() {
  suggestion.value = null
  suggestionOpen.value = true
  suggestionLoading.value = true
  const result = await run(() => api<AddressSuggestion>(`/admin/orders/${id}/address-suggestion`, { method: 'POST' }), {
    errorFallback: 'Could not get an address suggestion'
  })
  suggestionLoading.value = false
  if (result === undefined) {
    suggestionOpen.value = false
    return
  }
  suggestion.value = result
}

// Only what differs from the stored address, and only fields the AI matched.
const suggestionBody = computed<Record<string, string>>(() => {
  const s = suggestion.value
  const o = order.value
  if (!s || !o) return {}
  const body: Record<string, string> = {}
  if (s.wilayaName && s.wilayaName !== o.address.region) body.wilaya = s.wilayaName
  if (s.communeName && s.communeName !== o.address.city) body.commune = s.communeName
  if (s.addressLine1.trim() && s.addressLine1.trim() !== o.address.line1) body.addressLine1 = s.addressLine1.trim()
  return body
})

async function applySuggestion() {
  if (Object.keys(suggestionBody.value).length === 0) return
  suggestionApplying.value = true
  const result = await run(() => api(`/admin/orders/${id}/customer-info`, { method: 'PATCH', body: suggestionBody.value }), {
    success: 'Address updated',
    errorFallback: 'Could not update the address'
  })
  suggestionApplying.value = false
  if (result === undefined) return
  suggestionOpen.value = false
  await refresh()
}

// ---- Shipping assignment — required before dispatch is possible; dispatch
// never falls back to a "default" shipping company (see FulfillmentService.
// assignShippingCompany/assignManual). ----
const { data: shippingCompanies } = await useAdminFetch<ShippingCompanyView[]>('/admin/shipping-companies', { key: 'admin-shipping-companies-picker' })
const linkedCompanies = computed(() => (shippingCompanies.value ?? []).filter((c) => c.isLinked && c.id))
const companyOptions = computed(() => linkedCompanies.value.map((c) => ({ label: c.name, value: c.id as string })))
const selectedCompanyId = ref<string | undefined>(undefined)

// Courier suggestion — ranked from delivered/returned history in this wilaya
// against each company's tariff. Only once the call center has confirmed.
interface CourierSuggestion {
  shippingCompanyId: string; name: string; deliveryRate: number; delivered: number; returned: number; lowSample: boolean
  expectedCostCents: number | null; expectedNetCents: number | null; coverage: 'ok' | 'no' | 'unknown'; recommended: boolean
}
const suggestable = computed(() => !!order.value && !order.value.shipment && !['PendingCallCenter', 'CallCenterNoAnswer', 'WrongNumber', 'Postponed', 'Cancelled', 'CancelledShipping'].includes(order.value.state))
type CourierSuggestionResponse = { wilaya: string | null; suggestions: CourierSuggestion[]; basis: string }
const courierSuggestion = ref<CourierSuggestionResponse | null>(null)
async function loadCourierSuggestion() {
  if (!suggestable.value) return
  try {
    courierSuggestion.value = await api<CourierSuggestionResponse>(`/admin/fulfillment/orders/${id}/courier-suggestion`)
  } catch {
    courierSuggestion.value = null
  }
}
onMounted(loadCourierSuggestion)
const pct = (r: number) => `${Math.round(r * 100)}%`
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
  dispatchingManual.value = true
  const result = await run(
    () => api(`/admin/fulfillment/orders/${id}/dispatch-manual`, { method: 'POST', body: { trackingReference: manualTrackingReference.value.trim() || undefined } }),
    {
      success: order.value?.fulfillmentMethod === 'Manual' ? 'Handed to delivery driver' : 'Marked as sent to the courier',
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
const shipmentActing = ref<'dispatch' | null>(null)

// Sending creates the parcel at the courier; it stays "Prêt à expédier" there. It is only
// confirmed (the courier's Expedier step) when someone presses "Confirm with courier".
async function dispatchToCourier() {
  shipmentActing.value = 'dispatch'
  const res = await run(() => api<{ confirmed: boolean; confirmError: string | null }>(`/admin/fulfillment/orders/${id}/dispatch`, { method: 'POST', body: { confirm: false } }), {
    errorFallback: 'Could not dispatch the order'
  })
  if (res) toast.success('Sent to the courier — it stays “Prêt à expédier” until you confirm it')
  await refresh()
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
// Progress steps (design: `.steps`): the happy path; terminal negative states replace the last step's label.
const STEP_LIST = ['Awaiting call', 'Confirmed', 'Packed', 'Out for delivery', 'Delivered']
const STATE_POS: Partial<Record<OrderState, number>> = {
  PendingCallCenter: 0, CallCenterNoAnswer: 0, WrongNumber: 0, Postponed: 0, OnHold: 0, Confirmed: 1, Packed: 2, HandedToCourier: 3, OutForDelivery: 3,
  Delivered: 4, CashCollected: 4, Reconciled: 4, Settled: 4
}
const steps = computed(() => {
  const st = order.value?.state
  const pos = st ? STATE_POS[st] : undefined
  if (pos !== undefined) return { list: STEP_LIST, pos: pos === 4 ? 5 : pos, final: '' }
  return { list: STEP_LIST, pos: 4, final: st ? ORDER_STATE_LABELS[st] : '' }
})
function initials(name: string | null) {
  return (name ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

</script>

<template>
  <AdsPage :title="`#${id.slice(0, 8)}`" :description="order ? `${fmtDateTime(order.createdAt)} · ${order.items.reduce((n, i) => n + i.quantity, 0)} item(s) · Cash on delivery` : undefined">
    <template #breadcrumb>
      <NuxtLink to="/orders">Orders</NuxtLink><AdsIcon name="i-lucide-chevron-right" style="width: 14px; height: 14px" /><span>#{{ id.slice(0, 8) }}</span>
    </template>
    <template v-if="order" #title-extra>
      <AdsOrderStatus :state="CALL_CENTER_STATE_TO_ORDER_STATE[order.callCenterState]" />
      <AdsOrderStatus v-if="order.shippingState" :state="SHIPPING_STATE_TO_ORDER_STATE[order.shippingState]" />
      <span v-if="order.isAbandoned" class="pill outline" title="The customer never finished submitting the form.">Abandoned cart</span>
    </template>
    <template v-if="order" #actions>
      <button v-if="PRICE_EDITABLE_STATES.includes(order.state) && !order.shipment" class="btn btn-primary" type="button" @click="openCustomerEditor"><AdsIcon name="i-lucide-pencil" />Edit order</button>
      <button class="btn" type="button" :disabled="archiving" @click="toggleArchive"><AdsIcon :name="order.archived ? 'i-lucide-archive-restore' : 'i-lucide-archive'" />{{ order.archived ? 'Unarchive' : 'Archive' }}</button>
      <button v-if="isSuperAdmin" class="btn btn-danger" type="button" :disabled="deleting" @click="deleteOrder"><AdsIcon name="i-lucide-trash-2" />Delete</button>
    </template>

    <div v-if="pending && !order" class="empty">Loading…</div>
    <AdsEmptyState v-else-if="error" icon="i-lucide-package-x" title="Order not found" description="It may have been removed, or the link is wrong.">
      <NuxtLink to="/orders" class="btn" style="margin-top: 8px">Back to orders</NuxtLink>
    </AdsEmptyState>

    <template v-else-if="order">
      <AdsBanner v-if="order.archived">This order is archived: hidden from Orders, Call Center, Fulfillment and Shipping. Use "Unarchive" to restore it.</AdsBanner>
      <AdsBanner v-if="order.isDuplicate" tone="warning">
        Possible duplicate: same customer and at least one shared product within the last 2 days.
        <NuxtLink v-if="order.duplicateOfOrderId" :to="`/orders/${order.duplicateOfOrderId}`" style="font-weight: 600">View the earlier order</NuxtLink>
      </AdsBanner>

      <section class="card" aria-label="Order progress" style="gap: 12px">
        <div class="steps">
          <div v-for="(s, i) in steps.list" :key="s" :class="i < steps.pos ? 'done' : i === steps.pos ? 'current' : ''">{{ i === steps.list.length - 1 && steps.final ? steps.final : s }}</div>
        </div>
      </section>

      <AdsBanner v-if="order.riskLevel === 'High'" tone="danger">High return risk (score {{ order.riskScore }}/100): confirm the address and the customer's intent on the call. Details are in the "Return risk" card.</AdsBanner>

      <div class="split">
        <div class="stack">
          <RiskPanel :order-id="order.id" :level="order.riskLevel" :score="order.riskScore" :factors="order.riskFactors" :can-manage="['SuperAdmin', 'OpsManager', 'Support'].includes(auth.role ?? '')" />
          <section class="card flush" aria-labelledby="it-h">
            <div class="card-head">
              <h2 id="it-h">Items</h2>
              <div v-if="ADD_ITEM_STATES.includes(order.state) && !order.shipment" style="display: flex; gap: 8px">
                <button class="btn btn-primary btn-sm" type="button" @click="itemsEditOpen = true"><AdsIcon name="i-lucide-pencil" />Edit items</button>
                <button class="btn btn-sm" type="button" @click="openAddItem"><AdsIcon name="i-lucide-plus" />Add item</button>
              </div>
            </div>
            <div class="table-wrap">
              <table style="min-width: 520px">
                <thead><tr><th style="padding-left: 20px">Product</th><th class="num">Price</th><th class="num">Qty</th><th class="num" style="padding-right: 20px">Total</th></tr></thead>
                <tbody>
                  <tr v-for="item in order.items" :key="item.id">
                    <td style="padding-left: 20px">
                      <div class="prod">
                        <span class="thumb"><AdsIcon name="i-lucide-package" /></span>
                        <span>
                          <span class="strong">{{ item.product.name }}</span>
                          <AdsLozenge v-if="item.isUpsell" tone="vip" style="margin-left: 6px">Upsell</AdsLozenge>
                          <AdsLozenge v-if="item.offerId" tone="confirmed" style="margin-left: 6px">Offer</AdsLozenge>
                          <span class="sub">{{ item.variantLabel ?? 'Default' }}</span>
                        </span>
                      </div>
                    </td>
                    <td class="num"><AdsPrice :amount-cents="item.unitPriceCents" /></td>
                    <td class="num">× {{ item.quantity }}</td>
                    <td class="num strong" style="padding-right: 20px"><AdsPrice :amount-cents="item.lineTotalCents" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style="padding: 16px 20px">
              <div class="totals">
                <div><span>Subtotal</span><span><AdsPrice :amount-cents="itemsSubtotalCents" /></span></div>
                <div><span>Delivery<template v-if="order.shippingType"> · {{ shippingTypeLabel[order.shippingType] }}</template> · {{ order.address.region }}</span><span><AdsPrice :amount-cents="order.shippingPriceCents" /></span></div>
                <div class="grand"><span>To collect on delivery</span><span><AdsPrice :amount-cents="order.totalCents" /></span></div>
              </div>
              <!-- Price override: only while the order hasn't been confirmed (see PRICE_EDITABLE_STATES). -->
              <button v-if="PRICE_EDITABLE_STATES.includes(order.state) && !order.shipment" class="btn btn-primary btn-sm" type="button" style="margin-top: 12px" @click="openPriceEditor"><AdsIcon name="i-lucide-pencil" />Edit price / shipping fee</button>
            </div>
          </section>

          <DeliveryDetails v-if="['Confirmed', 'OnHold', 'Packed', 'HandedToCourier'].includes(order.state)" :order="order" @changed="refresh" />

          <!-- Shipping assignment: required before dispatch; never defaults to any company. -->
          <section v-if="!order.shipment" class="card" aria-labelledby="dl-h">
            <div class="card-head"><h2 id="dl-h">Delivery</h2></div>
            <p class="muted" style="line-height: 1.5">
              <template v-if="order.fulfillmentMethod === 'Unassigned'">Assign a shipping company or manual (in-house) delivery before this order can be dispatched.</template>
              <template v-else>Assigned to <b>{{ order.fulfillmentMethod === 'Manual' ? 'manual delivery' : order.shippingCompanyName }}</b>. Reassign below if needed.</template>
            </p>
            <div v-if="suggestable && courierSuggestion?.suggestions.length" style="margin: 4px 0 12px">
              <p class="muted" style="font-size: 12px; text-transform: uppercase; letter-spacing: .12em; font-weight: 600; margin-bottom: 6px">Suggested courier{{ courierSuggestion.wilaya ? ` — ${courierSuggestion.wilaya}` : '' }}</p>
              <div v-for="c in courierSuggestion.suggestions" :key="c.shippingCompanyId" style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid var(--line, #e5e5e5)">
                <div style="flex: 1">
                  <span class="strong">{{ c.name }}</span>
                  <span v-if="c.recommended" class="pill instock" style="margin-left: 6px">Best</span>
                  <span v-if="c.coverage === 'no'" class="pill out" style="margin-left: 6px">Address not covered</span>
                  <span class="sub">Delivery {{ pct(c.deliveryRate) }} · {{ c.delivered }} delivered / {{ c.returned }} returned<template v-if="c.lowSample"> · few orders yet</template><template v-if="c.expectedCostCents != null"> · expected cost <AdsPrice :amount-cents="c.expectedCostCents" /></template><template v-else> · no tariff</template></span>
                </div>
                <button class="btn sm" type="button" @click="selectedCompanyId = c.shippingCompanyId">Use</button>
              </div>
              <p class="hint muted" style="margin-top: 6px">{{ courierSuggestion.basis }}</p>
            </div>
            <div class="grid-2">
              <div class="field"><label class="label">Shipping company</label><AdsSelect v-model="selectedCompanyId" :options="companyOptions" placeholder="Choose a shipping company…" /></div>
              <div class="field" style="justify-content: flex-end; flex-direction: row; gap: 8px; align-items: flex-end">
                <button class="btn btn-primary" type="button" :disabled="!selectedCompanyId || assigning" @click="assignCompany">Assign company</button>
                <button class="btn" type="button" :disabled="assigning" @click="assignManual"><AdsIcon name="i-lucide-user" />Own driver</button>
              </div>
            </div>
            <p v-if="!companyOptions.length" class="hint muted">No shipping companies linked yet. Link one under Shipping companies, or use manual delivery.</p>

            <template v-if="order.state === 'Packed' && order.fulfillmentMethod !== 'Unassigned'">
              <hr class="divider">
              <div v-if="order.fulfillmentMethod === 'ShippingCompany'" style="display: flex; gap: 8px; flex-wrap: wrap">
                <button class="btn btn-primary" type="button" :disabled="shipmentActing === 'dispatch'" @click="dispatchToCourier()"><AdsIcon name="i-lucide-truck" />Send to courier</button>
              </div>
              <p v-if="order.fulfillmentMethod === 'ShippingCompany'" class="muted" style="line-height: 1.5">Or, if you created this shipment by hand on the courier's own platform, mark it as sent here (add the tracking number if you have it):</p>
              <div style="display: flex; gap: 8px; flex-wrap: wrap">
                <input v-model="manualTrackingReference" class="input" style="max-width: 280px" placeholder="Tracking reference (optional)">
                <button class="btn" type="button" :disabled="dispatchingManual" @click="dispatchManual"><AdsIcon name="i-lucide-package-check" />{{ order.fulfillmentMethod === 'Manual' ? 'Hand to delivery driver' : 'Mark as sent' }}</button>
              </div>
            </template>
          </section>

          <ShipmentPanel v-else :order="order" @changed="refresh" @refreshed="timelineKey++" />

          <section class="card" aria-labelledby="tl-h">
            <div class="card-head"><h2 id="tl-h">Activity</h2><button class="btn btn-sm" type="button" @click="openNotes"><AdsIcon name="i-lucide-sticky-note" />{{ order.notes ? 'Edit note' : 'Add note' }}</button></div>
            <p v-if="order.notes" style="white-space: pre-wrap; line-height: 1.6">{{ order.notes }}</p>
            <p v-else class="muted">No notes yet.</p>
            <ol class="timeline">
              <li v-if="order.postponedUntil" class="current"><span class="dot" /><div><b>Postponed</b><span>Follow up {{ fmtDateTime(order.postponedUntil) }}</span></div></li>
              <li class="done"><span class="dot" /><div><b>Last update</b><span>{{ fmtDateTime(order.updatedAt) }}</span></div></li>
              <li class="done"><span class="dot" /><div><b>Order placed</b><span>{{ fmtDateTime(order.createdAt) }} · Customer</span></div></li>
            </ol>
          </section>

          <OrderTimeline :order-id="id" :refresh-key="`${order.updatedAt}:${timelineKey}`" />
        </div>

        <div class="stack">
          <!-- Manual transition: only valid next states are offered (server re-validates). -->
          <section v-if="VALID_TRANSITIONS[order.state]?.length" id="action-card" class="card" aria-labelledby="ac-h">
            <div class="card-head"><h2 id="ac-h">Next step</h2></div>
            <div class="stack" style="gap: 8px">
              <p class="muted" style="line-height: 1.5">Only valid transitions are offered; the server re-validates each one.</p>
              <p v-if="needsShipment" class="muted" style="line-height: 1.5"><AdsIcon name="i-lucide-truck" /> "Out for delivery" is only available once the order has been sent to the courier (Dispatch to courier, or Mark as sent).</p>
              <button
                v-for="(next, i) in nextStates"
                :key="next"
                class="btn btn-block"
                :class="next === 'Cancelled' ? 'btn-danger' : i === 0 ? 'btn-primary' : ''"
                type="button"
                :disabled="transitioning === next"
                @click="next === 'Postponed' ? openPostpone() : transition(next)"
              >{{ ORDER_STATE_LABELS[next as OrderState] ?? next }}</button>
            </div>
          </section>

          <section class="card" aria-labelledby="cu-h">
            <div class="card-head">
              <h2 id="cu-h">Customer</h2>
              <NuxtLink :to="`/customers/${order.customer.id}`">View profile</NuxtLink>
            </div>
            <div style="display: flex; gap: 12px; align-items: center">
              <span class="initials dark">{{ initials(order.customer.name) }}</span>
              <div class="grow"><b style="font-weight: 600">{{ order.customer.name ?? '—' }}</b><span class="muted" style="display: block">{{ order.customer.phone }}</span></div>
              <button v-if="PRICE_EDITABLE_STATES.includes(order.state) && !order.shipment" class="btn btn-primary btn-sm" type="button" @click="openCustomerEditor"><AdsIcon name="i-lucide-pencil" />Edit</button>
            </div>
            <a class="btn" :href="`tel:${order.customer.phone}`"><AdsIcon name="i-lucide-phone" />{{ order.customer.phone }}</a>
          </section>

          <!-- Where the order came from: ad platform, campaign / ad set / ad, click ids, IP… (see packages/shared attribution.ts). -->
          <section class="card" aria-labelledby="src-h">
            <div class="card-head"><h2 id="src-h">Order source</h2></div>
            <p v-if="!order.attribution" class="muted">No source was recorded for this order.</p>
            <template v-else>
              <p style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
                <b style="font-weight: 600">{{ ATTRIBUTION_PLATFORM_LABELS[order.attribution.platform] }}</b>
                <span v-if="order.attribution.channel" class="muted">· {{ { storefront: 'Store', landing_page: 'Landing page', funnel: 'Funnel' }[order.attribution.channel] }}</span>
              </p>
              <dl class="details">
                <template v-for="row in attributionRows" :key="row[0]"><dt>{{ row[0] }}</dt><dd style="word-break: break-all">{{ row[1] }}</dd></template>
              </dl>
            </template>
          </section>

          <section class="card" aria-labelledby="ad-h">
            <div class="card-head">
              <h2 id="ad-h">Shipping address</h2>
              <button v-if="PRICE_EDITABLE_STATES.includes(order.state) && !order.shipment" class="btn btn-sm" type="button" @click="openAddressSuggestion"><AdsIcon name="i-lucide-sparkles" />Suggest</button>
              <button v-if="PRICE_EDITABLE_STATES.includes(order.state) && !order.shipment" class="btn btn-primary btn-sm" type="button" @click="openCustomerEditor"><AdsIcon name="i-lucide-pencil" />Edit</button>
            </div>
            <dl class="details">
              <dt>Wilaya</dt><dd>{{ order.address.region || '—' }}</dd>
              <dt>Commune</dt><dd>{{ order.address.city || '—' }}</dd>
              <dt>Address</dt><dd>{{ order.address.line1 || '—' }}<template v-if="order.address.line2">, {{ order.address.line2 }}</template></dd>
              <dt>Type</dt><dd>{{ order.shippingType ? shippingTypeLabel[order.shippingType] : '—' }}</dd>
            </dl>
          </section>

          <section v-if="order.cashReconciliation" class="card" aria-labelledby="cash-h">
            <div class="card-head"><h2 id="cash-h">Cash</h2></div>
            <dl class="details">
              <dt>Expected</dt><dd><AdsPrice :amount-cents="order.cashReconciliation.expectedCents" /></dd>
              <dt>Collected</dt><dd v-if="order.cashReconciliation.collectedCents != null"><AdsPrice :amount-cents="order.cashReconciliation.collectedCents" /></dd><dd v-else class="muted">Not yet reconciled</dd>
            </dl>
          </section>
        </div>
      </div>
    </template>
  </AdsPage>

  <!-- Add item (upsells system: call-center/admin manual add) -->
  <AdsDialog v-model:open="showAddItem" title="Add item to order">
    <AdsField label="Product"><AdsSelect v-model="selectedProductId" :options="productOptions.map((p) => ({ label: p.name, value: p.id }))" placeholder="Choose a product…" /></AdsField>
    <AdsField v-if="productVariants.length" label="Variant"><AdsSelect v-model="selectedVariantId" :options="productVariants.map((v) => ({ label: variantLabelFor(v), value: v.id }))" placeholder="Choose a variant…" /></AdsField>
    <div class="grid-2">
      <AdsField label="Quantity"><AdsNumberInput v-model="addQuantity" :min="1" /></AdsField>
      <AdsField label="Price override (DZD)" help="Blank = normal price"><AdsNumberInput v-model="addPriceOverrideDzd" :min="0" /></AdsField>
    </div>
    <div class="setting" style="padding: 0; border: 0">
      <div class="text"><b>Mark as upsell</b><span>Flags this line as added via the upsells system, not the original order.</span></div>
      <AdsSwitch v-model="addAsUpsell" aria-label="Mark as upsell" />
    </div>
    <template #footer>
      <button class="btn" type="button" @click="showAddItem = false">Cancel</button>
      <button class="btn btn-primary" type="button" :disabled="addingItem" @click="submitAddItem">Add item</button>
    </template>
  </AdsDialog>

  <OrderItemsEditor v-if="order" v-model:open="itemsEditOpen" :order-id="order.id" :items="order.items" @changed="refresh" />

  <!-- Price override (ADM-12) -->
  <AdsDialog v-model:open="priceModalOpen" title="Edit price / shipping fee" description="Available until the order is sent to the courier." width="sm">
    <AdsField label="Shipping fee (DZD)"><AdsNumberInput v-model="editShippingDzd" :min="0" /></AdsField>
    <AdsField label="Total due, COD (DZD)" help="Overrides the total directly; change item quantity/price with “Edit items”."><AdsNumberInput v-model="editTotalDzd" :min="0" /></AdsField>
    <template #footer>
      <button class="btn" type="button" @click="priceModalOpen = false">Cancel</button>
      <button class="btn btn-primary" type="button" :disabled="savingPrice" @click="savePrice">Save</button>
    </template>
  </AdsDialog>

  <AdsDialog v-model:open="notesModalOpen" title="Order note" width="sm">
    <AdsTextarea v-model="notesText" :rows="5" placeholder="Notes for this order…" />
    <template #footer>
      <button class="btn" type="button" @click="notesModalOpen = false">Cancel</button>
      <button class="btn btn-primary" type="button" :disabled="savingNotes" @click="saveNotes">Save</button>
    </template>
  </AdsDialog>

  <AdsDialog v-model:open="postponeModalOpen" title="Postpone: pick a follow-up date" description="The order stays out of the queues until this date/time is reached." width="sm">
    <AdsField label="Follow up at"><AdsInput v-model="postponeDate" type="datetime-local" /></AdsField>
    <template #footer>
      <button class="btn" type="button" @click="postponeModalOpen = false">Cancel</button>
      <button class="btn btn-primary" type="button" :disabled="!postponeDate || transitioning === 'Postponed'" @click="confirmPostpone">Postpone</button>
    </template>
  </AdsDialog>

  <AdsDialog v-model:open="suggestionOpen" title="Address suggestion" description="Matched against the real wilaya and commune lists. Nothing changes until you apply it." width="sm">
    <p v-if="suggestionLoading" class="muted">Analyzing the address…</p>
    <template v-else-if="suggestion && order">
      <dl class="details">
        <div><dt>Wilaya</dt><dd>{{ order.address.region }} → <b>{{ suggestion.wilayaName ?? 'not matched' }}</b></dd></div>
        <div><dt>Commune</dt><dd>{{ order.address.city }} → <b>{{ suggestion.communeName ?? 'not matched' }}</b></dd></div>
        <div><dt>Address line</dt><dd>{{ order.address.line1 }} → <b>{{ suggestion.addressLine1 }}</b></dd></div>
      </dl>
      <p class="muted" style="margin-top: 8px">Confidence: <b>{{ suggestion.confidence }}</b>. {{ suggestion.reason }}</p>
      <p v-if="Object.keys(suggestionBody).length === 0" class="muted" style="margin-top: 8px">The current address already matches — nothing to change.</p>
      <p v-else-if="suggestion.confidence === 'low'" class="muted" style="margin-top: 8px">Low confidence: check this with the customer before applying.</p>
    </template>
    <template #footer>
      <button class="btn" type="button" @click="suggestionOpen = false">Close</button>
      <button class="btn btn-primary" type="button" :disabled="suggestionLoading || suggestionApplying || Object.keys(suggestionBody).length === 0" @click="applySuggestion">Apply</button>
    </template>
  </AdsDialog>

  <AdsDialog v-model:open="customerModalOpen" title="Edit customer / delivery info">
    <div class="grid-2">
      <AdsField label="Name"><AdsInput v-model="editCustomerName" /></AdsField>
      <AdsField label="Phone"><AdsInput v-model="editCustomerPhone" /></AdsField>
    </div>
    <div class="grid-2">
      <AdsField label="Wilaya"><AdsSelect :model-value="editWilayaId" :options="wilayaOptions.map((w) => ({ label: w.name, value: w.id }))" placeholder="Choose a wilaya…" @update:model-value="(v) => (editWilayaId = v ? String(v) : undefined)" /></AdsField>
      <AdsField label="Commune"><AdsSelect :model-value="editCommuneName || undefined" :options="communeOptions.map((c) => ({ label: c.name, value: c.name }))" placeholder="Choose a commune…" :disabled="!editWilayaId" @update:model-value="(v) => (editCommuneName = String(v))" /></AdsField>
    </div>
    <AdsField label="Address line"><AdsInput v-model="editAddressLine1" /></AdsField>
    <AdsField label="Shipping method"><AdsRadioGroup :model-value="editShippingType" :options="[{ label: 'Home delivery', value: 'Home' }, { label: 'Stop desk', value: 'Desk' }]" @update:model-value="(v) => (editShippingType = v as 'Home' | 'Desk')" /></AdsField>
    <template #footer>
      <button class="btn" type="button" @click="customerModalOpen = false">Cancel</button>
      <button class="btn btn-primary" type="button" :disabled="savingCustomer" @click="saveCustomer">Save</button>
    </template>
  </AdsDialog>
</template>
