<script setup lang="ts">
import type {
  AdCreativeType,
  AdTestPlatform,
  AdTestStatus,
  Product,
  SourcedProductDetail,
  SourcedProductStatus,
  SourcingRequestStatus,
  WholesalerView
} from '@amalice/shared'
import { SOURCED_PRODUCT_STATUSES, adTestCpaCents, adTestRoas } from '@amalice/shared'

// Plain-string local form state for the text fields UInput/UTextarea bind
// to — the shared Create*Schema types have nullable().optional() fields
// (string | null | undefined), which UInput's v-model (string | undefined)
// rejects; blanks convert to null only when building the request body.
interface AdTestFormState {
  platform: AdTestPlatform
  priceCents: number
  creativeType: AdCreativeType | null
  creativeUrl: string
  adSpendCents: number
  ordersCount: number
  revenueCents: number
  status: AdTestStatus
  isWinner: boolean
  notes: string
}
interface RequestFormState {
  wholesalerId: string
  requestedQuantity: number
  requestedCountry: string
  unitCostCents: number | null
  status: SourcingRequestStatus
  notes: string
}

const route = useRoute()
const id = route.params.id as string
const api = useAdminApi()
const toast = useToast()

const { data: sourced, pending, refresh } = await useAdminFetch<SourcedProductDetail>(`/admin/sourcing/products/${id}`, { key: `admin-sourcing-product-${id}` })
const { data: wholesalers } = await useAdminFetch<WholesalerView[]>('/admin/sourcing/wholesalers', { key: 'admin-sourcing-wholesalers' })
const { data: products } = await useAdminFetch<{ items: Product[] }>('/products?pageSize=200', { key: 'admin-sourcing-all-products' })

useHead({ title: () => sourced.value?.name ?? 'Sourced product' })

const activeTab = ref<'overview' | 'adTests' | 'requests'>('overview')

const statusOptions = SOURCED_PRODUCT_STATUSES.map((s) => ({ label: s, value: s }))
const platformOptions: AdTestPlatform[] = ['Facebook', 'TikTok', 'Snapchat', 'Google', 'Other']
const creativeTypeOptions: AdCreativeType[] = ['Image', 'Video']
const adTestStatusOptions: AdTestStatus[] = ['Running', 'Passed', 'Failed']
const requestStatusOptions: SourcingRequestStatus[] = ['Requested', 'Confirmed', 'Shipped', 'Received', 'Cancelled']

const dzdFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'DZD' })
function formatDzd(cents: number) {
  return dzdFormatter.format(cents / 100)
}

// ---- Overview tab ----
const savingDetails = ref(false)
const form = reactive({
  name: '',
  sourceUrl: '',
  imageUrl: '',
  niche: '',
  notes: '',
  status: 'Researching' as SourcedProductStatus
})

watch(sourced, (s) => {
  if (!s) return
  Object.assign(form, {
    name: s.name,
    sourceUrl: s.sourceUrl ?? '',
    imageUrl: s.imageUrl ?? '',
    niche: s.niche ?? '',
    notes: s.notes ?? '',
    status: s.status
  })
}, { immediate: true })

