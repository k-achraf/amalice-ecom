<script setup lang="ts">
import type { AdminProductDetail, Category } from '@amalice/shared'

// Full product editor — tabbed sections for Details, Variants, Images, Inventory.
// Each tab manages its own CRUD via the admin API. The product detail (with
// variants/options/images/attributes) is loaded once and refreshed on mutation.
const route = useRoute()
const router = useRouter()
const id = route.params.id as string
useHead({ title: 'Edit product' })

const api = useAdminApi()
const toast = useToast()
const runtimeConfig = useRuntimeConfig()

// Resolve image URLs: local uploads (stored as /uploads/xxx.jpg) are relative
// to the API server, so prepend the API base for the admin SPA.
function resolveImgUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${runtimeConfig.public.apiBase}${url}`
}

const { data: product, pending, refresh } = await useAdminFetch<AdminProductDetail>(`/admin/products/${id}`, {
  key: `admin-product-${id}`
})

const { data: categories } = await useAdminFetch<Category[]>('/categories', { key: 'admin-all-categories' })
const { data: allAttributes } = await useAdminFetch<{ id: string; name: string; type: string; options: { id: string; value: string; colorHex: string | null }[] }[]>('/admin/attributes', { key: 'admin-attributes' })

const activeTab = ref<'details' | 'variants' | 'images' | 'inventory'>('details')

// ---- Details tab ----
const savingDetails = ref(false)
async function saveDetails() {
  if (!product.value) return
  savingDetails.value = true
  try {
    await api(`/admin/products/${id}`, {
      method: 'PATCH',
      body: {
        name: product.value.name,
        slug: product.value.slug,
        description: product.value.description ?? undefined,
        categoryId: product.value.categoryId ?? undefined,
        priceCents: product.value.priceCents,
        lowStockThreshold: product.value.lowStockThreshold,
        featured: product.value.featured,
        bestSeller: product.value.bestSeller
      }
    })
    toast.add({ title: 'Product details saved', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Failed to save', color: 'error' })
  } finally {
    savingDetails.value = false
  }
}

// ---- Variants tab ----
const showVariantModal = ref(false)
const editingVariant = ref<{ sku: string; priceCents: number; stockQuantity: number; optionIds: string[]; id?: string } | null>(null)

function openCreateVariant() {
  editingVariant.value = { sku: '', priceCents: product.value?.priceCents ?? 0, stockQuantity: 0, optionIds: [] }
  showVariantModal.value = true
}

function openEditVariant(v: AdminProductDetail['variants'][0]) {
  editingVariant.value = { sku: v.sku, priceCents: v.priceCents, stockQuantity: v.stockQuantity, optionIds: v.options.map((o) => o.id), id: v.id }
  showVariantModal.value = true
}

const savingVariant = ref(false)
async function saveVariant() {
  if (!editingVariant.value || !editingVariant.value.sku || editingVariant.value.optionIds.length === 0) return
  savingVariant.value = true
  try {
    if (editingVariant.value.id) {
      await api(`/admin/products/${id}/variants/${editingVariant.value.id}`, { method: 'PATCH', body: editingVariant.value })
    } else {
      await api(`/admin/products/${id}/variants`, { method: 'POST', body: editingVariant.value })
    }
    showVariantModal.value = false
    editingVariant.value = null
    await refresh()
    toast.add({ title: 'Variant saved', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to save variant', color: 'error' })
  } finally {
    savingVariant.value = false
  }
}

async function deleteVariant(vid: string) {
  try {
    await api(`/admin/products/${id}/variants/${vid}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'Variant deleted', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to delete variant', color: 'error' })
  }
}

// ---- Variant auto-generation ----
// Computes the Cartesian product of ALL options across ALL applied attributes,
// previews the full combination list (with editable SKU/price/stock), and
// bulk-creates them on save. E.g. Color(Red,Blue) × Size(S,M) = 4 variants.

interface GeneratedVariant {
  optionIds: string[]
  label: string
  sku: string
  priceCents: number
  stockQuantity: number
  colorSwatches: { value: string; colorHex: string | null }[]
}

const showGenerate = ref(false)
const generatedVariants = ref<GeneratedVariant[]>([])
const generating = ref(false)

// Cartesian product helper: [[Red,Blue], [S,M]] → [[Red,S],[Red,M],[Blue,S],[Blue,M]]
function cartesian<T>(arrays: T[][]): T[][] {
  if (!arrays.length) return [[]]
  return arrays.reduce<T[][]>((acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])), [[]])
}

