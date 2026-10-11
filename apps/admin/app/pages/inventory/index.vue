<script setup lang="ts">

import type { Product, ProductListResponse, ProductLandingPage } from '@amalice/shared'

useHead({ title: 'Products & stock' })

const runtimeConfig = useRuntimeConfig()

const route = useRoute()
const router = useRouter()
const currentPage = computed(() => Number(route.query.page ?? 1))
const currentPageSize = computed(() => Number(route.query.pageSize ?? 50))

const { data: products, pending } = await useAdminFetch<ProductListResponse>('/admin/products', {
  key: 'admin-inventory',
  query: { page: route.query.page ?? '1', pageSize: route.query.pageSize ?? '50' }
})
const rows = computed<Product[]>(() => products.value?.items ?? [])

const api = useAdminApi()
const toast = useToast()

async function loadProducts() {
  products.value = await api<ProductListResponse>('/admin/products', {
    query: { page: String(currentPage.value), pageSize: String(currentPageSize.value) }
  })
}

async function goToPage(p: number) {
  await router.push({ query: { ...route.query, page: p } })
  await loadProducts()
}

async function changePageSize(size: number) {
  await router.push({ query: { ...route.query, pageSize: size, page: 1 } })
  await loadProducts()
}

// Quick-create product → redirect to the full editor
const showCreate = ref(false)
const newName = ref('')
const newSlug = ref('')
const creating = ref(false)

function openCreate() {
  newName.value = ''
  newSlug.value = ''
  showCreate.value = true
}

function onNameInput() {
  // auto-generate slug from name
  if (!newSlug.value || newSlug.value === newName.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')) {
    newSlug.value = newName.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }
}

async function createProduct() {
  if (!newName.value || !newSlug.value) return
  creating.value = true
  try {
    const created = await api<Product>('/admin/products', {
      method: 'POST',
      body: { name: newName.value, slug: newSlug.value, priceCents: 0, stockQuantity: 0, lowStockThreshold: 5, featured: false, bestSeller: false }
    })
    showCreate.value = false
    await router.push(`/products/${created.id}`)
  } catch {
    toast.add({ title: 'Failed to create product', color: 'error' })
  } finally {
    creating.value = false
  }
}

// Inline stock adjustment (kept from the original inventory page)
const adjusting = ref<Product | null>(null)
const adjustDelta = ref(0)
const adjustReason = ref<'Restock' | 'Correction' | 'Damage' | 'Sale' | 'Return'>('Restock')
const adjustNote = ref('')
const savingAdjust = ref(false)

function openAdjust(p: Product) {
  adjusting.value = p
  adjustDelta.value = 0
  adjustReason.value = 'Restock'
  adjustNote.value = ''
}

const showAdjust = computed({
  get: () => adjusting.value !== null,
  set: (v) => { if (!v) adjusting.value = null }
})

async function saveAdjust() {
  if (!adjusting.value) return
  // Not :disabled on the button — UInputNumber (Reka UI's NumberField) only
  // commits its typed value to v-model on blur/Enter, not on every
  // keystroke, so a disabled-until-nonzero button stays disabled through
  // the first click after typing (that click's mousedown does blur the
  // input and commit the value, but the click itself never reaches this
  // handler because the button was still disabled at that instant) — the
  // user has to click twice. Guarding here instead means the button is
  // always clickable and this runs with whatever the input already
  // committed by the time of the click.
  if (adjustDelta.value === 0) {
    toast.add({ title: 'Enter a non-zero change first', color: 'warning' })
    return
  }
  savingAdjust.value = true
  try {
    await api(`/admin/products/${adjusting.value.id}/stock`, {
      method: 'POST',
      body: { delta: adjustDelta.value, reason: adjustReason.value, note: adjustNote.value || undefined }
    })
    adjusting.value = null
    await loadProducts()
    toast.add({ title: 'Stock adjusted', color: 'success' })
  } finally {
    savingAdjust.value = false
  }
}

function stockState(p: Product): 'out' | 'low' | 'ok' {
  if (p.stockQuantity === 0) return 'out'
  if (p.stockQuantity <= p.lowStockThreshold) return 'low'
  return 'ok'
}

// Preview popover — normal product page (always available) + any AI landing
// pages for this product (fetched lazily on open, one product's worth at a
// time — the inventory list itself has no landing-page data in its row
// projection, and eagerly fetching per-row on page load would be N+1).
const previewOpenId = ref<string | null>(null)
const previewLandingPages = ref<Record<string, ProductLandingPage[] | 'loading' | 'error'>>({})

function productPageUrl(p: Product): string {
  return `${runtimeConfig.public.storefrontBase}/products/${p.slug}`
}
function landingPageUrl(p: Product, lp: ProductLandingPage): string {
  return `${runtimeConfig.public.storefrontBase}/lp/${p.slug}/${lp.number}`
}

