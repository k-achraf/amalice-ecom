<script setup lang="ts">

import type { Product, ProductListResponse, ProductLandingPage } from '@amalice/shared'

useHead({ title: 'Products' })

const runtimeConfig = useRuntimeConfig()

const route = useRoute()
const router = useRouter()
const currentPage = computed(() => Number(route.query.page ?? 1))
const currentPageSize = computed(() => Number(route.query.pageSize ?? 50))

const { data: products, pending, refresh: refreshProducts } = await useAdminFetch<ProductListResponse>('/admin/products', {
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
const adjustSupplier = ref<string | null>(null)
const adjustVariantId = ref<string | null>(null)
const savingAdjust = ref(false)

interface SupplierOpt { id: string; name: string; active: boolean }
interface LowVariant { variantId: string; sku: string; stockQuantity: number; productId: string; productName: string; lowStockThreshold: number }
const { data: suppliers } = await useAdminFetch<SupplierOpt[]>('/admin/suppliers', { key: 'admin-suppliers-opts' })
const supplierItems = computed(() => [{ label: 'No supplier', value: null }, ...(suppliers.value ?? []).filter((s) => s.active).map((s) => ({ label: s.name, value: s.id }))])
const showAllVariants = ref(false)
const { data: lowVariants, refresh: refreshLowVariants } = await useAdminFetch<LowVariant[]>('/admin/inventory/low-stock-variants', { key: 'admin-low-variants' })

// Variant alert rows reuse the same dialog, targeting the variant's own stock.
function openAdjustVariant(v: LowVariant) {
  const p = rows.value.find((r) => r.id === v.productId)
  openAdjust(p ?? ({ id: v.productId, name: `${v.productName} · ${v.sku}`, stockQuantity: v.stockQuantity } as Product))
  adjusting.value = { ...(adjusting.value as Product), name: `${v.productName} · ${v.sku}`, stockQuantity: v.stockQuantity }
  adjustVariantId.value = v.variantId
}

function openAdjust(p: Product) {
  adjusting.value = p
  adjustDelta.value = 0
  adjustReason.value = 'Restock'
  adjustNote.value = ''
  adjustSupplier.value = null
  adjustVariantId.value = null
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
      body: { delta: adjustDelta.value, reason: adjustReason.value, note: adjustNote.value || undefined, variantId: adjustVariantId.value ?? undefined, supplierId: adjustReason.value === 'Restock' ? adjustSupplier.value ?? undefined : undefined }
    })
    adjusting.value = null
    await Promise.all([loadProducts(), refreshLowVariants()])
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
const stockFilter = ref('')
const catFilter = ref('All')
const categories = computed(() => ['All', ...new Set(rows.value.map((p) => p.category).filter((c): c is string => !!c))])
const search = ref('')
const kpiLow = computed(() => rows.value.filter((p) => stockState(p) === 'low').length)
const kpiOut = computed(() => rows.value.filter((p) => stockState(p) === 'out').length)
const kpiUnits = computed(() => rows.value.reduce((n, p) => n + p.stockQuantity, 0))
const visibleRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return rows.value.filter((p) => {
    const okStatus = !stockFilter.value || (stockFilter.value === 'hidden' ? !p.visible : stockState(p) === stockFilter.value)
    return (catFilter.value === 'All' || p.category === catFilter.value) && okStatus && (!q || `${p.name} ${p.slug}`.toLowerCase().includes(q))
  })
})
const STOCK_PILL = { ok: { cls: 'instock', label: 'In stock', color: 'var(--teal)' }, low: { cls: 'low', label: 'Low stock', color: 'var(--brass)' }, out: { cls: 'out', label: 'Out of stock', color: 'var(--danger)' } } as const
function stockPct(p: Product) { return p.stockQuantity ? Math.max(4, Math.min(100, Math.round((p.stockQuantity / 150) * 100))) : 0 }

// ---- Bulk select + permanent delete (SuperAdmin only) ----
const { isSuperAdmin } = useDangerDelete()
const { selected: selIds, allChecked: selAll, indeterminate: selSome, toggleAll: selToggleAll, toggle: selToggle, clear: selClear, count: selCount } = useBulkSelect(visibleRows)
const { bulkDelete, busy: bulkBusy } = useBulkDelete()
const bulkApi = useAdminApi()

async function deleteSelected() {
  const deleted = await bulkDelete([...selIds.value], { noun: 'product', remove: (id) => bulkApi(`/admin/products/__ID__`.replace('__ID__', id), { method: 'DELETE' }) })
  if (deleted.length) {
    selClear()
    await refreshProducts()
  }
}
</script>