function openGenerate() {
  if (!product.value || !product.value.attributes.length) return
  const attrs = product.value.attributes
  // Build the option arrays per attribute (each element: { option, attrName })
  const optionArrays = attrs.map((attr) =>
    attr.options.map((opt) => ({ optionId: opt.id, value: opt.value, colorHex: opt.colorHex, attrName: attr.name }))
  )
  const combos = cartesian(optionArrays)

  const slugBase = product.value.slug.toUpperCase().replace(/-/g, '').slice(0, 8)
  generatedVariants.value = combos
    .filter((combo) => combo.length > 0) // skip the degenerate empty combo
    .map((combo, i) => {
      const optionIds = combo.map((c) => c.optionId)
      const label = combo.map((c) => c.value).join(' / ')
      const skuSuffix = combo.map((c) => c.value.toUpperCase().slice(0, 3)).join('-')
      return {
        optionIds,
        label,
        sku: `${slugBase}-${skuSuffix}`,
        priceCents: product.value!.priceCents,
        stockQuantity: 0,
        colorSwatches: combo
          .filter((c) => c.colorHex)
          .map((c) => ({ value: c.value, colorHex: c.colorHex }))
      }
    })
  showGenerate.value = true
}

const generatingCount = computed(() => generatedVariants.value.length)

async function createGeneratedVariants() {
  if (!generatedVariants.value.length) return
  generating.value = true
  let created = 0
  let failed = 0
  for (const gv of generatedVariants.value) {
    try {
      await api(`/admin/products/${id}/variants`, {
        method: 'POST',
        body: { sku: gv.sku, priceCents: gv.priceCents, stockQuantity: gv.stockQuantity, optionIds: gv.optionIds }
      })
      created++
    } catch {
      failed++ // likely a duplicate SKU — keep going
    }
  }
  generating.value = false
  showGenerate.value = false
  await refresh()
  if (created > 0) toast.add({ title: `${created} variant${created === 1 ? '' : 's'} created`, color: 'success' })
  if (failed > 0) toast.add({ title: `${failed} failed (duplicate SKU?)`, color: 'warning' })
}

const showGenerateBool = computed({
  get: () => showGenerate.value,
  set: (v) => { if (!v) showGenerate.value = false }
})

// Apply attribute to product
async function applyAttribute(attrId: string) {
  try {
    await api(`/admin/products/${id}/attributes/${attrId}`, { method: 'POST' })
    await refresh()
  } catch {
    toast.add({ title: 'Failed to apply attribute', color: 'error' })
  }
}
async function removeAttribute(attrId: string) {
  try {
    await api(`/admin/products/${id}/attributes/${attrId}`, { method: 'DELETE' })
    await refresh()
  } catch {
    toast.add({ title: 'Failed to remove attribute', color: 'error' })
  }
}

// ---- Images tab ----
const newImageUrl = ref('')
const newImageAlt = ref('')
const savingImage = ref(false)
const uploadingFile = ref(false)
const downloadingUrl = ref(false)
const downloadUrlInput = ref('')

// Upload a file from the user's computer → server stores it, returns a local URL
const fileInput = ref<HTMLInputElement | null>(null)

function triggerFileUpload() {
  fileInput.value?.click()
}