async function onPreviewToggle(p: Product, open: boolean) {
  previewOpenId.value = open ? p.id : null
  if (!open || previewLandingPages.value[p.id]) return
  previewLandingPages.value[p.id] = 'loading'
  try {
    previewLandingPages.value[p.id] = await api<ProductLandingPage[]>(`/admin/products/${p.id}/landing-pages`)
  } catch {
    previewLandingPages.value[p.id] = 'error'
  }
}

// ---- Design-style list chrome: stock filter chips + soft search (client-side
// over the loaded page; the list endpoint has no search/filter params). ----
const stockFilter = ref('all')
const search = ref('')
const kpiLow = computed(() => rows.value.filter((p) => stockState(p) === 'low').length)
const kpiOut = computed(() => rows.value.filter((p) => stockState(p) === 'out').length)
const kpiUnits = computed(() => rows.value.reduce((n, p) => n + p.stockQuantity, 0))
const stockTabs = computed(() => [
  { label: 'All', value: 'all', count: rows.value.length },
  { label: 'In stock', value: 'ok', count: rows.value.length - kpiLow.value - kpiOut.value },
  { label: 'Low stock', value: 'low', count: kpiLow.value },
  { label: 'Out of stock', value: 'out', count: kpiOut.value }
])
const visibleRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return rows.value.filter((p) => (stockFilter.value === 'all' || stockState(p) === stockFilter.value) && (!q || `${p.name} ${p.slug}`.toLowerCase().includes(q)))
})
const STOCK_PILL = { ok: { cls: 'instock', label: 'In stock', color: 'var(--teal)' }, low: { cls: 'low', label: 'Low stock', color: 'var(--brass)' }, out: { cls: 'out', label: 'Out of stock', color: 'var(--danger)' } } as const
function stockPct(p: Product) { return p.stockQuantity ? Math.max(4, Math.min(100, Math.round((p.stockQuantity / 150) * 100))) : 0 }
</script>

