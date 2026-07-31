<script setup lang="ts">
import type { AdminProductDetail, Category, ProductLandingPage } from '@amalice/shared'
import { offerTotalQuantity, offerPriceCents } from '@amalice/shared'

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

const activeTab = ref<'details' | 'variants' | 'images' | 'landingPage' | 'offers' | 'upsells' | 'inventory'>('details')

// Every *Cents field is stored as amount * 100 internally (this app's one
// money convention — see PriceDisplay), but admins think in plain DZD, not
// centimes. cents/100 -> input, Math.round(input*100) -> stored back.
const productPriceDzd = computed<number>({
  get: () => (product.value ? product.value.priceCents / 100 : 0),
  set: (v) => {
    if (product.value) product.value.priceCents = Math.round((v ?? 0) * 100)
  }
})

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

const editingVariantPriceDzd = computed<number>({
  get: () => (editingVariant.value ? editingVariant.value.priceCents / 100 : 0),
  set: (v) => {
    if (editingVariant.value) editingVariant.value.priceCents = Math.round((v ?? 0) * 100)
  }
})

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

// ---- Landing Page tab ----
// AI-generated long-scroll marketing image (hero + feature highlights +
// CTA, stitched together server-side) — see apps/api/src/landing-pages.
// Generation runs as a background job; this tab polls while status is
// "Generating" and stops once it lands on Completed/Failed.
const landingPage = ref<ProductLandingPage | null>(null)
const generatingLandingPage = ref(false)
const selectedSourceImages = ref<string[]>([])
const landingPageDescription = ref('')
const sectionCount = ref(5)
// Gemini edits the product's real photos and draws its own on-image text,
// but needs Google Cloud billing enabled; Pollinations is free/keyless with
// no billing step, but generates a generic product-style image (not the
// real photos) and has the text composited on in code instead.
const imageProvider = ref<'Gemini' | 'Pollinations'>('Gemini')
let landingPageProviderTouched = false
let landingPagePollTimer: ReturnType<typeof setInterval> | undefined

async function fetchLandingPage() {
  try {
    landingPage.value = await api<ProductLandingPage | null>(`/admin/products/${id}/landing-page`)
  } catch {
    landingPage.value = null
  }
  // Restore the source-image selection and provider choice from the last
  // generation so "Regenerate" works immediately without re-picking anything.
  if (landingPage.value && selectedSourceImages.value.length === 0) {
    const usedUrls = new Set(landingPage.value.sections.flatMap((s) => s.sourceImageUrls))
    if (usedUrls.size) selectedSourceImages.value = [...usedUrls]
  }
  if (landingPage.value && !landingPageProviderTouched) {
    imageProvider.value = landingPage.value.imageProvider
  }
}

function stopLandingPagePolling() {
  if (landingPagePollTimer) clearInterval(landingPagePollTimer)
  landingPagePollTimer = undefined
}

function startLandingPagePolling() {
  stopLandingPagePolling()
  landingPagePollTimer = setInterval(async () => {
    await fetchLandingPage()
    if (landingPage.value && landingPage.value.status !== 'Generating') stopLandingPagePolling()
  }, 3000)
}

onMounted(async () => {
  await fetchLandingPage()
  if (landingPage.value?.status === 'Generating') startLandingPagePolling()
})
onUnmounted(() => stopLandingPagePolling())

// Prefill the generation description from the product's own description,
// once, the first time it becomes available — still freely editable after.
watch(product, (p) => {
  if (p && !landingPageDescription.value) landingPageDescription.value = (p.description as string) ?? ''
}, { immediate: true })

function toggleSourceImage(url: string) {
  const idx = selectedSourceImages.value.indexOf(url)
  if (idx === -1) selectedSourceImages.value.push(url)
  else selectedSourceImages.value.splice(idx, 1)
}

function selectImageProvider(provider: 'Gemini' | 'Pollinations') {
  imageProvider.value = provider
  landingPageProviderTouched = true
}

