<script setup lang="ts">
import { CALL_CENTER_STATE_TO_ORDER_STATE, formatPhoneLocal, PRICE_EDITABLE_STATES, SHIPPING_STATE_TO_ORDER_STATE, type AdminOrderDetail, type OrderState, type ShippingCompanyView } from '@amalice/shared'
import { VALID_TRANSITIONS } from '~/composables/order-transitions'

// Orders states that can still take an added item — mirrors
// OrderItemsService.canAddOrderItems server-side (kept in sync by hand
// here, same as every other client-side gate in this app: it's UX only,
// the server re-validates). Once shipped, an order's item list is frozen.
const ADD_ITEM_STATES: OrderState[] = ['PendingCallCenter', 'CallCenterNoAnswer', 'WrongNumber', 'Postponed', 'Confirmed', 'OnHold', 'Packed']

const route = useRoute()
const id = route.params.id as string
useHead({ title: `Order ${id.slice(0, 8)}` })

const api = useAdminApi()
const toast = useToast()
const { run } = useApiAction()
const { data: order, pending, error, refresh } = await useAdminFetch<AdminOrderDetail>(`/admin/orders/${id}`, { key: `admin-order-${id}` })

const transitioning = ref<OrderState | null>(null)

async function transition(to: OrderState, postponedUntil?: string) {
  transitioning.value = to
  await run(() => api(`/admin/orders/${id}/transition`, { method: 'POST', body: { to, postponedUntil } }), {
    success: `Order moved to ${to}`,
    errorFallback: 'Could not update the order'
  })
  await refresh()
  transitioning.value = null
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
    toast.add({ title: 'Enter valid amounts', color: 'warning' })
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
    toast.add({ title: 'Enter a tracking reference', color: 'warning' })
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
    toast.add({ title: 'Pick a product', color: 'warning' })
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
    toast.add({ title: 'Item added to order', color: 'success' })
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Failed to add item', description: data?.message, color: 'error' })
  } finally {
    addingItem.value = false
  }
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="`Order ${id.slice(0, 8)}`">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/orders" />
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="pending" class="py-24 text-center text-muted">Loading…</div>
      <EmptyState v-else-if="error" icon="i-lucide-package-x" title="Order not found" />
      <div v-else-if="order" class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Main column: items + status actions -->
        <div class="space-y-6 lg:col-span-2">
          <div v-if="order.isDuplicate" class="admin-kpi-card flex items-center gap-3 border-l-4 border-l-red-500 p-4">
            <UIcon name="i-lucide-copy-x" class="size-5 shrink-0 text-red-500" />
            <p class="text-sm">
              This looks like a possible duplicate — same customer and at least one shared product within the last 2 days.
              <NuxtLink v-if="order.duplicateOfOrderId" :to="`/orders/${order.duplicateOfOrderId}`" class="font-medium text-primary hover:underline">
                View the earlier order
              </NuxtLink>
            </p>
          </div>

          <div class="admin-kpi-card p-5">
            <div class="mb-4 flex items-center justify-between">
              <div>
                <p class="text-sm text-muted">Total due (COD)</p>
                <PriceDisplay :amount-cents="order.totalCents" class="text-2xl font-semibold" />
              </div>
              <div class="flex flex-wrap items-center gap-1.5">
                <StatusBadge :state="CALL_CENTER_STATE_TO_ORDER_STATE[order.callCenterState]" />
                <StatusBadge v-if="order.shippingState" :state="SHIPPING_STATE_TO_ORDER_STATE[order.shippingState]" />
              </div>
            </div>

            <div class="mb-2 flex items-center justify-between">
              <h3 class="text-sm font-medium text-muted">Items</h3>
              <UButton
                v-if="ADD_ITEM_STATES.includes(order.state)"
                size="xs"
                variant="outline"
                color="neutral"
                icon="i-lucide-plus"
                @click="openAddItem"
              >
                Add item
              </UButton>
            </div>
            <ul class="divide-y divide-[var(--color-admin-border)]">
              <li v-for="item in order.items" :key="item.id" class="flex items-center justify-between py-3">
                <div>
                  <div class="flex items-center gap-2">
                    <NuxtLink :to="`/inventory`" class="font-medium hover:underline">{{ item.product.name }}</NuxtLink>
                    <UBadge v-if="item.isUpsell" color="primary" variant="subtle" size="sm">Upsell</UBadge>
                    <UBadge v-if="item.offerId" color="success" variant="subtle" size="sm">Offer</UBadge>
                  </div>
                  <p v-if="item.variantLabel" class="text-xs text-muted">{{ item.variantLabel }}</p>
                  <p class="text-xs text-muted">Qty {{ item.quantity }} × <PriceDisplay :amount-cents="item.unitPriceCents" /></p>
                </div>
                <PriceDisplay :amount-cents="item.lineTotalCents" class="tabular font-medium" />
              </li>
            </ul>

            <!-- Price breakdown — subtotal is derived (no stored column, see
                 itemsSubtotalCents above); shipping and total come straight
                 from the order record. -->
            <div class="mt-3 space-y-1.5 border-t border-[var(--color-admin-border)] pt-3 text-sm">
              <div class="flex items-center justify-between">
                <span class="text-muted">Items subtotal</span>
                <PriceDisplay :amount-cents="itemsSubtotalCents" class="tabular" />
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted">Shipping<template v-if="order.shippingType"> — {{ shippingTypeLabel[order.shippingType] }}</template></span>
                <PriceDisplay :amount-cents="order.shippingPriceCents" class="tabular" />
              </div>
              <div class="flex items-center justify-between border-t border-[var(--color-admin-border)] pt-1.5 font-semibold">
                <span>Total due (COD)</span>
                <PriceDisplay :amount-cents="order.totalCents" class="tabular" />
              </div>
            </div>

            <!-- Call-center price override — only while the order hasn't been
                 confirmed yet; once Confirmed, packing/shipping/reconciliation
                 all key off these numbers as fixed (see PRICE_EDITABLE_STATES). -->
            <UButton
              v-if="PRICE_EDITABLE_STATES.includes(order.state)"
              icon="i-lucide-pencil"
              size="xs"
              variant="outline"
              color="neutral"
              class="mt-3"
              label="Edit price / shipping fee"
              @click="openPriceEditor"
            />
          </div>

          <!-- Manual transition: the UI only offers valid next states, making an
               illegal transition impossible to submit (server re-validates). -->
          <div v-if="VALID_TRANSITIONS[order.state]?.length" class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Advance status</h3>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="next in VALID_TRANSITIONS[order.state]"
                :key="next"
                :color="next === 'Cancelled' ? 'error' : 'primary'"
                :variant="next === 'Cancelled' ? 'outline' : 'solid'"
                :loading="transitioning === next"
                :label="next"
                size="sm"
                @click="next === 'Postponed' ? openPostpone() : transition(next)"
              />
            </div>
            <p class="mt-3 text-xs text-muted">Only valid transitions are shown. The server re-validates each one.</p>
          </div>

          <!-- Notes — free text per order, shared with the call-center pages and
               mirrored into the Google Sheets integration (see GoogleSheetsService). -->
          <div class="admin-kpi-card p-5">
            <div class="mb-2 flex items-center justify-between">
              <h3 class="text-sm font-medium text-muted">Notes</h3>
              <UButton
                icon="i-lucide-sticky-note"
                size="xs"
                variant="outline"
                color="neutral"
                :label="order.notes ? 'Edit note' : 'Add note'"
                @click="openNotes"
              />
            </div>
            <p v-if="order.notes" class="whitespace-pre-wrap text-sm text-muted">{{ order.notes }}</p>
            <p v-else class="text-sm text-muted">No notes yet.</p>
          </div>

          <!-- Shipping assignment — required before dispatch; never defaults
               to any particular company (see FulfillmentService's comments
               on assignShippingCompany/assignManual/createShipmentForOrder). -->
          <div v-if="!order.shipment" class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Shipping</h3>
            <p v-if="order.fulfillmentMethod === 'Unassigned'" class="mb-3 text-xs text-muted">
              Assign a shipping company or manual (in-house) delivery before this order can be dispatched.
            </p>
            <p v-else class="mb-3 text-sm">
              Assigned to
              <span class="font-medium text-highlighted">{{ order.fulfillmentMethod === 'Manual' ? 'Manual delivery' : order.shippingCompanyName }}</span>
              — reassign below if needed.
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <USelect
                v-model="selectedCompanyId"
                :items="companyOptions"
                placeholder="Choose a shipping company…"
                class="w-56"
              />
              <UButton
                size="sm"
                :loading="assigning"
                :disabled="!selectedCompanyId"
                label="Assign company"
                @click="assignCompany"
              />
              <UButton
                size="sm"
                color="neutral"
                variant="outline"
                icon="i-lucide-user"
                :loading="assigning"
                label="Manual delivery (own driver)"
                @click="assignManual"
              />
            </div>
            <p v-if="!companyOptions.length" class="mt-2 text-xs text-muted">
              No shipping companies linked yet — link one under Settings → Shipping Companies, or use manual delivery.
            </p>

            <div v-if="order.state === 'Packed' && order.fulfillmentMethod !== 'Unassigned'" class="mt-4 flex flex-col gap-3">
              <UButton
                v-if="order.fulfillmentMethod === 'ShippingCompany'"
                icon="i-lucide-truck"
                size="sm"
                class="self-start"
                :loading="shipmentActing === 'dispatch'"
                label="Dispatch to courier"
                @click="dispatchToCourier"
              />
              <p v-if="order.fulfillmentMethod === 'ShippingCompany'" class="text-xs text-muted">
                Or, if this shipment was arranged directly with the courier (phone/portal) instead of through our API, record it manually below:
              </p>
              <div class="flex flex-wrap items-center gap-2">
                <UInput
                  v-model="manualTrackingReference"
                  placeholder="Tracking reference"
                  class="w-56"
                />
                <UButton
                  icon="i-lucide-package-check"
                  size="sm"
                  color="neutral"
                  variant="outline"
                  :loading="dispatchingManual"
                  :disabled="!manualTrackingReference.trim()"
                  :label="order.fulfillmentMethod === 'Manual' ? 'Hand to delivery driver' : 'Dispatch manually'"
                  @click="dispatchManual"
                />
              </div>
            </div>
          </div>

          <!-- Shipment / fulfillment -->
          <div v-if="order.shipment" class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Shipment</h3>
            <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div><dt class="text-muted">Courier</dt><dd>{{ order.shipment.courier.name }}</dd></div>
              <div><dt class="text-muted">Tracking ref</dt><dd class="tabular">{{ order.shipment.trackingReference ?? '— (manual delivery)' }}</dd></div>
              <div><dt class="text-muted">Courier status</dt><dd>{{ order.shipment.courierStatus ?? '—' }}</dd></div>
              <!-- Filled in from a courier webhook payload (e.g. DHD's
                   state-webhooks driver field) once assigned — see
                   DhdWebhookService. -->
              <div v-if="order.shipment.driverName || order.shipment.driverPhone">
                <dt class="text-muted">Driver</dt>
                <dd>
                  {{ order.shipment.driverName || '—' }}
                  <a v-if="order.shipment.driverPhone" :href="`tel:${order.shipment.driverPhone}`" class="tabular text-primary hover:underline">{{ order.shipment.driverPhone }}</a>
                </dd>
              </div>
            </dl>
            <div class="mt-4 flex flex-wrap gap-2">
              <!-- The rest of DHD's "Commandes" actions (see FulfillmentService)
                   — only meaningful for a real courier tracking reference,
                   not a manual delivery. -->
              <template v-if="order.shipment.trackingReference">
                <UButton
                  icon="i-lucide-package-check"
                  size="sm"
                  color="primary"
                  variant="soft"
                  :loading="shipmentActing === 'pickup'"
                  label="Request pickup"
                  @click="requestPickup"
                />
                <UButton
                  icon="i-lucide-file-down"
                  size="sm"
                  color="neutral"
                  variant="soft"
                  :loading="shipmentActing === 'label'"
                  label="Download label"
                  @click="downloadLabel"
                />
              </template>
              <UButton
                icon="i-lucide-x"
                size="sm"
                color="error"
                variant="soft"
                :loading="shipmentActing === 'cancel'"
                label="Cancel shipment"
                @click="cancelShipment"
              />
            </div>
          </div>
        </div>

        <!-- Side column: customer + address -->
        <div class="space-y-6">
          <div class="admin-kpi-card p-5">
            <div class="mb-3 flex items-center justify-between">
              <h3 class="text-sm font-medium text-muted">Customer</h3>
              <UButton
                v-if="PRICE_EDITABLE_STATES.includes(order.state)"
                icon="i-lucide-pencil"
                size="xs"
                variant="link"
                color="neutral"
                label="Edit"
                @click="openCustomerEditor"
              />
            </div>
            <NuxtLink :to="`/customers/${order.customer.id}`" class="block font-medium hover:underline">
              {{ order.customer.name ?? '—' }}
            </NuxtLink>
            <p class="tabular text-sm text-muted">{{ order.customer.phone }}</p>
          </div>

          <div class="admin-kpi-card p-5">
            <div class="mb-3 flex items-center justify-between">
              <h3 class="text-sm font-medium text-muted">Delivery address</h3>
              <UButton
                v-if="PRICE_EDITABLE_STATES.includes(order.state)"
                icon="i-lucide-pencil"
                size="xs"
                variant="link"
                color="neutral"
                label="Edit"
                @click="openCustomerEditor"
              />
            </div>
            <address class="text-sm not-italic leading-relaxed text-muted">
              {{ order.address.line1 || '-' }}<br />
              <span v-if="order.address.line2">{{ order.address.line2 }}<br /></span>
              {{ order.address.city || '-' }}, {{ order.address.region || '-' }}<br />
              {{ order.address.country || '-' }}
            </address>
            <div v-if="order.shippingType" class="mt-3 space-y-1 border-t border-[var(--color-admin-border)] pt-3 text-sm">
              <div class="flex items-center justify-between"><span class="text-muted">Wilaya</span><span>{{ order.address.region || '-' }}</span></div>
              <div class="flex items-center justify-between"><span class="text-muted">City / commune</span><span>{{ order.address.city || '-' }}</span></div>
              <div class="flex items-center justify-between"><span class="text-muted">Shipping method</span><span>{{ shippingTypeLabel[order.shippingType] }}</span></div>
              <div class="flex items-center justify-between"><span class="text-muted">Shipping price</span><PriceDisplay :amount-cents="order.shippingPriceCents" /></div>
            </div>
          </div>

          <div class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Timeline</h3>
            <p class="text-sm text-muted">Created {{ fmtDateTime(order.createdAt) }}</p>
            <p class="text-sm text-muted">Last update {{ fmtDateTime(order.updatedAt) }}</p>
            <div v-if="order.cashReconciliation" class="mt-3 space-y-1 border-t border-[var(--color-admin-border)] pt-3 text-sm">
              <div class="flex items-center justify-between"><span class="text-muted">Expected cash</span><PriceDisplay :amount-cents="order.cashReconciliation.expectedCents" /></div>
              <div v-if="order.cashReconciliation.collectedCents != null" class="flex items-center justify-between text-success">
                <span>Collected</span><PriceDisplay :amount-cents="order.cashReconciliation.collectedCents" />
              </div>
              <p v-else class="text-muted">Not yet reconciled</p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Add item modal (upsells system: call-center/admin manual add) -->
  <UModal v-model:open="showAddItem">
    <template #content>
      <div class="space-y-4 p-6">
        <h3 class="text-lg font-semibold">Add item to order</h3>

        <UFormField label="Product">
          <USelect
            v-model="selectedProductId"
            :items="productOptions.map(p => ({ label: p.name, value: p.id }))"
            placeholder="Choose a product…"
            class="w-full"
          />
        </UFormField>

        <UFormField v-if="productVariants.length" label="Variant">
          <USelect
            v-model="selectedVariantId"
            :items="productVariants.map(v => ({ label: variantLabelFor(v), value: v.id }))"
            placeholder="Choose a variant…"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UFormField label="Quantity">
            <UInputNumber v-model="addQuantity" :min="1" class="w-full" />
          </UFormField>
          <UFormField label="Price override (DZD)" help="Blank = normal price">
            <UInputNumber v-model="addPriceOverrideDzd" :min="0" class="w-full" />
          </UFormField>
        </div>

        <div class="flex items-center justify-between rounded-md border border-[var(--color-admin-border)] p-3">
          <div>
            <p class="text-sm font-medium text-highlighted">Mark as upsell</p>
            <p class="text-xs text-muted">Flags this line as added via the upsells system, not the original order.</p>
          </div>
          <USwitch v-model="addAsUpsell" />
        </div>

        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="showAddItem = false">Cancel</UButton>
          <UButton :loading="addingItem" color="primary" icon="i-lucide-plus" @click="submitAddItem">Add item</UButton>
        </div>
      </div>
    </template>
  </UModal>

  <!-- Call-center price override modal (ADM-12) -->
  <UModal v-model:open="priceModalOpen">
    <template #content>
      <div class="space-y-4 p-6">
        <h3 class="text-lg font-semibold">Edit price / shipping fee</h3>
        <p class="text-sm text-muted">Only available before the order is confirmed — call-center's negotiation window.</p>

        <UFormField label="Shipping fee (DZD)">
          <UInputNumber v-model="editShippingDzd" :min="0" class="w-full" />
        </UFormField>
        <UFormField label="Total due — COD (DZD)" help="Overrides the total directly; the items subtotal itself isn't editable here.">
          <UInputNumber v-model="editTotalDzd" :min="0" class="w-full" />
        </UFormField>

        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="priceModalOpen = false">Cancel</UButton>
          <UButton :loading="savingPrice" color="primary" icon="i-lucide-check" @click="savePrice">Save</UButton>
        </div>
      </div>
    </template>
  </UModal>

  <!-- Notes modal -->
  <UModal v-model:open="notesModalOpen">
    <template #content>
      <div class="space-y-4 p-6">
        <h3 class="text-lg font-semibold">Order note</h3>
        <UTextarea v-model="notesText" :rows="5" placeholder="Notes for this order…" class="w-full" autofocus />
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="notesModalOpen = false">Cancel</UButton>
          <UButton :loading="savingNotes" color="primary" icon="i-lucide-check" @click="saveNotes">Save</UButton>
        </div>
      </div>
    </template>
  </UModal>

  <!-- Postpone date picker -->
  <UModal v-model:open="postponeModalOpen">
    <template #content>
      <div class="space-y-4 p-6">
        <h3 class="text-lg font-semibold">Postpone — pick a follow-up date</h3>
        <p class="text-sm text-muted">The order stays out of the queues until this date/time is reached.</p>
        <UFormField label="Follow up at">
          <UInput v-model="postponeDate" type="datetime-local" class="w-full" />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="postponeModalOpen = false">Cancel</UButton>
          <UButton :disabled="!postponeDate" :loading="transitioning === 'Postponed'" color="primary" icon="i-lucide-check" @click="confirmPostpone">Postpone</UButton>
        </div>
      </div>
    </template>
  </UModal>

  <!-- Customer / delivery info editor -->
  <UModal v-model:open="customerModalOpen">
    <template #content>
      <div class="space-y-4 p-6">
        <h3 class="text-lg font-semibold">Edit customer / delivery info</h3>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Name">
            <UInput v-model="editCustomerName" class="w-full" />
          </UFormField>
          <UFormField label="Phone">
            <UInput v-model="editCustomerPhone" class="w-full" />
          </UFormField>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Wilaya">
            <USelectMenu
              v-model="editWilayaId"
              :items="wilayaOptions.map(w => ({ label: w.name, value: w.id }))"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Commune">
            <USelectMenu
              v-model="editCommuneName"
              :items="communeOptions.map(c => ({ label: c.name, value: c.name }))"
              value-key="value"
              :disabled="!editWilayaId"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Address line">
          <UInput v-model="editAddressLine1" class="w-full" />
        </UFormField>
        <UFormField label="Shipping method">
          <URadioGroup
            v-model="editShippingType"
            orientation="horizontal"
            :items="[{ label: 'Home delivery', value: 'Home' }, { label: 'Desk pickup', value: 'Desk' }]"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="customerModalOpen = false">Cancel</UButton>
          <UButton :loading="savingCustomer" color="primary" icon="i-lucide-check" @click="saveCustomer">Save</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