<template>
  <AdsPage title="Products & stock" description="Catalogue and inventory">
    <template #actions>
      <AdsButton appearance="primary" icon="i-lucide-plus" aria-label="New product" @click="openCreate">New product</AdsButton>
    </template>

    <section class="kpis" aria-label="Inventory summary">
      <AdsKpiCard label="Products" :value="products?.total ?? rows.length" meta="In the catalogue" />
      <AdsKpiCard label="Units in stock" :value="kpiUnits.toLocaleString('en-US')" meta="On this page" />
      <AdsKpiCard label="Low stock" :value="kpiLow" color="warning" meta="At or under the alert threshold" />
      <AdsKpiCard label="Out of stock" :value="kpiOut" color="error" meta="No units left" />
    </section>

    <section class="card" aria-label="Product list">
      <div class="card-head">
        <AdsTabs v-model="stockFilter" :items="stockTabs" />
        <AdsSearch v-model="search" soft placeholder="Name or slug" label="Search products" />
      </div>
      <div class="table-wrap">
        <table style="min-width: 860px">
          <thead><tr><th>Product</th><th>Category</th><th class="num">Price</th><th>Stock</th><th>Status</th><th><span class="sr">Actions</span></th></tr></thead>
          <tbody>
            <tr v-if="pending"><td colspan="6" class="empty">Loading…</td></tr>
            <tr v-else-if="!visibleRows.length"><td colspan="6" class="empty">{{ rows.length ? 'No products match this filter.' : 'No products yet. Click "New product" to create one.' }}</td></tr>
            <template v-else>
              <tr v-for="p in visibleRows" :key="p.id" style="cursor: pointer" @click="router.push(`/products/${p.id}`)">
                <td>
                  <div class="prod">
                    <span class="thumb"><AdsIcon name="i-lucide-package" /></span>
                    <span>
                      <NuxtLink :to="`/products/${p.id}`" class="strong" style="text-decoration: none; color: var(--pine)" @click.stop>{{ p.name }}</NuxtLink>
                      <span class="sub">{{ p.slug }}<template v-if="!p.visible"> · Hidden from catalog</template></span>
                    </span>
                  </div>
                </td>
                <td>{{ p.category ?? '—' }}</td>
                <td class="num strong"><AdsPrice :amount-cents="p.priceCents" /></td>
                <td>
                  <div class="stock">
                    <div class="track"><div :style="{ width: stockPct(p) + '%', background: STOCK_PILL[stockState(p)].color }" /></div>
                    <span>{{ p.stockQuantity }} units</span>
                  </div>
                </td>
                <td><span class="pill" :class="STOCK_PILL[stockState(p)].cls">{{ STOCK_PILL[stockState(p)].label }}</span></td>
                <td class="num" style="white-space: nowrap" @click.stop>
                  <AdsPopover :open="previewOpenId === p.id" @update:open="(v: boolean) => onPreviewToggle(p, v)">
                    <AdsButton appearance="default" size="sm" label="Preview" icon="i-lucide-eye" />
                    <template #content>
                      <div style="width: 288px; display: flex; flex-direction: column; gap: 2px">
                        <p class="menu-label">Preview</p>
                        <a :href="productPageUrl(p)" target="_blank" rel="noopener" class="menu-item" style="text-decoration: none">
                          <AdsIcon name="i-lucide-package" /><span style="flex: 1" class="truncate">Product page</span><AdsIcon name="i-lucide-external-link" style="width: 16px; height: 16px" />
                        </a>
                        <div v-if="previewLandingPages[p.id] === 'loading'" class="empty" style="padding: 12px">Loading…</div>
                        <div v-else-if="previewLandingPages[p.id] === 'error'" class="empty" style="padding: 12px; color: var(--danger-fg)">Failed to load landing pages</div>
                        <template v-else-if="Array.isArray(previewLandingPages[p.id]) && (previewLandingPages[p.id] as ProductLandingPage[]).length">
                          <p class="menu-label">Landing pages</p>
                          <a v-for="lp in previewLandingPages[p.id] as ProductLandingPage[]" :key="lp.id" :href="landingPageUrl(p, lp)" target="_blank" rel="noopener" class="menu-item" style="text-decoration: none">
                            <AdsIcon name="i-lucide-image" /><span style="flex: 1" class="truncate">{{ lp.name }}</span>
                            <span v-if="lp.status !== 'Completed' || !lp.enabled" class="pill newcust">{{ lp.status !== 'Completed' ? lp.status : 'Hidden' }}</span>
                            <AdsIcon name="i-lucide-external-link" style="width: 16px; height: 16px" />
                          </a>
                        </template>
                        <p v-else class="empty" style="padding: 12px">No landing pages yet</p>
                      </div>
                    </template>
                  </AdsPopover>
                  <AdsButton appearance="default" size="sm" label="Edit" :to="`/products/${p.id}`" />
                  <AdsButton appearance="default" size="sm" label="Stock" @click="openAdjust(p)" />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <AdsPagination
        :total="products?.total ?? 0"
        :page="currentPage"
        :page-size="currentPageSize"
        item-label="products"
        @update:page="goToPage"
        @update:page-size="changePageSize"
      />
    </section>

  <!-- Quick-create modal -->
  <AdsModal v-model:open="showCreate">
    <template #content>
      <div style="padding: 24px; display: flex; flex-direction: column; gap: 16px">
        <h2 style="font-size: 20px">New product</h2>
        <p class="muted" style="margin: 0">Create a product, then edit its details, variants, and images in the full editor.</p>
        <AdsField label="Name"><AdsInput v-model="newName" placeholder="e.g. Cotton T-Shirt" class="w-full" @update:model-value="onNameInput" /></AdsField>
        <AdsField label="Slug"><AdsInput v-model="newSlug" placeholder="cotton-t-shirt" class="w-full" /></AdsField>
        <div class="flex justify-end gap-2">
          <AdsButton color="neutral" variant="ghost" label="Cancel" @click="showCreate = false" />
          <AdsButton :loading="creating" :disabled="!newName || !newSlug" label="Create & edit" color="primary" @click="createProduct" />
        </div>
      </div>
    </template>
  </AdsModal>

  <!-- Stock adjustment modal (kept inline for convenience) -->
  <AdsModal v-model:open="showAdjust">
    <template #content>
      <div v-if="adjusting" style="padding: 24px; display: flex; flex-direction: column; gap: 16px">
        <h2 style="font-size: 20px">Adjust stock — {{ adjusting.name }}</h2>
        <p class="muted" style="margin: 0">Current: <span class="tabular font-medium">{{ adjusting.stockQuantity }}</span></p>
        <AdsField label="Change (negative for stock-out)"><AdsNumberInput v-model="adjustDelta" class="w-full" /></AdsField>
        <AdsField label="Reason"><AdsSelect v-model="adjustReason" :items="['Restock', 'Correction', 'Damage', 'Sale', 'Return']" class="w-full" /></AdsField>
        <AdsField label="Note (optional)"><AdsInput v-model="adjustNote" class="w-full" /></AdsField>
        <p class="text-sm">New stock: <span class="tabular font-medium">{{ adjusting.stockQuantity + adjustDelta }}</span></p>
        <div class="flex justify-end gap-2">
          <AdsButton color="neutral" variant="ghost" label="Cancel" @click="adjusting = null" />
          <AdsButton :loading="savingAdjust" label="Save" color="primary" @click="saveAdjust" />
        </div>
      </div>
    </template>
  </AdsModal>
</AdsPage>
</template>