<template>
  <AdsPage title="Products" :description="`${products?.total ?? rows.length} products · Catalogue and inventory`">
    <template #actions>
      <NuxtLink class="btn" to="/inventory/stocktake"><AdsIcon name="i-lucide-boxes" />Stocktake</NuxtLink>
      <NuxtLink class="btn" to="/inventory/suppliers">Suppliers</NuxtLink>
      <button class="btn btn-primary" type="button" @click="openCreate"><AdsIcon name="i-lucide-plus" />Add product</button>
    </template>

    <section class="kpis" aria-label="Inventory summary">
      <AdsKpiCard label="Products" :value="products?.total ?? rows.length" meta="In the catalogue" />
      <AdsKpiCard label="Units in stock" :value="kpiUnits.toLocaleString('en-US')" meta="On this page" />
      <AdsKpiCard label="Low stock" :value="kpiLow" color="warning" meta="At or under the alert threshold" />
      <AdsKpiCard label="Out of stock" :value="kpiOut" color="error" meta="No units left" />
    </section>

    <section v-if="lowVariants?.length" class="card" aria-label="Low-stock variants">
      <div class="card-head"><h2 class="strong">Variants running low ({{ lowVariants.length }})</h2></div>
      <div class="table-wrap">
        <table style="min-width: 520px">
          <thead><tr><th>Product</th><th>SKU</th><th class="num">Stock</th><th><span class="sr">Actions</span></th></tr></thead>
          <tbody>
            <tr v-for="v in showAllVariants ? lowVariants : lowVariants.slice(0, 8)" :key="v.variantId">
              <td><NuxtLink :to="`/products/${v.productId}`" class="strong" style="text-decoration: none; color: var(--pine)">{{ v.productName }}</NuxtLink></td>
              <td>{{ v.sku }}</td>
              <td class="num"><span class="pill" :class="v.stockQuantity <= 0 ? 'out' : 'low'">{{ v.stockQuantity }}</span></td>
              <td class="num"><button class="row-btn" type="button" :aria-label="`Adjust stock for ${v.sku}`" title="Adjust stock" @click="openAdjustVariant(v)"><AdsIcon name="i-lucide-boxes" /></button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="lowVariants.length > 8" class="card-head"><button class="btn sm" type="button" @click="showAllVariants = !showAllVariants">{{ showAllVariants ? 'Show fewer' : `Show all ${lowVariants.length}` }}</button></div>
    </section>

    <section class="card" aria-label="Product list">
      <div class="card-head">
        <AdsTabs v-model="catFilter" :items="categories.map((c) => ({ label: c, value: c }))" />
        <select v-model="stockFilter" class="select sm" aria-label="Filter by status" style="width: auto">
          <option value="">All statuses</option>
          <option value="ok">In stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
          <option value="hidden">Hidden from catalogue</option>
        </select>
        <AdsSearch v-model="search" soft placeholder="Name or slug" label="Search products" />
      </div>
      <BulkBar v-if="isSuperAdmin" :count="selCount" :busy="bulkBusy" can-delete @delete="deleteSelected" @clear="selClear" />
      <div class="table-wrap">
        <table style="min-width: 860px">
          <thead><tr><th v-if="isSuperAdmin" style="width: 28px"><input type="checkbox" aria-label="Select all" :checked="selAll" :indeterminate="selSome" @change="selToggleAll(($event.target as HTMLInputElement).checked)"></th><th>Product</th><th>Category</th><th class="num">Price</th><th>Stock</th><th>Status</th><th><span class="sr">Actions</span></th></tr></thead>
          <tbody>
            <tr v-if="pending"><td :colspan="6 + (isSuperAdmin ? 1 : 0)" class="empty">Loading…</td></tr>
            <tr v-else-if="!visibleRows.length"><td :colspan="6 + (isSuperAdmin ? 1 : 0)" class="empty">{{ rows.length ? 'No products match this filter.' : 'No products yet. Click "New product" to create one.' }}</td></tr>
            <template v-else>
              <tr v-for="p in visibleRows" :key="p.id" style="cursor: pointer" @click="router.push(`/products/${p.id}`)"><td v-if="isSuperAdmin" @click.stop><input type="checkbox" :aria-label="`Select ${p.name}`" :checked="selIds.has(p.id)" @change="selToggle(p.id, ($event.target as HTMLInputElement).checked)"></td>
                <td>
                  <div class="prod">
                    <span class="thumb"><AdsIcon name="i-lucide-package" /></span>
                    <span>
                      <NuxtLink :to="`/inventory/${p.id}`" class="strong" style="text-decoration: none; color: var(--pine)" @click.stop>{{ p.name }}</NuxtLink>
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
                <td><span v-if="!p.visible" class="pill draft">Hidden</span><span v-else class="pill" :class="STOCK_PILL[stockState(p)].cls">{{ STOCK_PILL[stockState(p)].label }}</span></td>
                <td class="num" style="white-space: nowrap" @click.stop>
                  <AdsPopover :open="previewOpenId === p.id" @update:open="(v: boolean) => onPreviewToggle(p, v)">
                    <button class="row-btn" type="button" aria-label="Preview" title="Preview"><AdsIcon name="i-lucide-eye" /></button>
                    <template #content>
                      <div style="width: 288px; display: flex; flex-direction: column; gap: 2px">
                        <p class="muted" style="padding: 8px 12px 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .14em; font-weight: 600">Preview</p>
                        <a :href="productPageUrl(p)" target="_blank" rel="noopener" style="display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 12px; border-radius: var(--r); text-decoration: none; color: var(--pine)">
                          <AdsIcon name="i-lucide-package" /><span style="flex: 1" class="truncate">Product page</span><AdsIcon name="i-lucide-external-link" style="width: 16px; height: 16px" />
                        </a>
                        <div v-if="previewLandingPages[p.id] === 'loading'" class="empty" style="padding: 12px">Loading…</div>
                        <div v-else-if="previewLandingPages[p.id] === 'error'" class="empty" style="padding: 12px; color: var(--danger-fg)">Failed to load landing pages</div>
                        <template v-else-if="Array.isArray(previewLandingPages[p.id]) && (previewLandingPages[p.id] as ProductLandingPage[]).length">
                          <p class="muted" style="padding: 8px 12px 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .14em; font-weight: 600">Landing pages</p>
                          <a v-for="lp in previewLandingPages[p.id] as ProductLandingPage[]" :key="lp.id" :href="landingPageUrl(p, lp)" target="_blank" rel="noopener" style="display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 12px; border-radius: var(--r); text-decoration: none; color: var(--pine)">
                            <AdsIcon name="i-lucide-image" /><span style="flex: 1" class="truncate">{{ lp.name }}</span>
                            <span v-if="lp.status !== 'Completed' || !lp.enabled" class="pill newcust">{{ lp.status !== 'Completed' ? lp.status : 'Hidden' }}</span>
                            <AdsIcon name="i-lucide-external-link" style="width: 16px; height: 16px" />
                          </a>
                        </template>
                        <p v-else class="empty" style="padding: 12px">No landing pages yet</p>
                      </div>
                    </template>
                  </AdsPopover>
                  <NuxtLink class="row-btn" :to="`/inventory/${p.id}`" :aria-label="`Stock details for ${p.name}`" title="Stock details"><AdsIcon name="i-lucide-bar-chart-3" /></NuxtLink>
                  <NuxtLink class="row-btn" :to="`/products/${p.id}`" :aria-label="`Edit ${p.name}`" title="Edit"><AdsIcon name="i-lucide-pencil" /></NuxtLink>
                  <button class="row-btn" type="button" :aria-label="`Adjust stock for ${p.name}`" title="Adjust stock" @click="openAdjust(p)"><AdsIcon name="i-lucide-boxes" /></button>
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
  <AdsDialog v-model:open="showCreate" title="New product" description="Create a product, then edit its details, variants, and images in the full editor." width="sm">
    <AdsField label="Name"><AdsInput v-model="newName" placeholder="e.g. Cotton T-Shirt" @update:model-value="onNameInput" /></AdsField>
    <AdsField label="Slug"><AdsInput v-model="newSlug" placeholder="cotton-t-shirt" /></AdsField>
    <template #footer>
      <button class="btn" type="button" @click="showCreate = false">Cancel</button>
      <AdsButton :loading="creating" :disabled="!newName || !newSlug" label="Create & edit" @click="createProduct" />
    </template>
  </AdsDialog>

  <!-- Stock adjustment modal (kept inline for convenience) -->
  <AdsDialog v-model:open="showAdjust" :title="`Adjust stock — ${adjusting?.name ?? ''}`" width="sm">
    <template v-if="adjusting">
      <p class="muted">Current stock: <b>{{ adjusting.stockQuantity }}</b></p>
      <AdsField label="Change (negative for stock-out)"><AdsNumberInput v-model="adjustDelta" /></AdsField>
      <AdsField label="Reason"><AdsSelect v-model="adjustReason" :items="['Restock', 'Correction', 'Damage', 'Sale', 'Return']" /></AdsField>
      <AdsField v-if="adjustReason === 'Restock'" label="Supplier (optional)"><AdsSelect v-model="adjustSupplier" :items="supplierItems" /></AdsField>
      <AdsField label="Note (optional)"><AdsInput v-model="adjustNote" /></AdsField>
      <p>New stock: <b>{{ adjusting.stockQuantity + adjustDelta }}</b></p>
    </template>
    <template #footer>
      <button class="btn" type="button" @click="adjusting = null">Cancel</button>
      <AdsButton :loading="savingAdjust" label="Save" @click="saveAdjust" />
    </template>
  </AdsDialog>
</AdsPage>
</template>