async function saveDetails() {
  savingDetails.value = true
  try {
    await api(`/admin/sourcing/products/${id}`, {
      method: 'PATCH',
      body: {
        name: form.name,
        sourceUrl: form.sourceUrl || null,
        imageUrl: form.imageUrl || null,
        niche: form.niche || null,
        notes: form.notes || null,
        status: form.status
      }
    })
    await refresh()
    toast.add({ title: 'Saved', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to save', color: 'error' })
  } finally {
    savingDetails.value = false
  }
}

const linkedProductId = computed({
  get: () => sourced.value?.linkedProduct?.id ?? undefined,
  set: async (v: string | undefined) => {
    try {
      await api(`/admin/sourcing/products/${id}/link`, { method: 'POST', body: { productId: v ?? null } })
      await refresh()
      toast.add({ title: v ? 'Linked to product' : 'Unlinked', color: 'success' })
    } catch (err) {
      const data = (err as { data?: { message?: string } })?.data
      toast.add({ title: 'Failed to update link', description: data?.message, color: 'error' })
    }
  }
})

const unlinkedProducts = computed(() => (products.value?.items ?? []).filter((p) => !sourced.value?.linkedProduct || p.id === sourced.value.linkedProduct.id))

// ---- Ad tests tab ----
const showAdTestModal = ref(false)
const editingAdTestId = ref<string | null>(null)
const adTestForm = reactive<AdTestFormState>({
  platform: 'Other',
  priceCents: 0,
  creativeType: null,
  creativeUrl: '',
  adSpendCents: 0,
  ordersCount: 0,
  revenueCents: 0,
  status: 'Running',
  isWinner: false,
  notes: ''
})
const adTestPriceDzd = computed<number>({ get: () => adTestForm.priceCents / 100, set: (v) => { adTestForm.priceCents = Math.round((v ?? 0) * 100) } })
const adTestSpendDzd = computed<number>({ get: () => adTestForm.adSpendCents / 100, set: (v) => { adTestForm.adSpendCents = Math.round((v ?? 0) * 100) } })
const adTestRevenueDzd = computed<number>({ get: () => adTestForm.revenueCents / 100, set: (v) => { adTestForm.revenueCents = Math.round((v ?? 0) * 100) } })
const savingAdTest = ref(false)

function openCreateAdTest() {
  editingAdTestId.value = null
  Object.assign(adTestForm, { platform: 'Other', priceCents: 0, creativeType: null, creativeUrl: '', adSpendCents: 0, ordersCount: 0, revenueCents: 0, status: 'Running', isWinner: false, notes: '' })
  showAdTestModal.value = true
}

function openEditAdTest(t: SourcedProductDetail['adTests'][number]) {
  editingAdTestId.value = t.id
  Object.assign(adTestForm, {
    platform: t.platform,
    priceCents: t.priceCents,
    creativeType: t.creativeType,
    creativeUrl: t.creativeUrl ?? '',
    adSpendCents: t.adSpendCents,
    ordersCount: t.ordersCount,
    revenueCents: t.revenueCents,
    status: t.status,
    isWinner: t.isWinner,
    notes: t.notes ?? ''
  })
  showAdTestModal.value = true
}

async function saveAdTest() {
  savingAdTest.value = true
  try {
    const body = { ...adTestForm, creativeUrl: adTestForm.creativeUrl || null, notes: adTestForm.notes || null }
    if (editingAdTestId.value) {
      await api(`/admin/sourcing/products/ad-tests/${editingAdTestId.value}`, { method: 'PATCH', body })
    } else {
      await api(`/admin/sourcing/products/${id}/ad-tests`, { method: 'POST', body })
    }
    showAdTestModal.value = false
    await refresh()
    toast.add({ title: 'Ad test saved', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to save ad test', color: 'error' })
  } finally {
    savingAdTest.value = false
  }
}

async function deleteAdTest(testId: string) {
  try {
    await api(`/admin/sourcing/products/ad-tests/${testId}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'Ad test removed', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to remove ad test', color: 'error' })
  }
}

async function toggleWinner(t: SourcedProductDetail['adTests'][number]) {
  try {
    await api(`/admin/sourcing/products/ad-tests/${t.id}`, { method: 'PATCH', body: { isWinner: !t.isWinner } })
    await refresh()
  } catch {
    toast.add({ title: 'Failed to update', color: 'error' })
  }
}

const adTestStatusColor: Record<AdTestStatus, 'neutral' | 'success' | 'error'> = { Running: 'neutral', Passed: 'success', Failed: 'error' }

// ---- Sourcing requests tab ----
const showRequestModal = ref(false)
const editingRequestId = ref<string | null>(null)
const requestForm = reactive<RequestFormState>({
  wholesalerId: '',
  requestedQuantity: 1,
  requestedCountry: '',
  unitCostCents: null,
  status: 'Requested',
  notes: ''
})
const requestUnitCostDzd = computed<number | null>({
  get: () => (requestForm.unitCostCents == null ? null : requestForm.unitCostCents / 100),
  set: (v) => { requestForm.unitCostCents = v == null ? null : Math.round(v * 100) }
})
const savingRequest = ref(false)

function openCreateRequest() {
  editingRequestId.value = null
  Object.assign(requestForm, { wholesalerId: wholesalers.value?.[0]?.id ?? '', requestedQuantity: 1, requestedCountry: '', unitCostCents: null, status: 'Requested', notes: '' })
  showRequestModal.value = true
}

function openEditRequest(r: SourcedProductDetail['sourcingRequests'][number]) {
  editingRequestId.value = r.id
  Object.assign(requestForm, {
    wholesalerId: r.wholesaler.id,
    requestedQuantity: r.requestedQuantity,
    requestedCountry: r.requestedCountry,
    unitCostCents: r.unitCostCents,
    status: r.status,
    notes: r.notes ?? ''
  })
  showRequestModal.value = true
}

async function saveRequest() {
  if (!requestForm.wholesalerId || !requestForm.requestedCountry.trim()) return
  savingRequest.value = true
  try {
    const body = { ...requestForm, notes: requestForm.notes || null }
    if (editingRequestId.value) {
      await api(`/admin/sourcing/products/requests/${editingRequestId.value}`, { method: 'PATCH', body })
    } else {
      await api(`/admin/sourcing/products/${id}/requests`, { method: 'POST', body })
    }
    showRequestModal.value = false
    await refresh()
    toast.add({ title: 'Sourcing request saved', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to save sourcing request', color: 'error' })
  } finally {
    savingRequest.value = false
  }
}

async function deleteRequest(requestId: string) {
  try {
    await api(`/admin/sourcing/products/requests/${requestId}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'Sourcing request removed', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to remove sourcing request', color: 'error' })
  }
}

const requestStatusColor: Record<SourcingRequestStatus, 'neutral' | 'info' | 'warning' | 'success' | 'error'> = {
  Requested: 'neutral',
  Confirmed: 'info',
  Shipped: 'warning',
  Received: 'success',
  Cancelled: 'error'
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="sourced?.name ?? 'Sourced product'">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/sourcing" />
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="pending" class="py-24 text-center text-muted">Loading…</div>
      <div v-else-if="!sourced" class="py-24 text-center text-muted">Sourced product not found.</div>
      <div v-else class="max-w-4xl space-y-6">
        <UTabs
          v-model="activeTab"
          :items="[
            { label: 'Overview', value: 'overview', icon: 'i-lucide-file-text' },
            { label: 'Ad Tests', value: 'adTests', icon: 'i-lucide-megaphone' },
            { label: 'Sourcing Requests', value: 'requests', icon: 'i-lucide-truck' }
          ]"
        />

        <!-- Overview Tab -->
        <div v-show="activeTab === 'overview'" class="admin-kpi-card space-y-5 p-6">
          <UFormField label="Name"><UInput v-model="form.name" class="w-full" /></UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Status">
              <USelect v-model="form.status" :items="statusOptions" value-key="value" label-key="label" class="w-full" />
            </UFormField>
            <UFormField label="Niche"><UInput v-model="form.niche" class="w-full" /></UFormField>
          </div>
          <UFormField label="Source URL"><UInput v-model="form.sourceUrl" class="w-full" placeholder="https://…" /></UFormField>
          <UFormField label="Image URL"><UInput v-model="form.imageUrl" class="w-full" placeholder="https://…" /></UFormField>
          <UFormField label="Notes"><UTextarea v-model="form.notes" class="w-full" :rows="4" /></UFormField>

          <UFormField label="Linked storefront product" help="Once this candidate goes live, link it to its real catalog product.">
            <USelect
              v-model="linkedProductId"
              :items="[{ label: 'None', value: undefined }, ...unlinkedProducts.map((p) => ({ label: p.name, value: p.id }))]"
              class="w-full"
            />
          </UFormField>

          <div class="flex justify-end">
            <UButton :loading="savingDetails" icon="i-lucide-save" color="primary" @click="saveDetails">Save</UButton>
          </div>
        </div>

        <!-- Ad Tests Tab -->
        <div v-show="activeTab === 'adTests'" class="admin-table-wrap">
          <div class="flex items-center justify-between border-b border-[var(--color-admin-border)] p-4">
            <h3 class="text-sm font-medium text-muted">Ad tests ({{ sourced.adTests.length }})</h3>
            <UButton icon="i-lucide-plus" size="xs" color="primary" label="New ad test" @click="openCreateAdTest" />
          </div>
          <table v-if="sourced.adTests.length" class="admin-table w-full text-sm">
            <thead>
              <tr>
                <th class="px-4 py-2.5 text-left">Platform</th>
                <th class="px-4 py-2.5 text-right">Price</th>
                <th class="px-4 py-2.5 text-right">Spend</th>
                <th class="px-4 py-2.5 text-right">Orders</th>
                <th class="px-4 py-2.5 text-right">CPA</th>
                <th class="px-4 py-2.5 text-right">ROAS</th>
                <th class="px-4 py-2.5 text-left">Status</th>
                <th class="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in sourced.adTests" :key="t.id">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1.5">
                    {{ t.platform }}
                    <UIcon v-if="t.isWinner" name="i-lucide-trophy" class="size-3.5 text-warning" />
                  </div>
                </td>
                <td class="tabular px-4 py-3 text-right">{{ formatDzd(t.priceCents) }}</td>
                <td class="tabular px-4 py-3 text-right">{{ formatDzd(t.adSpendCents) }}</td>
                <td class="tabular px-4 py-3 text-right">{{ t.ordersCount }}</td>
                <td class="tabular px-4 py-3 text-right">{{ adTestCpaCents(t) == null ? '—' : formatDzd(adTestCpaCents(t)!) }}</td>
                <td class="tabular px-4 py-3 text-right">{{ adTestRoas(t) == null ? '—' : `${adTestRoas(t)!.toFixed(2)}x` }}</td>
                <td class="px-4 py-3"><UBadge :color="adTestStatusColor[t.status]" variant="subtle">{{ t.status }}</UBadge></td>
                <td class="px-4 py-3 text-right">
                  <UButton :icon="t.isWinner ? 'i-lucide-trophy' : 'i-lucide-star'" size="xs" variant="ghost" :color="t.isWinner ? 'warning' : 'neutral'" @click="toggleWinner(t)" />
                  <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" @click="openEditAdTest(t)" />
                  <UButton icon="i-lucide-trash-2" size="xs" variant="ghost" color="error" @click="deleteAdTest(t.id)" />
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else class="px-4 py-12 text-center text-sm text-muted">No ad tests yet. Click "New ad test" to log a price/creative experiment.</p>
        </div>

        <!-- Sourcing Requests Tab -->
        <div v-show="activeTab === 'requests'" class="admin-table-wrap">
          <div class="flex items-center justify-between border-b border-[var(--color-admin-border)] p-4">
            <h3 class="text-sm font-medium text-muted">Sourcing requests ({{ sourced.sourcingRequests.length }})</h3>
            <UButton icon="i-lucide-plus" size="xs" color="primary" label="New request" :disabled="!wholesalers?.length" @click="openCreateRequest" />
          </div>
          <p v-if="!wholesalers?.length" class="px-4 pb-3 text-xs text-muted">Add a wholesaler on the Sourcing list page first.</p>
          <table v-if="sourced.sourcingRequests.length" class="admin-table w-full text-sm">
            <thead>
              <tr>
                <th class="px-4 py-2.5 text-left">Wholesaler</th>
                <th class="px-4 py-2.5 text-right">Quantity</th>
                <th class="px-4 py-2.5 text-left">Country</th>
                <th class="px-4 py-2.5 text-right">Unit cost</th>
                <th class="px-4 py-2.5 text-left">Status</th>
                <th class="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in sourced.sourcingRequests" :key="r.id">
                <td class="px-4 py-3 font-medium text-highlighted">{{ r.wholesaler.name }}</td>
                <td class="tabular px-4 py-3 text-right">{{ r.requestedQuantity }}</td>
                <td class="px-4 py-3 text-muted">{{ r.requestedCountry }}</td>
                <td class="tabular px-4 py-3 text-right">{{ r.unitCostCents == null ? '—' : formatDzd(r.unitCostCents) }}</td>
                <td class="px-4 py-3"><UBadge :color="requestStatusColor[r.status]" variant="subtle">{{ r.status }}</UBadge></td>
                <td class="px-4 py-3 text-right">
                  <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" @click="openEditRequest(r)" />
                  <UButton icon="i-lucide-trash-2" size="xs" variant="ghost" color="error" @click="deleteRequest(r.id)" />
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else class="px-4 py-12 text-center text-sm text-muted">No sourcing requests yet.</p>
        </div>
      </div>

      <!-- Ad test modal -->
      <UModal v-model:open="showAdTestModal">
        <template #content>
          <div class="space-y-4 p-6">
            <h3 class="text-lg font-semibold">{{ editingAdTestId ? 'Edit' : 'New' }} ad test</h3>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Platform">
                <USelect v-model="adTestForm.platform" :items="platformOptions" class="w-full" />
              </UFormField>
              <UFormField label="Price (DZD)"><UInputNumber v-model="adTestPriceDzd" :min="0" class="w-full" /></UFormField>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Creative type">
                <USelect v-model="adTestForm.creativeType" :items="[{ label: 'None', value: null }, ...creativeTypeOptions.map((c) => ({ label: c, value: c }))]" value-key="value" label-key="label" class="w-full" />
              </UFormField>
              <UFormField label="Creative URL"><UInput v-model="adTestForm.creativeUrl" class="w-full" placeholder="https://…" /></UFormField>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <UFormField label="Ad spend (DZD)"><UInputNumber v-model="adTestSpendDzd" :min="0" class="w-full" /></UFormField>
              <UFormField label="Orders"><UInputNumber v-model="adTestForm.ordersCount" :min="0" class="w-full" /></UFormField>
              <UFormField label="Revenue (DZD)"><UInputNumber v-model="adTestRevenueDzd" :min="0" class="w-full" /></UFormField>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Status">
                <USelect v-model="adTestForm.status" :items="adTestStatusOptions" class="w-full" />
              </UFormField>
              <div class="flex items-end pb-1">
                <UCheckbox v-model="adTestForm.isWinner" label="Winning creative/price" />
              </div>
            </div>
            <UFormField label="Notes"><UTextarea v-model="adTestForm.notes" class="w-full" :rows="3" /></UFormField>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" label="Cancel" @click="showAdTestModal = false" />
              <UButton :loading="savingAdTest" label="Save" color="primary" @click="saveAdTest" />
            </div>
          </div>
        </template>
      </UModal>

      <!-- Sourcing request modal -->
      <UModal v-model:open="showRequestModal">
        <template #content>
          <div class="space-y-4 p-6">
            <h3 class="text-lg font-semibold">{{ editingRequestId ? 'Edit' : 'New' }} sourcing request</h3>
            <UFormField label="Wholesaler">
              <USelect v-model="requestForm.wholesalerId" :items="(wholesalers ?? []).map((w) => ({ label: w.name, value: w.id }))" value-key="value" label-key="label" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Requested quantity"><UInputNumber v-model="requestForm.requestedQuantity" :min="1" class="w-full" /></UFormField>
              <UFormField label="Requested country"><UInput v-model="requestForm.requestedCountry" class="w-full" /></UFormField>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Unit cost (DZD)"><UInputNumber v-model="requestUnitCostDzd" :min="0" class="w-full" /></UFormField>
              <UFormField label="Status">
                <USelect v-model="requestForm.status" :items="requestStatusOptions" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Notes"><UTextarea v-model="requestForm.notes" class="w-full" :rows="3" /></UFormField>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" label="Cancel" @click="showRequestModal = false" />
              <UButton :loading="savingRequest" :disabled="!requestForm.wholesalerId || !requestForm.requestedCountry.trim()" label="Save" color="primary" @click="saveRequest" />
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
