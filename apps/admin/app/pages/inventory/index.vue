<script setup lang="ts">
import type { Product, ProductListResponse, ProductLandingPage } from '@amalice/shared'

useHead({ title: 'Products' })

const runtimeConfig = useRuntimeConfig()

const route = useRoute()
const router = useRouter()
const currentPage = computed(() => Number(route.query.page ?? 1))
const currentPageSize = computed(() => Number(route.query.pageSize ?? 50))

const { data: products, pending } = await useAdminFetch<ProductListResponse>('/products', {
  key: 'admin-inventory',
  query: { page: route.query.page ?? '1', pageSize: route.query.pageSize ?? '50' }
})
const rows = computed<Product[]>(() => products.value?.items ?? [])

const api = useAdminApi()
const toast = useToast()

async function loadProducts() {
  products.value = await api<ProductListResponse>('/products', {
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
  if (!adjusting.value || adjustDelta.value === 0) return
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
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Products">
        <template #leading><UDashboardSidebarCollapse /></template>
        <template #right>
          <UButton icon="i-lucide-plus" size="sm" label="New product" @click="openCreate" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="admin-table-wrap">
        <table class="admin-table w-full text-sm">
          <thead>
            <tr>
              <th class="px-4 py-2.5 text-left">Product</th>
              <th class="px-4 py-2.5 text-left">Category</th>
              <th class="px-4 py-2.5 text-right">Price</th>
              <th class="px-4 py-2.5 text-right">Stock</th>
              <th class="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pending"><td colspan="5" class="px-4 py-12 text-center text-muted">Loading…</td></tr>
            <tr v-else-if="!rows.length"><td colspan="5" class="px-4 py-12 text-center text-muted">No products yet. Click "New product" to create one.</td></tr>
            <template v-else>
              <tr v-for="p in rows" :key="p.id" class="cursor-pointer hover:bg-[var(--color-admin-row-hover)]" @click="router.push(`/products/${p.id}`)">
                <td class="px-4 py-3 font-medium text-highlighted">
                  <NuxtLink :to="`/products/${p.id}`" class="hover:underline" @click.stop>{{ p.name }}</NuxtLink>
                </td>
                <td class="px-4 py-3 text-muted">{{ p.category ?? '—' }}</td>
                <td class="tabular px-4 py-3 text-right"><PriceDisplay :amount-cents="p.priceCents" /></td>
                <td class="tabular px-4 py-3 text-right">
                  <UBadge :color="stockState(p) === 'out' ? 'error' : stockState(p) === 'low' ? 'warning' : 'success'" variant="subtle">{{ p.stockQuantity }}</UBadge>
                </td>
                <td class="px-4 py-3 text-right" @click.stop>
                  <UPopover :open="previewOpenId === p.id" @update:open="(v: boolean) => onPreviewToggle(p, v)">
                    <UButton icon="i-lucide-eye" size="xs" variant="ghost" color="neutral" label="Preview" />
                    <template #content>
                      <div class="w-72 space-y-1 p-3">
                        <p class="px-1 text-xs font-medium uppercase text-muted">Preview</p>
                        <a :href="productPageUrl(p)" target="_blank" rel="noopener" class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--color-admin-row-hover)]">
                          <UIcon name="i-lucide-package" class="size-4 shrink-0 text-muted" />
                          <span class="flex-1 truncate">Product page</span>
                          <UIcon name="i-lucide-external-link" class="size-3.5 shrink-0 text-muted" />
                        </a>

                        <div v-if="previewLandingPages[p.id] === 'loading'" class="px-2 py-3 text-center text-xs text-muted">Loading…</div>
                        <div v-else-if="previewLandingPages[p.id] === 'error'" class="px-2 py-3 text-center text-xs text-error">Failed to load landing pages</div>
                        <template v-else-if="Array.isArray(previewLandingPages[p.id]) && (previewLandingPages[p.id] as ProductLandingPage[]).length">
                          <p class="mt-2 px-1 text-xs font-medium uppercase text-muted">Landing pages</p>
                          <a
                            v-for="lp in previewLandingPages[p.id] as ProductLandingPage[]"
                            :key="lp.id"
                            :href="landingPageUrl(p, lp)"
                            target="_blank"
                            rel="noopener"
                            class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--color-admin-row-hover)]"
                          >
                            <UIcon name="i-lucide-image" class="size-4 shrink-0 text-muted" />
                            <span class="flex-1 truncate">{{ lp.name }}</span>
                            <UBadge v-if="lp.status !== 'Completed' || !lp.enabled" size="xs" color="neutral" variant="subtle">
                              {{ lp.status !== 'Completed' ? lp.status : 'Hidden' }}
                            </UBadge>
                            <UIcon name="i-lucide-external-link" class="size-3.5 shrink-0 text-muted" />
                          </a>
                        </template>
                        <p v-else class="px-2 py-3 text-center text-xs text-muted">No landing pages yet</p>
                      </div>
                    </template>
                  </UPopover>
                  <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" label="Edit" :to="`/products/${p.id}`" />
                  <UButton icon="i-lucide-plus-minus" size="xs" variant="ghost" color="neutral" label="Stock" @click="openAdjust(p)" />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <AdminPagination
        class="mt-3"
        :total="products?.total ?? 0"
        :page="currentPage"
        :page-size="currentPageSize"
        item-label="products"
        @update:page="goToPage"
        @update:page-size="changePageSize"
      />

      <!-- Quick-create modal -->
      <UModal v-model:open="showCreate">
        <template #content>
          <div class="space-y-4 p-6">
            <h3 class="text-lg font-semibold">New product</h3>
            <p class="text-sm text-muted">Create a product, then edit its details, variants, and images in the full editor.</p>
            <UFormField label="Name"><UInput v-model="newName" placeholder="e.g. Cotton T-Shirt" class="w-full" @update:model-value="onNameInput" /></UFormField>
            <UFormField label="Slug"><UInput v-model="newSlug" placeholder="cotton-t-shirt" class="w-full" /></UFormField>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" label="Cancel" @click="showCreate = false" />
              <UButton :loading="creating" :disabled="!newName || !newSlug" label="Create & edit" color="primary" @click="createProduct" />
            </div>
          </div>
        </template>
      </UModal>

      <!-- Stock adjustment modal (kept inline for convenience) -->
      <UModal v-model:open="showAdjust">
        <template #content>
          <div v-if="adjusting" class="space-y-4 p-6">
            <h3 class="text-lg font-semibold">Adjust stock — {{ adjusting.name }}</h3>
            <p class="text-sm text-muted">Current: <span class="tabular font-medium">{{ adjusting.stockQuantity }}</span></p>
            <UFormField label="Change (negative for stock-out)"><UInputNumber v-model="adjustDelta" class="w-full" /></UFormField>
            <UFormField label="Reason"><USelect v-model="adjustReason" :items="['Restock', 'Correction', 'Damage', 'Sale', 'Return']" class="w-full" /></UFormField>
            <UFormField label="Note (optional)"><UInput v-model="adjustNote" class="w-full" /></UFormField>
            <p class="text-sm">New stock: <span class="tabular font-medium">{{ adjusting.stockQuantity + adjustDelta }}</span></p>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" label="Cancel" @click="adjusting = null" />
              <UButton :loading="savingAdjust" :disabled="adjustDelta === 0" label="Save" color="primary" @click="saveAdjust" />
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