async function onFileSelected(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  uploadingFile.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const config = useRuntimeConfig()
    const auth = useAuthStore()
    const res = await $fetch<{ url: string }>('/admin/upload', {
      baseURL: config.public.apiBase,
      method: 'POST',
      body: formData,
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    // Now add it as a product image with the local URL
    await api(`/admin/products/${id}/images`, {
      method: 'POST',
      body: { url: res.url, altText: file.name }
    })
    await refresh()
    toast.add({ title: 'Image uploaded', color: 'success' })
  } catch {
    toast.add({ title: 'Upload failed', color: 'error' })
  } finally {
    uploadingFile.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

// Download a remote image to our server, then add it as a product image
async function downloadAndAddImage() {
  if (!downloadUrlInput.value) return
  downloadingUrl.value = true
  try {
    const res = await api<{ url: string }>('/admin/upload-from-url', {
      method: 'POST',
      body: { url: downloadUrlInput.value }
    })
    await api(`/admin/products/${id}/images`, {
      method: 'POST',
      body: { url: res.url, altText: newImageAlt.value || undefined }
    })
    downloadUrlInput.value = ''
    newImageAlt.value = ''
    await refresh()
    toast.add({ title: 'Image downloaded and added', color: 'success' })
  } catch {
    toast.add({ title: 'Download failed — check the URL', color: 'error' })
  } finally {
    downloadingUrl.value = false
  }
}

// Direct URL (existing behavior — link an external image without downloading)
async function addImage() {
  if (!newImageUrl.value) return
  savingImage.value = true
  try {
    await api(`/admin/products/${id}/images`, { method: 'POST', body: { url: newImageUrl.value, altText: newImageAlt.value || undefined } })
    newImageUrl.value = ''
    newImageAlt.value = ''
    await refresh()
    toast.add({ title: 'Image added', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to add image', color: 'error' })
  } finally {
    savingImage.value = false
  }
}

async function deleteImage(iid: string) {
  try {
    await api(`/admin/products/${id}/images/${iid}`, { method: 'DELETE' })
    await refresh()
  } catch {
    toast.add({ title: 'Failed to delete image', color: 'error' })
  }
}

async function moveImage(iid: string, direction: 'up' | 'down') {
  if (!product.value) return
  const imgs = [...product.value.images]
  const idx = imgs.findIndex((i) => i.id === iid)
  if (idx < 0) return
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= imgs.length) return
  ;[imgs[idx], imgs[swapIdx]] = [imgs[swapIdx], imgs[idx]]
  await api(`/admin/products/${id}/reorder-images`, { method: 'POST', body: { orderedIds: imgs.map((i) => i.id) } })
  await refresh()
}

// ---- Inventory tab (stock adjustment) ----
const adjustDelta = ref(0)
const adjustReason = ref<'Restock' | 'Correction' | 'Damage' | 'Sale' | 'Return'>('Restock')
const adjustNote = ref('')
const savingAdjust = ref(false)

async function saveAdjust() {
  if (adjustDelta.value === 0) return
  savingAdjust.value = true
  try {
    await api(`/admin/products/${id}/stock`, { method: 'POST', body: { delta: adjustDelta.value, reason: adjustReason.value, note: adjustNote.value || undefined } })
    adjustDelta.value = 0
    adjustNote.value = ''
    await refresh()
    toast.add({ title: 'Stock adjusted', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to adjust stock', color: 'error' })
  } finally {
    savingAdjust.value = false
  }
}

// Available attributes not yet applied to this product
const availableAttributes = computed(() => {
  if (!allAttributes.value || !product.value) return []
  const appliedIds = new Set(product.value.attributes.map((a) => a.id))
  return allAttributes.value.filter((a) => !appliedIds.has(a.id))
})

const showVariantModalBool = computed({
  get: () => showVariantModal.value,
  set: (v) => { if (!v) { showVariantModal.value = false; editingVariant.value = null } }
})
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="product?.name ?? 'Edit product'">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/inventory" />
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="pending" class="py-24 text-center text-muted">Loading…</div>
      <div v-else-if="!product" class="py-24 text-center text-muted">Product not found.</div>
      <div v-else class="max-w-4xl space-y-6">
        <!-- Tabs -->
        <UTabs
          v-model="activeTab"
          :items="[
            { label: 'Details', value: 'details', icon: 'i-lucide-file-text' },
            { label: 'Variants', value: 'variants', icon: 'i-lucide-layers' },
            { label: 'Images', value: 'images', icon: 'i-lucide-image' },
            { label: 'Inventory', value: 'inventory', icon: 'i-lucide-boxes' }
          ]"
        />

        <!-- Details Tab -->
        <div v-show="activeTab === 'details'" class="admin-kpi-card space-y-5 p-6">
          <UFormField label="Name"><UInput v-model="product.name" class="w-full" /></UFormField>
          <UFormField label="Slug"><UInput v-model="product.slug" class="w-full" /></UFormField>
          <UFormField label="Description"><UTextarea v-model="product.description as string" class="w-full" :rows="3" /></UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Category">
              <USelect
                v-model="product.categoryId"
                :items="[{ label: 'None', value: null }, ...(categories ?? []).map((c) => ({ label: c.name, value: c.id }))]"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Price (cents)"><UInputNumber v-model="product.priceCents" class="w-full" /></UFormField>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Low-stock threshold"><UInputNumber v-model="product.lowStockThreshold" class="w-full" /></UFormField>
            <div class="flex items-end gap-4 pb-1">
              <UCheckbox v-model="product.featured" label="Featured" />
              <UCheckbox v-model="product.bestSeller" label="Best seller" />
            </div>
          </div>
          <div class="flex justify-end">
            <UButton :loading="savingDetails" icon="i-lucide-save" color="primary" @click="saveDetails">Save details</UButton>
          </div>
        </div>

        <!-- Variants Tab -->
        <div v-show="activeTab === 'variants'" class="space-y-5">
          <!-- Applied attributes -->
          <div class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Attributes this product varies on</h3>
            <div v-if="product.attributes.length" class="mb-4 flex flex-wrap gap-2">
              <UBadge v-for="attr in product.attributes" :key="attr.id" color="info" variant="subtle" class="flex items-center gap-1 py-1 pl-2 pr-1">
                {{ attr.name }}
                <button class="ml-1 rounded p-0.5 hover:bg-error/20" aria-label="Remove attribute" @click="removeAttribute(attr.id)">
                  <UIcon name="i-lucide-x" class="size-3" />
                </button>
              </UBadge>
            </div>
            <p v-else class="mb-4 text-sm text-muted">No attributes applied. Add one below to enable variant creation.</p>
            <div v-if="availableAttributes.length" class="flex items-center gap-2">
              <span class="text-xs text-muted">Add:</span>
              <UButton
                v-for="attr in availableAttributes"
                :key="attr.id"
                size="xs"
                variant="outline"
                color="neutral"
                :label="attr.name"
                @click="applyAttribute(attr.id)"
              />
            </div>
            <p v-else class="text-xs text-muted">All available attributes are applied (or none exist — create some in Settings).</p>
          </div>

          <!-- Variants table -->
          <div class="admin-kpi-card overflow-hidden">
            <div class="flex items-center justify-between border-b border-[var(--color-admin-border)] p-4">
              <h3 class="text-sm font-medium text-muted">Variants ({{ product.variants.length }})</h3>
              <div v-if="product.attributes.length" class="flex gap-2">
                <UButton
                  icon="i-lucide-sparkles"
                  size="xs"
                  variant="outline"
                  color="primary"
                  label="Generate all"
                  @click="openGenerate"
                />
                <UButton
                  icon="i-lucide-plus"
                  size="xs"
                  color="primary"
                  label="Add variant"
                  @click="openCreateVariant"
                />
              </div>
            </div>
            <table v-if="product.variants.length" class="admin-table w-full text-sm">
              <thead>
                <tr>
                  <th class="px-4 py-2.5 text-left">SKU</th>
                  <th class="px-4 py-2.5 text-left">Options</th>
                  <th class="px-4 py-2.5 text-right">Price</th>
                  <th class="px-4 py-2.5 text-right">Stock</th>
                  <th class="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="v in product.variants" :key="v.id">
                  <td class="px-4 py-3 font-medium">{{ v.sku }}</td>
                  <td class="px-4 py-3 text-muted">
                    <UBadge v-for="opt in v.options" :key="opt.id" size="sm" color="neutral" variant="subtle" class="mr-1">
                      {{ opt.attributeName }}: {{ opt.value }}
                    </UBadge>
                  </td>
                  <td class="tabular px-4 py-3 text-right"><PriceDisplay :amount-cents="v.priceCents" /></td>
                  <td class="tabular px-4 py-3 text-right">{{ v.stockQuantity }}</td>
                  <td class="px-4 py-3 text-right">
                    <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" @click="openEditVariant(v)" />
                    <UButton icon="i-lucide-trash-2" size="xs" variant="ghost" color="error" @click="deleteVariant(v.id)" />
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-else-if="product.attributes.length" class="px-4 py-12 text-center text-sm text-muted">No variants yet. Click "Add variant" to create one.</p>
            <p v-else class="px-4 py-12 text-center text-sm text-muted">Apply at least one attribute above before creating variants.</p>
          </div>
        </div>

        <!-- Images Tab -->
        <div v-show="activeTab === 'images'" class="space-y-5">
          <!-- Upload from computer -->
          <div class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Upload from computer</h3>
            <div class="flex items-center gap-3">
              <UButton
                icon="i-lucide-upload"
                color="primary"
                :loading="uploadingFile"
                label="Choose image file"
                @click="triggerFileUpload"
              />
              <p class="text-xs text-muted">JPG, PNG, WebP, GIF, SVG, AVIF — max 10 MB</p>
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="onFileSelected"
              />
            </div>
          </div>

          <!-- Download from URL -->
          <div class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Download from URL</h3>
            <p class="mb-3 text-xs text-muted">Paste an image URL — the server downloads and stores it locally so it won't break if the source goes offline.</p>
            <div class="flex gap-3">
              <UInput v-model="downloadUrlInput" placeholder="https://example.com/product.jpg" class="flex-1" />
              <UInput v-model="newImageAlt" placeholder="Alt text (optional)" class="w-48" />
              <UButton icon="i-lucide-download" :loading="downloadingUrl" color="primary" :disabled="!downloadUrlInput" @click="downloadAndAddImage">Download</UButton>
            </div>
          </div>

          <!-- Direct link (external URL, not downloaded) -->
          <div class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Link external image</h3>
            <p class="mb-3 text-xs text-muted">Use a remote URL directly (not copied to our server).</p>
            <div class="flex gap-3">
              <UInput v-model="newImageUrl" placeholder="https://…" class="flex-1" />
              <UButton icon="i-lucide-link" :loading="savingImage" color="neutral" variant="outline" :disabled="!newImageUrl" @click="addImage">Link</UButton>
            </div>
          </div>
          <div class="admin-kpi-card overflow-hidden">
            <div class="border-b border-[var(--color-admin-border)] p-4">
              <h3 class="text-sm font-medium text-muted">Gallery ({{ product.images.length }}) — first image is the hero</h3>
            </div>
            <div class="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4">
              <div v-for="(img, idx) in product.images" :key="img.id" class="group relative overflow-hidden rounded-lg border border-[var(--color-admin-border)]">
                <img :src="resolveImgUrl(img.url)" :alt="img.altText ?? ''" class="aspect-square size-full object-cover" />
                <div class="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <UButton icon="i-lucide-arrow-up" size="xs" variant="solid" color="neutral" :disabled="idx === 0" @click="moveImage(img.id, 'up')" />
                  <UButton icon="i-lucide-arrow-down" size="xs" variant="solid" color="neutral" :disabled="idx === product.images.length - 1" @click="moveImage(img.id, 'down')" />
                  <UButton icon="i-lucide-trash-2" size="xs" variant="solid" color="error" @click="deleteImage(img.id)" />
                </div>
                <UBadge v-if="idx === 0" size="sm" color="primary" variant="solid" class="absolute left-1 top-1">Hero</UBadge>
              </div>
            </div>
            <p v-if="!product.images.length" class="px-4 py-12 text-center text-sm text-muted">No images yet.</p>
          </div>
        </div>

        <!-- Inventory Tab -->
        <div v-show="activeTab === 'inventory'" class="space-y-5">
          <div class="admin-kpi-card p-6">
            <h3 class="mb-4 text-sm font-medium text-muted">Current stock: <span class="tabular text-lg font-bold text-highlighted">{{ product.stockQuantity }}</span></h3>
            <div class="grid grid-cols-3 gap-3">
              <UFormField label="Change (+/-)">
                <UInputNumber v-model="adjustDelta" class="w-full" />
              </UFormField>
              <UFormField label="Reason">
                <USelect v-model="adjustReason" :items="['Restock', 'Correction', 'Damage', 'Sale', 'Return']" class="w-full" />
              </UFormField>
              <UFormField label="Note">
                <UInput v-model="adjustNote" placeholder="Optional…" class="w-full" />
              </UFormField>
            </div>
            <p class="mt-3 text-sm text-muted">New stock: <span class="tabular font-medium">{{ product.stockQuantity + adjustDelta }}</span></p>
            <div class="mt-4 flex justify-end">
              <UButton :loading="savingAdjust" :disabled="adjustDelta === 0" color="primary" @click="saveAdjust">Save adjustment</UButton>
            </div>
          </div>
        </div>
      </div>

      <!-- Variant modal -->
      <UModal v-model:open="showVariantModalBool">
        <template #content>
          <div v-if="editingVariant" class="space-y-4 p-6">
            <h3 class="text-lg font-semibold">{{ editingVariant.id ? 'Edit' : 'New' }} variant</h3>
            <UFormField label="SKU"><UInput v-model="editingVariant.sku" class="w-full" /></UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Price (cents)"><UInputNumber v-model="editingVariant.priceCents" class="w-full" /></UFormField>
              <UFormField label="Stock"><UInputNumber v-model="editingVariant.stockQuantity" class="w-full" /></UFormField>
            </div>
            <!-- Option selectors: one per applied attribute, rendered by type -->
            <div v-for="attr in product?.attributes" :key="attr.id" class="space-y-2">
              <p class="text-sm font-medium">{{ attr.name }} <span class="text-xs text-muted">({{ attr.type }})</span></p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="opt in attr.options"
                  :key="opt.id"
                  type="button"
                  class="flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-sm transition-colors"
                  :class="editingVariant.optionIds.includes(opt.id) ? 'border-primary bg-primary/5 text-primary' : 'border-[var(--color-admin-border)] text-muted hover:border-primary/40'"
                  @click="editingVariant.optionIds = editingVariant.optionIds.includes(opt.id) ? editingVariant.optionIds.filter((x) => x !== opt.id) : [...editingVariant.optionIds, opt.id]"
                >
                  <!-- Color: hex swatch -->
                  <span v-if="attr.type === 'Color' && opt.colorHex" class="size-4 rounded-full border border-current/20" :style="{ backgroundColor: opt.colorHex }" />
                  <!-- Swatch: image thumbnail -->
                  <img v-if="attr.type === 'Swatch' && opt.displayValue" :src="opt.displayValue" :alt="opt.value" class="size-5 rounded object-cover" />
                  <!-- Size: bold uppercase -->
                  <span v-if="attr.type === 'Size'" class="font-bold uppercase">{{ opt.value }}</span>
                  <!-- Boolean: icon -->
                  <UIcon v-else-if="attr.type === 'Boolean'" :name="opt.value === 'Yes' ? 'i-lucide-check' : 'i-lucide-x'" class="size-4" />
                  <!-- Measurement: value + unit -->
                  <span v-else-if="attr.type === 'Measurement'">{{ opt.value }}<span v-if="opt.displayValue" class="text-muted"> {{ opt.displayValue }}</span></span>
                  <!-- Text / Number (default) -->
                  <span v-else>{{ opt.value }}</span>
                </button>
              </div>
            </div>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" label="Cancel" @click="showVariantModalBool = false" />
              <UButton :loading="savingVariant" label="Save variant" color="primary" @click="saveVariant" />
            </div>
          </div>
        </template>
      </UModal>

      <!-- Generate variants modal — Cartesian product preview -->
      <UModal v-model:open="showGenerateBool">
        <template #content>
          <div class="space-y-4 p-6">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">Generate variants</h3>
              <UBadge color="primary" variant="subtle">{{ generatingCount }} combinations</UBadge>
            </div>
            <p class="text-sm text-muted">
              All combinations from the product's applied attributes. Edit SKU, price, and stock for each,
              then click "Create all" to add them in bulk.
            </p>

            <!-- Preview table -->
            <div class="max-h-96 overflow-y-auto rounded-lg border border-[var(--color-admin-border)]">
              <table class="w-full text-sm">
                <thead class="sticky top-0 bg-[var(--color-admin-surface)]">
                  <tr>
                    <th class="px-3 py-2 text-left">Combination</th>
                    <th class="px-3 py-2 text-left">SKU</th>
                    <th class="px-3 py-2 text-right">Price</th>
                    <th class="px-3 py-2 text-right">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(gv, i) in generatedVariants" :key="i" class="border-t border-[var(--color-admin-border)]">
                    <td class="px-3 py-2">
                      <div class="flex items-center gap-1.5">
                        <span
                          v-for="sw in gv.colorSwatches"
                          :key="sw.value"
                          class="size-3 rounded-full border border-current/20"
                          :style="{ backgroundColor: sw.colorHex ?? undefined }"
                        />
                        {{ gv.label }}
                      </div>
                    </td>
                    <td class="px-3 py-2"><UInput v-model="gv.sku" size="xs" class="w-32" /></td>
                    <td class="px-3 py-2"><UInputNumber v-model="gv.priceCents" size="xs" class="w-24" /></td>
                    <td class="px-3 py-2"><UInputNumber v-model="gv.stockQuantity" size="xs" class="w-20" /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="flex items-center justify-between">
              <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-rotate-ccw" label="Regenerate" @click="openGenerate" />
              <div class="flex gap-2">
                <UButton color="neutral" variant="ghost" label="Cancel" @click="showGenerateBool = false" />
                <UButton :loading="generating" icon="i-lucide-check" label="Create all" color="primary" @click="createGeneratedVariants" />
              </div>
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