async function generateLandingPage() {
  if (selectedSourceImages.value.length === 0) {
    toast.add({ title: 'Select at least one source image', color: 'warning' })
    return
  }
  if (!landingPageDescription.value.trim()) {
    toast.add({ title: 'Add a description to generate from', color: 'warning' })
    return
  }
  generatingLandingPage.value = true
  try {
    landingPage.value = await api<ProductLandingPage>(`/admin/products/${id}/landing-page/generate`, {
      method: 'POST',
      body: {
        sourceImageUrls: selectedSourceImages.value,
        description: landingPageDescription.value,
        sectionCount: sectionCount.value,
        imageProvider: imageProvider.value
      }
    })
    startLandingPagePolling()
    toast.add({ title: 'Generating landing page…', description: 'This can take a minute or two — feel free to switch tabs.', color: 'info' })
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Failed to start generation', description: data?.message, color: 'error' })
  } finally {
    generatingLandingPage.value = false
  }
}

async function regenerateSection(sectionId: string) {
  try {
    landingPage.value = await api<ProductLandingPage>(`/admin/products/${id}/landing-page/sections/${sectionId}/regenerate`, { method: 'POST' })
    startLandingPagePolling()
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Failed to regenerate section', description: data?.message, color: 'error' })
  }
}

async function toggleLandingPageEnabled(enabled: boolean) {
  try {
    landingPage.value = await api<ProductLandingPage>(`/admin/products/${id}/landing-page`, { method: 'PUT', body: { enabled } })
    toast.add({ title: enabled ? 'Now shown on the storefront' : 'Hidden from the storefront', color: 'success' })
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Failed to update', description: data?.message, color: 'error' })
  }
}

const sectionStatusColor: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  completed: 'success',
  generating: 'warning',
  pending: 'neutral',
  failed: 'error'
}

// ---- Offers tab ----
// Quantity-triggered promos (buy-X bundle price, buy-X-get-Y-free, buy-X
// free-shipping badge) — plain CRUD against product.offers, no background
// job unlike the Landing Page tab, so mutations just refresh() the product.
const offerTypeOptions = [
  { value: 'FixedBundlePrice', label: 'Bundle price (buy X for a set DZD amount)' },
  { value: 'BuyXGetYFree', label: 'Buy X, get Y free' },
  { value: 'FreeShipping', label: 'Buy X, free shipping (badge only)' }
]
const dzdFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'DZD' })
function formatDzd(cents: number) {
  return dzdFormatter.format(cents / 100)
}
const newOffer = reactive({
  type: 'FixedBundlePrice' as 'FixedBundlePrice' | 'BuyXGetYFree' | 'FreeShipping',
  requiredQuantity: 2,
  freeQuantity: 1,
  bundlePriceCents: null as number | null
})
const newOfferBundlePriceDzd = computed<number | null>({
  get: () => (newOffer.bundlePriceCents == null ? null : newOffer.bundlePriceCents / 100),
  set: (v) => {
    newOffer.bundlePriceCents = v == null ? null : Math.round(v * 100)
  }
})
const creatingOffer = ref(false)
const savingOfferId = ref<string | null>(null)

function offerSummary(o: { type: 'FixedBundlePrice' | 'BuyXGetYFree' | 'FreeShipping'; requiredQuantity: number; freeQuantity: number; bundlePriceCents: number | null }): string {
  const totalQty = offerTotalQuantity(o)
  const priceCents = offerPriceCents(o, product.value?.priceCents ?? 0)
  if (o.type === 'FixedBundlePrice') return `Buy ${o.requiredQuantity} for ${formatDzd(priceCents)}`
  if (o.type === 'BuyXGetYFree') return `Buy ${o.requiredQuantity}, get ${o.freeQuantity} free (${totalQty} total for ${formatDzd(priceCents)})`
  return `Buy ${o.requiredQuantity}, free shipping`
}

async function createOffer() {
  if (newOffer.type === 'FixedBundlePrice' && !newOffer.bundlePriceCents) {
    toast.add({ title: 'Enter a bundle price', color: 'warning' })
    return
  }
  if (newOffer.type === 'BuyXGetYFree' && newOffer.freeQuantity < 1) {
    toast.add({ title: 'Free quantity must be at least 1', color: 'warning' })
    return
  }
  creatingOffer.value = true
  try {
    await api(`/admin/products/${id}/offers`, {
      method: 'POST',
      body: {
        type: newOffer.type,
        requiredQuantity: newOffer.requiredQuantity,
        freeQuantity: newOffer.type === 'BuyXGetYFree' ? newOffer.freeQuantity : 0,
        bundlePriceCents: newOffer.type === 'FixedBundlePrice' ? newOffer.bundlePriceCents : null
      }
    })
    await refresh()
    toast.add({ title: 'Offer added', color: 'success' })
    newOffer.requiredQuantity = 2
    newOffer.freeQuantity = 1
    newOffer.bundlePriceCents = null
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Failed to add offer', description: data?.message, color: 'error' })
  } finally {
    creatingOffer.value = false
  }
}

