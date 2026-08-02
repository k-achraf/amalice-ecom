<script setup lang="ts">
import type { Product, ProductListResponse } from '@amalice/shared'

useHead({ title: 'Products' })

const route = useRoute()
const router = useRouter()
const { data: products, pending, refresh } = await useAdminFetch<ProductListResponse>('/products?pageSize=50', { key: 'admin-inventory' })
const rows = computed<Product[]>(() => products.value?.items ?? [])

const api = useAdminApi()
const toast = useToast()

const totalPages = computed(() => (products.value ? Math.ceil(products.value.total / (products.value.pageSize || 50)) : 1))
const currentPage = computed(() => Number(route.query.page ?? 1))
async function goToPage(p: number) {
  await router.push({ query: { ...route.query, page: p } })
  products.value = await api<ProductListResponse>('/products', { query: { page: String(p), pageSize: '50' } })
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
    await refresh()
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
void refresh
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
                  <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" label="Edit" :to="`/products/${p.id}`" />
                  <UButton icon="i-lucide-plus-minus" size="xs" variant="ghost" color="neutral" label="Stock" @click="openAdjust(p)" />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="totalPages > 1" class="mt-3 flex items-center justify-between">
        <p class="text-sm text-muted">{{ products?.total }} products</p>
        <UPagination v-model:page="currentPage" :total="products?.total ?? 0" :items-per-page="products?.pageSize ?? 50" @update:page="goToPage" />
      </div>

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