async function toggleOfferEnabled(offerId: string, enabled: boolean) {
  savingOfferId.value = offerId
  try {
    await api(`/admin/products/${id}/offers/${offerId}`, { method: 'PATCH', body: { enabled } })
    await refresh()
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Failed to update offer', description: data?.message, color: 'error' })
  } finally {
    savingOfferId.value = null
  }
}

async function deleteOffer(offerId: string) {
  savingOfferId.value = offerId
  try {
    await api(`/admin/products/${id}/offers/${offerId}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'Offer removed', color: 'success' })
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Failed to remove offer', description: data?.message, color: 'error' })
  } finally {
    savingOfferId.value = null
  }
}

// ---- Upsells tab ----
// "Customers who buy this product are offered X" — see ProductUpsell's
// Prisma comment. Fetched lazily (only once the Upsells tab is opened,
// same reasoning as everything else on this page that isn't needed until
// its own tab is visible) rather than bundled into the initial product
// fetch, since it's a separate resource.
interface ProductUpsellRow {
  id: string
  upsellProductId: string
  enabled: boolean
  priceCentsOverride: number | null
  upsellProduct: { id: string; name: string; slug: string; imageUrl: string | null; priceCents: number }
}
const upsells = ref<ProductUpsellRow[]>([])
const upsellsLoaded = ref(false)
const otherProducts = ref<{ id: string; name: string; priceCents: number }[]>([])

async function loadUpsellsTab() {
  if (upsellsLoaded.value) return
  upsellsLoaded.value = true
  const [upsellRes, productsRes] = await Promise.all([
    api<ProductUpsellRow[]>(`/admin/products/${id}/upsells`),
    api<{ items: { id: string; name: string; priceCents: number }[] }>('/products?pageSize=100')
  ])
  upsells.value = upsellRes
  otherProducts.value = productsRes.items.filter((p) => p.id !== id)
}
watch(activeTab, (tab) => {
  if (tab === 'upsells') loadUpsellsTab()
})

const newUpsellProductId = ref<string | undefined>(undefined)
const newUpsellPriceOverrideDzd = ref<number | null>(null)
const creatingUpsell = ref(false)
const savingUpsellId = ref<string | null>(null)

async function createUpsell() {
  if (!newUpsellProductId.value) {
    toast.add({ title: 'Pick a product to suggest', color: 'warning' })
    return
  }
  creatingUpsell.value = true
  try {
    const created = await api<ProductUpsellRow>(`/admin/products/${id}/upsells`, {
      method: 'POST',
      body: {
        upsellProductId: newUpsellProductId.value,
        priceCentsOverride: newUpsellPriceOverrideDzd.value == null ? null : Math.round(newUpsellPriceOverrideDzd.value * 100)
      }
    })
    upsells.value.push(created)
    toast.add({ title: 'Upsell added', color: 'success' })
    newUpsellProductId.value = undefined
    newUpsellPriceOverrideDzd.value = null
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Failed to add upsell', description: data?.message, color: 'error' })
  } finally {
    creatingUpsell.value = false
  }
}

async function toggleUpsellEnabled(upsellId: string, enabled: boolean) {
  savingUpsellId.value = upsellId
  try {
    await api(`/admin/products/${id}/upsells/${upsellId}`, { method: 'PATCH', body: { enabled } })
    const row = upsells.value.find((u) => u.id === upsellId)
    if (row) row.enabled = enabled
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Failed to update upsell', description: data?.message, color: 'error' })
  } finally {
    savingUpsellId.value = null
  }
}

async function deleteUpsell(upsellId: string) {
  savingUpsellId.value = upsellId
  try {
    await api(`/admin/products/${id}/upsells/${upsellId}`, { method: 'DELETE' })
    upsells.value = upsells.value.filter((u) => u.id !== upsellId)
    toast.add({ title: 'Upsell removed', color: 'success' })
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Failed to remove upsell', description: data?.message, color: 'error' })
  } finally {
    savingUpsellId.value = null
  }
}
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
            { label: 'Landing Page', value: 'landingPage', icon: 'i-lucide-sparkles' },
            { label: 'Offers', value: 'offers', icon: 'i-lucide-tag' },
            { label: 'Upsells', value: 'upsells', icon: 'i-lucide-plus-circle' },
            { label: 'Inventory', value: 'inventory', icon: 'i-lucide-boxes' }
          ]"
        />

        <!-- Details Tab -->
        <div v-show="activeTab === 'details'" class="admin-kpi-card space-y-5 p-6">
          <UFormField label="Name"><UInput v-model="product.name" class="w-full" /></UFormField>
          <UFormField label="Slug"><UInput v-model="product.slug" class="w-full" /></UFormField>
          <UFormField label="Description">
            <RichTextEditor v-model="product.description" />
          </UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Category">
              <USelect
                v-model="product.categoryId"
                :items="[{ label: 'None', value: null }, ...(categories ?? []).map((c) => ({ label: c.name, value: c.id }))]"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Price (DZD)"><UInputNumber v-model="productPriceDzd" :min="0" class="w-full" /></UFormField>
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
          <div class="admin-table-wrap">
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
          <div class="admin-table-wrap">
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

        <!-- Landing Page Tab -->
        <div v-show="activeTab === 'landingPage'" class="space-y-5">
          <div class="admin-kpi-card space-y-5 p-6">
            <div>
              <h3 class="mb-1 flex items-center gap-2 font-medium text-highlighted">
                <UIcon name="i-lucide-sparkles" class="size-4 text-primary" /> AI Landing Page
              </h3>
              <p class="text-sm text-muted">
                Turns this product's photos and description into a long-scroll marketing image — a hero section, a
                few feature highlights, and a call-to-action, each generated with its own text and effects, then
                combined into one image.
              </p>
            </div>

            <UFormField label="Description to generate from" help="Prefilled from the product description — edit for punchier landing-page copy before generating.">
              <UTextarea v-model="landingPageDescription" class="w-full" :rows="4" />
            </UFormField>

            <UFormField label="Source images" help="Pick 1–10 of this product's photos — the AI uses the real product shown in these, not an invented one.">
              <div v-if="product.images.length" class="grid grid-cols-4 gap-2 sm:grid-cols-6">
                <button
                  v-for="img in product.images"
                  :key="img.id"
                  type="button"
                  class="relative aspect-square overflow-hidden rounded-md border-2 transition-colors"
                  :class="selectedSourceImages.includes(img.url) ? 'border-primary' : 'border-[var(--color-admin-border)]'"
                  @click="toggleSourceImage(img.url)"
                >
                  <img :src="resolveImgUrl(img.url)" :alt="img.altText ?? ''" class="size-full object-cover" />
                  <div v-if="selectedSourceImages.includes(img.url)" class="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-white">
                    <UIcon name="i-lucide-check" class="size-3" />
                  </div>
                </button>
              </div>
              <p v-else class="text-sm text-muted">Add product photos in the Images tab first.</p>
            </UFormField>

            <UFormField label="Image provider" help="Gemini edits your real product photos and draws its own text, but needs Google Cloud billing enabled. Pollinations is free with no billing step, but generates a generic product-style image (not your real photos) and adds text separately.">
              <div class="flex gap-2">
                <button
                  type="button"
                  class="flex-1 rounded-md border-2 px-3 py-2 text-left text-sm transition-colors"
                  :class="imageProvider === 'Gemini' ? 'border-primary bg-primary/5' : 'border-[var(--color-admin-border)]'"
                  @click="selectImageProvider('Gemini')"
                >
                  <span class="font-medium">Gemini (Nano Banana)</span>
                  <span class="block text-xs text-muted">Best quality — needs billing</span>
                </button>
                <button
                  type="button"
                  class="flex-1 rounded-md border-2 px-3 py-2 text-left text-sm transition-colors"
                  :class="imageProvider === 'Pollinations' ? 'border-primary bg-primary/5' : 'border-[var(--color-admin-border)]'"
                  @click="selectImageProvider('Pollinations')"
                >
                  <span class="font-medium">Pollinations</span>
                  <span class="block text-xs text-muted">Free, no billing needed</span>
                </button>
              </div>
            </UFormField>

            <UFormField label="Number of sections">
              <USelect v-model="sectionCount" :items="[3, 4, 5, 6, 7]" class="w-32" />
            </UFormField>

            <UButton
              :loading="generatingLandingPage"
              :disabled="!product.images.length"
              color="primary"
              icon="i-lucide-sparkles"
              @click="generateLandingPage"
            >
              {{ landingPage ? 'Regenerate landing page' : 'Generate landing page' }}
            </UButton>
          </div>

          <div v-if="landingPage" class="admin-kpi-card space-y-4 p-6">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UBadge :color="sectionStatusColor[landingPage.status.toLowerCase()] ?? 'neutral'" variant="subtle">{{ landingPage.status }}</UBadge>
                <UBadge color="neutral" variant="outline">{{ landingPage.imageProvider }}</UBadge>
                <UIcon v-if="landingPage.status === 'Generating'" name="i-lucide-loader-circle" class="size-4 animate-spin text-muted" />
              </div>
              <div v-if="landingPage.status === 'Completed'" class="flex items-center gap-2">
                <span class="text-sm text-muted">Show on storefront</span>
                <USwitch :model-value="landingPage.enabled" @update:model-value="toggleLandingPageEnabled($event as boolean)" />
              </div>
            </div>

            <p v-if="landingPage.errorMessage" class="flex items-start gap-1.5 text-sm text-error">
              <UIcon name="i-lucide-alert-triangle" class="mt-0.5 size-4 shrink-0" />
              {{ landingPage.errorMessage }}
            </p>

            <div v-if="landingPage.sections.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div v-for="section in landingPage.sections" :key="section.id" class="space-y-1.5 rounded-md border border-[var(--color-admin-border)] p-2">
                <div class="flex aspect-[3/4] items-center justify-center overflow-hidden rounded bg-[var(--color-admin-surface-tint)]">
                  <img v-if="section.imageUrl" :src="resolveImgUrl(section.imageUrl)" class="size-full object-cover" />
                  <UIcon
                    v-else
                    :name="section.status === 'failed' ? 'i-lucide-circle-x' : 'i-lucide-loader-circle'"
                    class="size-6 text-muted"
                    :class="section.status !== 'failed' && 'animate-spin'"
                  />
                </div>
                <p class="line-clamp-2 text-xs font-medium text-highlighted">
                  <span class="uppercase text-muted">{{ section.role }}</span>
                  <template v-if="section.headline"> — {{ section.headline }}</template>
                </p>
                <UButton
                  size="xs"
                  variant="soft"
                  color="neutral"
                  icon="i-lucide-refresh-cw"
                  block
                  :disabled="section.status === 'generating'"
                  @click="regenerateSection(section.id)"
                >
                  Regenerate
                </UButton>
              </div>
            </div>

            <div v-if="landingPage.finalImageUrl">
              <h4 class="mb-2 text-sm font-medium text-muted">Final long image</h4>
              <img :src="resolveImgUrl(landingPage.finalImageUrl)" class="w-full max-w-sm rounded-md border border-[var(--color-admin-border)]" />
            </div>
          </div>
        </div>

        <!-- Offers Tab -->
        <div v-show="activeTab === 'offers'" class="space-y-5">
          <div class="admin-kpi-card space-y-5 p-6">
            <div>
              <h3 class="mb-1 flex items-center gap-2 font-medium text-highlighted">
                <UIcon name="i-lucide-tag" class="size-4 text-primary" /> Offers
              </h3>
              <p class="text-sm text-muted">
                Quantity-based promos shown on the product page — the customer picks an offer card, which sets the
                quantity for them and locks in that price.
              </p>
            </div>

            <div v-if="product.offers.length" class="space-y-2">
              <div
                v-for="offer in product.offers"
                :key="offer.id"
                class="flex items-center justify-between gap-3 rounded-md border border-[var(--color-admin-border)] p-3"
              >
                <div>
                  <p class="text-sm font-medium text-highlighted">{{ offerSummary(offer) }}</p>
                  <p class="text-xs text-muted">{{ offerTypeOptions.find(t => t.value === offer.type)?.label }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <USwitch
                    :model-value="offer.enabled"
                    :disabled="savingOfferId === offer.id"
                    @update:model-value="toggleOfferEnabled(offer.id, $event as boolean)"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    size="sm"
                    :disabled="savingOfferId === offer.id"
                    @click="deleteOffer(offer.id)"
                  />
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-muted">No offers yet.</p>
          </div>

          <div class="admin-kpi-card space-y-4 p-6">
            <h4 class="text-sm font-medium text-highlighted">Add an offer</h4>

            <UFormField label="Type">
              <USelect v-model="newOffer.type" :items="offerTypeOptions" value-key="value" label-key="label" class="w-full" />
            </UFormField>

            <UFormField :label="newOffer.type === 'BuyXGetYFree' ? 'Paid quantity' : 'Required quantity'">
              <UInputNumber v-model="newOffer.requiredQuantity" :min="1" :max="50" class="w-32" />
            </UFormField>

            <UFormField v-if="newOffer.type === 'BuyXGetYFree'" label="Free quantity">
              <UInputNumber v-model="newOffer.freeQuantity" :min="1" :max="50" class="w-32" />
            </UFormField>

            <UFormField v-if="newOffer.type === 'FixedBundlePrice'" label="Bundle price (DZD)" help="Total price for the required quantity.">
              <UInputNumber v-model="newOfferBundlePriceDzd" :min="0" class="w-40" />
            </UFormField>

            <p v-if="newOffer.type === 'FreeShipping'" class="text-sm text-muted">
              Display-only — there's no shipping-fee concept yet, so this shows a badge but doesn't change the order total.
            </p>

            <UButton :loading="creatingOffer" color="primary" icon="i-lucide-plus" @click="createOffer">
              Add offer
            </UButton>
          </div>
        </div>

        <!-- Upsells Tab -->
        <div v-show="activeTab === 'upsells'" class="space-y-5">
          <div class="admin-kpi-card space-y-5 p-6">
            <div>
              <h3 class="mb-1 flex items-center gap-2 font-medium text-highlighted">
                <UIcon name="i-lucide-plus-circle" class="size-4 text-primary" /> Upsells
              </h3>
              <p class="text-sm text-muted">
                Products suggested to a customer right after they place an order for this one — shown on a one-click
                "add this?" page before the order confirmation. Set a special price to sweeten the offer, or leave it
                blank to use the product's normal price.
              </p>
            </div>

            <div v-if="upsells.length" class="space-y-2">
              <div
                v-for="u in upsells"
                :key="u.id"
                class="flex items-center justify-between gap-3 rounded-md border border-[var(--color-admin-border)] p-3"
              >
                <div>
                  <p class="text-sm font-medium text-highlighted">{{ u.upsellProduct.name }}</p>
                  <p class="text-xs text-muted">
                    {{ formatDzd(u.priceCentsOverride ?? u.upsellProduct.priceCents) }}
                    <span v-if="u.priceCentsOverride != null">(normally {{ formatDzd(u.upsellProduct.priceCents) }})</span>
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <USwitch
                    :model-value="u.enabled"
                    :disabled="savingUpsellId === u.id"
                    @update:model-value="toggleUpsellEnabled(u.id, $event as boolean)"
                  />
                  <UButton
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    size="sm"
                    :disabled="savingUpsellId === u.id"
                    @click="deleteUpsell(u.id)"
                  />
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-muted">No upsells configured yet.</p>
          </div>

          <div class="admin-kpi-card space-y-4 p-6">
            <h4 class="text-sm font-medium text-highlighted">Add an upsell</h4>

            <UFormField label="Suggested product">
              <USelect
                v-model="newUpsellProductId"
                :items="otherProducts.map(p => ({ label: p.name, value: p.id }))"
                placeholder="Choose a product…"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Special price (DZD)" help="Leave blank to offer it at its normal price.">
              <UInputNumber v-model="newUpsellPriceOverrideDzd" :min="0" class="w-40" />
            </UFormField>

            <UButton :loading="creatingUpsell" color="primary" icon="i-lucide-plus" @click="createUpsell">
              Add upsell
            </UButton>
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
              <UFormField label="Price (DZD)"><UInputNumber v-model="editingVariantPriceDzd" :min="0" class="w-full" /></UFormField>
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
                    <td class="px-3 py-2">
                      <UInputNumber
                        :model-value="gv.priceCents / 100"
                        :min="0"
                        size="xs"
                        class="w-24"
                        @update:model-value="(v) => (gv.priceCents = Math.round((Number(v) || 0) * 100))"
                      />
                    </td>
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
