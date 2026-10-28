<script setup lang="ts">

import type { AdminProductDetail, Category, ProductLandingPage, GeneratedProductContent } from '@amalice/shared'
import { offerTotalQuantity, offerPriceCents } from '@amalice/shared'

// Full product editor — tabbed sections for Details, Variants, Images, Inventory.
// Each tab manages its own CRUD via the admin API. The product detail (with
// variants/options/images/attributes) is loaded once and refreshed on mutation.
const route = useRoute()
const router = useRouter()
const id = route.params.id as string
const { isSuperAdmin, confirmDelete } = useDangerDelete()
const { run: runDelete } = useApiAction()
// Permanent delete (SuperAdmin). Refused by the API when the product was ever
// ordered — those orders would break; hide/archive it instead.
async function deleteProduct() {
  if (!product.value || !confirmDelete(`Permanently delete the product “${product.value.name}” with its variants, images, offers, upsells, reviews and landing pages?`)) return
  const res = await runDelete(() => api(`/admin/products/${id}`, { method: 'DELETE' }), { success: 'Product deleted', errorFallback: 'Could not delete the product' })
  if (res !== undefined) await router.push('/inventory')
}
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

const activeTab = ref<'details' | 'content' | 'variants' | 'images' | 'landingPage' | 'offers' | 'upsells' | 'inventory'>('details')

// Every *Cents field is stored as amount * 100 internally (this app's one
// money convention — see PriceDisplay), but admins think in plain DZD, not
// centimes. cents/100 -> input, Math.round(input*100) -> stored back.
const productPriceDzd = computed<number>({
  get: () => (product.value ? product.value.priceCents / 100 : 0),
  set: (v) => {
    if (product.value) product.value.priceCents = Math.round((v ?? 0) * 100)
  }
})

// Unit cost (what one unit costs us) feeds the Meta Ads profit reports. Blank = unknown.
const productCostDzd = computed<number | null>({
  get: () => (product.value?.costCents != null ? product.value.costCents / 100 : null),
  set: (v) => {
    if (product.value) product.value.costCents = v == null ? null : Math.round(v * 100)
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
        costCents: product.value.costCents ?? null,
        lowStockThreshold: product.value.lowStockThreshold,
        featured: product.value.featured,
        bestSeller: product.value.bestSeller,
        // Also persisted here: "Apply" from the AI generator fills these in
        // memory, and the refresh() below would otherwise reload the product
        // and silently discard them if only this tab's Save was clicked.
        ...contentPayload()
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

// The "Visible on storefront" switch saves itself immediately on toggle
// (like the landing pages tab's "Live" switch) instead of silently sitting
// there until someone remembers to hit the separate "Save details" button
// below — a hide/unhide decision needs to take effect right away, not
// after an unrelated click.
const savingVisible = ref(false)
async function toggleVisible(value: boolean) {
  if (!product.value) return
  const previous = product.value.visible
  product.value.visible = value
  savingVisible.value = true
  try {
    await api(`/admin/products/${id}`, { method: 'PATCH', body: { visible: value } })
    toast.add({ title: value ? 'Now visible on storefront' : 'Hidden from storefront', color: 'success' })
  } catch {
    product.value.visible = previous
    toast.add({ title: 'Failed to update visibility', color: 'error' })
  } finally {
    savingVisible.value = false
  }
}

// Same immediate-save pattern as toggleVisible — "require an offer" is a
// storefront-behavior switch (hides the free-quantity stepper on the PDP),
// not a form field to batch into "Save details".
const savingRequireOffer = ref(false)
async function toggleRequireOfferSelection(value: boolean) {
  if (!product.value) return
  const previous = product.value.requireOfferSelection
  product.value.requireOfferSelection = value
  savingRequireOffer.value = true
  try {
    await api(`/admin/products/${id}`, { method: 'PATCH', body: { requireOfferSelection: value } })
    toast.add({ title: value ? 'Customers must now pick a quantity option' : 'Free-quantity stepper restored', color: 'success' })
  } catch {
    product.value.requireOfferSelection = previous
    toast.add({ title: 'Failed to update', color: 'error' })
  } finally {
    savingRequireOffer.value = false
  }
}

// ---- Content tab (richer-PDP sections: Key Benefits / FAQ / Specifications) ----
// Same "edit in place on `product`, one explicit Save button" pattern as the
// Details tab above, kept separate since these are optional marketing
// sections rather than core product fields.
const savingContent = ref(false)

function addBenefit() {
  if (!product.value) return
  product.value.keyBenefits.push('')
}
function removeBenefit(index: number) {
  if (!product.value) return
  product.value.keyBenefits.splice(index, 1)
}

function addFaq() {
  if (!product.value) return
  product.value.faqs.push({ question: '', answer: '' })
}
function removeFaq(index: number) {
  if (!product.value) return
  product.value.faqs.splice(index, 1)
}

function addSpecification() {
  if (!product.value) return
  product.value.specifications.push({ label: '', value: '' })
}
function removeSpecification(index: number) {
  if (!product.value) return
  product.value.specifications.splice(index, 1)
}

// Blank rows (an "Add" click left unfilled) are dropped rather than
// saved — a merchant abandoning a half-typed FAQ shouldn't publish
// an empty question to the storefront.
function contentPayload() {
  const p = product.value!
  return {
    keyBenefits: p.keyBenefits.map((b) => b.trim()).filter(Boolean),
    faqs: p.faqs.filter((f) => f.question.trim() && f.answer.trim()),
    specifications: p.specifications.filter((s) => s.label.trim() && s.value.trim())
  }
}

async function saveContent() {
  if (!product.value) return
  savingContent.value = true
  try {
    await api(`/admin/products/${id}`, {
      method: 'PATCH',
      body: contentPayload()
    })
    toast.add({ title: 'Content saved', color: 'success' })
    await refresh()
  } catch {
    toast.add({ title: 'Failed to save', color: 'error' })
  } finally {
    savingContent.value = false
  }
}

// ---- "Generate with AI" (Details tab) ----
// Paste a raw, messy content dump — title/description/specs/FAQ all mixed
// together, any language — plus optionally a few of the product's own
// photos, and a free Gemini call (see apps/api/src/landing-pages/
// gemini.service.ts's draftProductContent) drafts a polished, conversion-
// focused name/description/keyBenefits/faqs/specifications set. Never
// writes to the product directly: the draft is shown for review, and
// "Apply" only fills the in-memory `product` fields (across the Details and
// Content tabs) — the admin still hits those tabs' own Save buttons to
// actually persist, same as if they'd typed it by hand.
const aiRawContent = ref('')
const aiInstructions = ref('')
// Language the AI writes the whole draft in (name, description, benefits, FAQ, specs).
const aiLanguage = ref<'ar' | 'fr' | 'en'>('ar')
const AI_LANGUAGES = [
  { label: 'العربية (Arabic)', value: 'ar' },
  { label: 'Français (French)', value: 'fr' },
  { label: 'English', value: 'en' }
]
const aiSourceImages = ref<string[]>([])
const generatingContent = ref(false)
const aiDraft = ref<GeneratedProductContent | null>(null)

function toggleAiSourceImage(url: string) {
  const idx = aiSourceImages.value.indexOf(url)
  if (idx === -1) aiSourceImages.value.push(url)
  else aiSourceImages.value.splice(idx, 1)
}

async function generateProductContent() {
  if (!aiRawContent.value.trim()) {
    toast.add({ title: 'Paste some raw content first', color: 'warning' })
    return
  }
  generatingContent.value = true
  try {
    aiDraft.value = await api<GeneratedProductContent>(`/admin/products/${id}/generate-content`, {
      method: 'POST',
      body: {
        rawContent: aiRawContent.value,
        sourceImageUrls: aiSourceImages.value,
        instructions: aiInstructions.value.trim() || undefined,
        language: aiLanguage.value
      }
    })
    toast.add({ title: 'Draft ready — review below before applying', color: 'success' })
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Failed to generate content', description: data?.message, color: 'error' })
  } finally {
    generatingContent.value = false
  }
}

function applyGeneratedContent() {
  if (!product.value || !aiDraft.value) return
  product.value.name = aiDraft.value.name
  product.value.description = aiDraft.value.description
  product.value.keyBenefits = [...aiDraft.value.keyBenefits]
  product.value.faqs = aiDraft.value.faqs.map((f) => ({ ...f }))
  product.value.specifications = aiDraft.value.specifications.map((s) => ({ ...s }))
  aiDraft.value = null
  toast.add({ title: 'Applied — description is in the editor; benefits, FAQ and specifications are in the Content tab. Save both tabs to publish', color: 'success' })
}

function discardGeneratedContent() {
  aiDraft.value = null
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
  // Attribute values are truncated to 3 chars for the SKU suffix, so two
  // values sharing that prefix (e.g. "Blue"/"Blush", or Arabic values
  // sharing a common root) would otherwise collide. Disambiguate with a
  // trailing counter, checked against both this batch and the product's
  // existing variant SKUs, so every generated row gets a unique SKU.
  const existingSkus = new Set(product.value.variants.map((v) => v.sku))
  const usedSkus = new Set<string>()
  generatedVariants.value = combos
    .filter((combo) => combo.length > 0) // skip the degenerate empty combo
    .map((combo) => {
      const optionIds = combo.map((c) => c.optionId)
      const label = combo.map((c) => c.value).join(' / ')
      const skuSuffix = combo.map((c) => c.value.toUpperCase().slice(0, 3)).join('-')
      let sku = `${slugBase}-${skuSuffix}`
      let n = 2
      while (usedSkus.has(sku) || existingSkus.has(sku)) {
        sku = `${slugBase}-${skuSuffix}-${n}`
        n++
      }
      usedSkus.add(sku)
      return {
        optionIds,
        label,
        sku,
        priceCents: product.value!.priceCents,
        stockQuantity: 0,
        colorSwatches: combo
          .filter((c) => c.colorHex)
          .map((c) => ({ value: c.value, colorHex: c.colorHex }))
      }
    })
  showGenerate.value = true
}

// Lets the admin drop combinations they don't actually want to stock before
// bulk-creating (e.g. a color/size pairing that isn't offered).
function removeGeneratedVariant(index: number) {
  generatedVariants.value.splice(index, 1)
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
// The generator (AI landing pages: copy, backgrounds, editing) is its own
// component, shared with the funnel editor — see LandingPageGenerator.vue.
const productPageUrl = computed(() => (product.value ? `${runtimeConfig.public.storefrontBase}/products/${product.value.slug}` : ''))

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
  if (newOffer.type === 'BuyXGetYFree' && newOffer.freeQuantity <= 0) {
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
    api<{ items: { id: string; name: string; priceCents: number }[] }>('/admin/products?pageSize=100')
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
  <AdsPage :title="product?.name ?? 'Edit product'" wide>
  <template v-if="isSuperAdmin && product" #actions>
    <button class="btn btn-danger" type="button" @click="deleteProduct"><AdsIcon name="i-lucide-trash-2" />Delete product</button>
  </template>
  <template #breadcrumb>
    <NuxtLink to="/inventory">Products</NuxtLink><AdsIcon name="i-lucide-chevron-right" style="width: 14px; height: 14px" /><span>{{ product?.name ?? 'Edit product' }}</span>
  </template>
  <div v-if="pending" class="empty">Loading…</div>
  <div v-else-if="!product" class="empty">Product not found.</div>
  <div v-else class="stack" style="max-width: 900px">
    <!-- Tabs -->
    <AdsTabs
      v-model="activeTab"
      underline
      :items="[
        { label: 'Details', value: 'details', icon: 'i-lucide-file-text' },
        { label: 'Content', value: 'content', icon: 'i-lucide-layout-list' },
        { label: 'Variants', value: 'variants', icon: 'i-lucide-layers' },
        { label: 'Images', value: 'images', icon: 'i-lucide-image' },
        { label: 'Landing Page', value: 'landingPage', icon: 'i-lucide-sparkles' },
        { label: 'Offers', value: 'offers', icon: 'i-lucide-tag' },
        { label: 'Upsells', value: 'upsells', icon: 'i-lucide-plus-circle' },
        { label: 'Inventory', value: 'inventory', icon: 'i-lucide-boxes' }
      ]"
    />

    <!-- Details Tab -->
    <div v-show="activeTab === 'details'" class="stack">
      <!-- Generate with AI — see the script section above generateProductContent
           for the full contract. Draft only: nothing here is saved until
           "Apply to form" is clicked and then the Save button below it. -->
      <div class="card">
        <div>
          <h2 style="display: flex; align-items: center; gap: 8px">
            <AdsIcon name="i-lucide-wand-2" style="width: 18px; height: 18px; color: var(--teal)" /> Generate with AI
          </h2>
          <p class="muted">
            Paste everything you have about this product — title, description, specs, FAQ, all mixed together,
            any language — and optionally pick a few photos below. A free AI model drafts a short,
            conversion-focused name, description, key benefits, FAQ, and specifications from it.
          </p>
        </div>

        <AdsField label="Raw content">
          <AdsTextarea v-model="aiRawContent" placeholder="Paste everything you have about this product here…" :rows="6" class="w-full" />
        </AdsField>

        <AdsField v-if="product.images.length" label="Source photos (optional)">
          <div class="grid grid-cols-4 gap-2 sm:grid-cols-6">
            <button
              v-for="img in product.images"
              :key="img.id"
              type="button"
              class="relative aspect-square overflow-hidden rounded-md border-2 transition-colors"
              :class="aiSourceImages.includes(img.url) ? 'border-primary' : 'border-[var(--color-admin-border)]'"
              @click="toggleAiSourceImage(img.url)"
            >
              <img :src="resolveImgUrl(img.url)" :alt="img.altText ?? ''" class="size-full object-cover" />
              <div v-if="aiSourceImages.includes(img.url)" class="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-white">
                <AdsIcon name="i-lucide-check" class="size-3" />
              </div>
            </button>
          </div>
        </AdsField>

        <AdsField label="Output language" help="The name, description, benefits, FAQ and specifications are all written in this language.">
          <AdsSelect v-model="aiLanguage" :items="AI_LANGUAGES" class="w-full" />
        </AdsField>

        <AdsField label="Additional instructions (optional)">
          <AdsTextarea v-model="aiInstructions" placeholder="e.g. target a younger audience, emphasize the 2-year warranty…" :rows="2" class="w-full" />
        </AdsField>

        <AdsButton :loading="generatingContent" :disabled="!aiRawContent.trim()" icon="i-lucide-sparkles" color="primary" @click="generateProductContent">
          Generate
        </AdsButton>

        <div v-if="aiDraft" class="space-y-3 rounded-lg border border-[var(--color-admin-border)] p-4">
          <div class="flex items-center justify-between gap-2">
            <h3 style="font-size: 15px">Draft</h3>
            <div class="flex gap-2">
              <AdsButton size="xs" variant="ghost" color="neutral" label="Discard" @click="discardGeneratedContent" />
              <AdsButton size="xs" variant="solid" color="primary" icon="i-lucide-check" label="Apply to form" @click="applyGeneratedContent" />
            </div>
          </div>
          <div>
            <p class="text-xs font-bold uppercase text-muted">Name</p>
            <p class="text-sm text-highlighted">{{ aiDraft.name }}</p>
          </div>
          <div>
            <p class="text-xs font-bold uppercase text-muted">Description</p>
            <!-- eslint-disable-next-line vue/no-v-html -- HTML is whitelisted server-side (normalizeDescriptionHtml) -->
            <div
              class="text-sm text-highlighted [&_h3]:mt-2 [&_h3]:font-bold [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:ps-5"
              :dir="aiLanguage === 'ar' ? 'rtl' : 'ltr'"
              v-html="aiDraft.description"
            />
          </div>
          <div v-if="aiDraft.keyBenefits.length">
            <p class="text-xs font-bold uppercase text-muted">Key benefits</p>
            <ul class="list-inside list-disc text-sm text-highlighted">
              <li v-for="(b, i) in aiDraft.keyBenefits" :key="i">{{ b }}</li>
            </ul>
          </div>
          <div v-if="aiDraft.faqs.length" class="space-y-1.5">
            <p class="text-xs font-bold uppercase text-muted">FAQ</p>
            <div v-for="(f, i) in aiDraft.faqs" :key="i" class="text-sm">
              <p class="font-medium text-highlighted">{{ f.question }}</p>
              <p class="text-muted">{{ f.answer }}</p>
            </div>
          </div>
          <div v-if="aiDraft.specifications.length" class="space-y-1">
            <p class="text-xs font-bold uppercase text-muted">Specifications</p>
            <div v-for="(s, i) in aiDraft.specifications" :key="i" class="flex justify-between gap-3 text-sm">
              <span class="text-muted">{{ s.label }}</span>
              <span class="font-medium text-highlighted">{{ s.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <AdsField label="Name"><AdsInput v-model="product.name" class="w-full" /></AdsField>
        <AdsField label="Slug"><AdsInput v-model="product.slug" class="w-full" /></AdsField>
        <AdsField label="Description">
          <RichTextEditor v-model="product.description" />
        </AdsField>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AdsField label="Category">
            <AdsSelect
              v-model="product.categoryId"
              :items="[{ label: 'None', value: null }, ...(categories ?? []).map((c) => ({ label: c.name, value: c.id }))]"
              class="w-full"
            />
          </AdsField>
          <AdsField label="Price (DZD)"><AdsNumberInput v-model="productPriceDzd" :min="0" class="w-full" /></AdsField>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AdsField label="Unit cost (DZD)" help="What one unit costs you (purchase + packaging). Used for profit in Meta Ads reports; never shown to customers.">
            <AdsNumberInput v-model="productCostDzd" :min="0" class="w-full" />
          </AdsField>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AdsField label="Low-stock threshold"><AdsNumberInput v-model="product.lowStockThreshold" class="w-full" /></AdsField>
          <div class="flex items-end gap-4 pb-1">
            <AdsCheckbox v-model="product.featured" label="Featured" />
            <AdsCheckbox v-model="product.bestSeller" label="Best seller" />
          </div>
        </div>
        <div class="card" style="flex-direction: row; align-items: center; justify-content: space-between">
          <div class="min-w-0">
            <p class="text-sm font-medium text-highlighted">Visible on storefront</p>
            <p class="muted">
              Off hides this product from catalog, search, home sections, and other products' "related" — but its own product page
              and any AI landing pages keep working for anyone with the direct link. Use this for ad-only funnel products.
            </p>
          </div>
          <AdsSwitch :model-value="product.visible" :loading="savingVisible" @update:model-value="toggleVisible($event as boolean)" />
        </div>
        <div class="flex justify-end">
          <AdsButton :loading="savingDetails" icon="i-lucide-save" color="primary" @click="saveDetails">Save details</AdsButton>
        </div>
      </div>
    </div>

    <!-- Content Tab — optional richer-PDP sections (currently used by the
         Impulse template's Key Benefits/FAQ/Specifications sections).
         Empty by default; a template shows nothing rather than fabricate
         copy when a section is left blank. -->
    <div v-show="activeTab === 'content'" class="stack">
      <div class="card">
        <div>
          <h2 style="display: flex; align-items: center; gap: 8px">
            <AdsIcon name="i-lucide-sparkles" style="width: 18px; height: 18px; color: var(--teal)" /> Key benefits
          </h2>
          <p class="muted">Short, customer-facing bullet points (e.g. "Waterproof up to 50m") — up to 8.</p>
        </div>
        <div v-for="(benefit, idx) in product.keyBenefits" :key="idx" class="flex items-center gap-2">
          <AdsInput v-model="product.keyBenefits[idx]" placeholder="e.g. Waterproof up to 50m" class="flex-1" />
          <AdsButton icon="i-lucide-trash-2" size="sm" variant="ghost" color="error" @click="removeBenefit(idx)" />
        </div>
        <AdsButton v-if="product.keyBenefits.length < 8" icon="i-lucide-plus" size="sm" variant="outline" color="neutral" label="Add benefit" @click="addBenefit" />
      </div>

      <div class="card">
        <div>
          <h2 style="display: flex; align-items: center; gap: 8px">
            <AdsIcon name="i-lucide-circle-help" style="width: 18px; height: 18px; color: var(--teal)" /> FAQ
          </h2>
          <p class="muted">Common questions about this product — payment, delivery, sizing, returns, etc.</p>
        </div>
        <div v-for="(faq, idx) in product.faqs" :key="idx" class="space-y-2 rounded-md border border-[var(--color-admin-border)] p-3">
          <div class="flex items-start justify-between gap-2">
            <AdsInput v-model="faq.question" placeholder="Question" class="flex-1" />
            <AdsButton icon="i-lucide-trash-2" size="sm" variant="ghost" color="error" @click="removeFaq(idx)" />
          </div>
          <AdsTextarea v-model="faq.answer" placeholder="Answer" :rows="2" class="w-full" />
        </div>
        <AdsButton v-if="product.faqs.length < 20" icon="i-lucide-plus" size="sm" variant="outline" color="neutral" label="Add question" @click="addFaq" />
      </div>

      <div class="card">
        <div>
          <h2 style="display: flex; align-items: center; gap: 8px">
            <AdsIcon name="i-lucide-list-checks" style="width: 18px; height: 18px; color: var(--teal)" /> Specifications
          </h2>
          <p class="muted">Technical spec-table rows (e.g. "Material" / "Stainless steel") — distinct from variant options.</p>
        </div>
        <div v-for="(spec, idx) in product.specifications" :key="idx" class="flex items-center gap-2">
          <AdsInput v-model="spec.label" placeholder="Label (e.g. Material)" class="w-48" />
          <AdsInput v-model="spec.value" placeholder="Value (e.g. Stainless steel)" class="flex-1" />
          <AdsButton icon="i-lucide-trash-2" size="sm" variant="ghost" color="error" @click="removeSpecification(idx)" />
        </div>
        <AdsButton v-if="product.specifications.length < 30" icon="i-lucide-plus" size="sm" variant="outline" color="neutral" label="Add specification" @click="addSpecification" />
      </div>

      <div class="flex justify-end">
        <AdsButton :loading="savingContent" icon="i-lucide-save" color="primary" @click="saveContent">Save content</AdsButton>
      </div>
    </div>

    <!-- Variants Tab -->
    <div v-show="activeTab === 'variants'" class="stack">
      <!-- Applied attributes -->
      <div class="card">
        <h2>Attributes this product varies on</h2>
        <div v-if="product.attributes.length" class="mb-4 flex flex-wrap gap-2">
          <AdsBadge v-for="attr in product.attributes" :key="attr.id" color="info" variant="subtle" class="flex items-center gap-1 py-1 pl-2 pr-1">
            {{ attr.name }}
            <button class="ml-1 rounded p-0.5 hover:bg-error/20" aria-label="Remove attribute" @click="removeAttribute(attr.id)">
              <AdsIcon name="i-lucide-x" class="size-3" />
            </button>
          </AdsBadge>
        </div>
        <p v-else class="mb-4 text-sm text-muted">No attributes applied. Add one below to enable variant creation.</p>
        <div v-if="availableAttributes.length" class="flex items-center gap-2">
          <span class="muted">Add:</span>
          <AdsButton
            v-for="attr in availableAttributes"
            :key="attr.id"
            size="xs"
            variant="outline"
            color="neutral"
            :label="attr.name"
            @click="applyAttribute(attr.id)"
          />
        </div>
        <p v-else class="muted">All available attributes are applied (or none exist — create some in Settings).</p>
      </div>

      <!-- Variants table -->
      <div class="card">
        <div class="card-head">
          <h2>Variants ({{ product.variants.length }})</h2>
          <div v-if="product.attributes.length" class="flex gap-2">
            <AdsButton
              icon="i-lucide-sparkles"
              size="xs"
              variant="outline"
              color="primary"
              label="Generate all"
              @click="openGenerate"
            />
            <AdsButton
              icon="i-lucide-plus"
              size="xs"
              color="primary"
              label="Add variant"
              @click="openCreateVariant"
            />
          </div>
        </div>
        <div class="table-wrap" v-if="product.variants.length"><table style="min-width: 520px">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Options</th>
              <th class="num">Price</th>
              <th class="num">Stock</th>
              <th class="num">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in product.variants" :key="v.id">
              <td class="strong">{{ v.sku }}</td>
              <td class="muted">
                <AdsBadge v-for="opt in v.options" :key="opt.id" size="sm" color="neutral" variant="subtle" class="mr-1">
                  {{ opt.attributeName }}: {{ opt.value }}
                </AdsBadge>
              </td>
              <td class="num"><AdsPrice :amount-cents="v.priceCents" /></td>
              <td class="num">{{ v.stockQuantity }}</td>
              <td class="num">
                <AdsButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" @click="openEditVariant(v)" />
                <AdsButton icon="i-lucide-trash-2" size="xs" variant="ghost" color="error" @click="deleteVariant(v.id)" />
              </td>
            </tr>
          </tbody>
        </table></div>
        <p v-else-if="product.attributes.length" class="empty">No variants yet. Click "Add variant" to create one.</p>
        <p v-else class="empty">Apply at least one attribute above before creating variants.</p>
      </div>
    </div>

    <!-- Images Tab -->
    <div v-show="activeTab === 'images'" class="stack">
      <!-- Upload from computer -->
      <div class="card">
        <h2>Upload from computer</h2>
        <div class="flex items-center gap-3">
          <AdsButton
            icon="i-lucide-upload"
            color="primary"
            :loading="uploadingFile"
            label="Choose image file"
            @click="triggerFileUpload"
          />
          <p class="muted">JPG, PNG, WebP, GIF, SVG, AVIF — max 10 MB</p>
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
      <div class="card">
        <h2>Download from URL</h2>
        <p class="muted">Paste an image URL — the server downloads and stores it locally so it won't break if the source goes offline.</p>
        <div class="flex gap-3">
          <AdsInput v-model="downloadUrlInput" placeholder="https://example.com/product.jpg" class="flex-1" />
          <AdsInput v-model="newImageAlt" placeholder="Alt text (optional)" class="w-48" />
          <AdsButton icon="i-lucide-download" :loading="downloadingUrl" color="primary" :disabled="!downloadUrlInput" @click="downloadAndAddImage">Download</AdsButton>
        </div>
      </div>

      <!-- Direct link (external URL, not downloaded) -->
      <div class="card">
        <h2>Link external image</h2>
        <p class="muted">Use a remote URL directly (not copied to our server).</p>
        <div class="flex gap-3">
          <AdsInput v-model="newImageUrl" placeholder="https://…" class="flex-1" />
          <AdsButton icon="i-lucide-link" :loading="savingImage" color="neutral" variant="outline" :disabled="!newImageUrl" @click="addImage">Link</AdsButton>
        </div>
      </div>
      <div class="card">
        <div class="card-head">
          <h2>Gallery ({{ product.images.length }}) — first image is the hero</h2>
        </div>
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          <div v-for="(img, idx) in product.images" :key="img.id" class="group relative overflow-hidden rounded-lg border border-[var(--color-admin-border)]">
            <img :src="resolveImgUrl(img.url)" :alt="img.altText ?? ''" class="aspect-square size-full object-cover" />
            <div class="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <AdsButton icon="i-lucide-arrow-up" size="xs" variant="solid" color="neutral" :disabled="idx === 0" @click="moveImage(img.id, 'up')" />
              <AdsButton icon="i-lucide-arrow-down" size="xs" variant="solid" color="neutral" :disabled="idx === product.images.length - 1" @click="moveImage(img.id, 'down')" />
              <AdsButton icon="i-lucide-trash-2" size="xs" variant="solid" color="error" @click="deleteImage(img.id)" />
            </div>
            <AdsBadge v-if="idx === 0" size="sm" color="primary" variant="solid" class="absolute left-1 top-1">Hero</AdsBadge>
          </div>
        </div>
        <p v-if="!product.images.length" class="empty">No images yet.</p>
      </div>
    </div>

    <!-- Landing Page Tab -->
    <div v-show="activeTab === 'landingPage'" class="stack">
      <!-- Normal product page — always reachable, never affected by
           landing pages below. -->
      <div class="card" style="flex-direction: row; align-items: center; justify-content: space-between">
        <div class="min-w-0">
          <p class="text-sm font-medium text-highlighted">Product page</p>
          <a :href="productPageUrl" target="_blank" rel="noopener" class="truncate text-xs text-primary hover:underline">{{ productPageUrl }}</a>
        </div>
        <AdsButton icon="i-lucide-external-link" size="xs" variant="outline" color="neutral" label="View" :to="productPageUrl" target="_blank" />
      </div>

      <LandingPageGenerator :product="product" />
    </div>

    <!-- Offers Tab -->
    <div v-show="activeTab === 'offers'" class="stack">
      <div class="card">
        <div>
          <h2 style="display: flex; align-items: center; gap: 8px">
            <AdsIcon name="i-lucide-tag" style="width: 18px; height: 18px; color: var(--teal)" /> Offers
          </h2>
          <p class="muted">
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
              <p class="muted">{{ offerTypeOptions.find(t => t.value === offer.type)?.label }}</p>
            </div>
            <div class="flex items-center gap-2">
              <AdsSwitch
                :model-value="offer.enabled"
                :disabled="savingOfferId === offer.id"
                @update:model-value="toggleOfferEnabled(offer.id, $event as boolean)"
              />
              <AdsButton
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
        <p v-else class="muted">No offers yet.</p>
      </div>

      <!-- ADM-13 — for products only ever sold in fixed lots (wholesale
           packs of e.g. 40 or 80 units, never a single unit): require the
           customer to pick one of the offers above instead of using the
           normal free-quantity stepper. Reuses the offers system as the
           sole way to set quantity rather than an optional promo. -->
      <div class="card">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h3 style="font-size: 15px">Sell only in fixed quantities</h3>
            <p class="muted">
              Hides the free-quantity stepper on the product page — the customer must pick one of the offers
              above (e.g. "40 units", "80 units") to buy at all. The first enabled offer is pre-selected by default.
            </p>
          </div>
          <AdsSwitch
            :model-value="product.requireOfferSelection"
            :loading="savingRequireOffer"
            @update:model-value="toggleRequireOfferSelection($event as boolean)"
          />
        </div>
        <div v-if="product.requireOfferSelection && !product.offers.some(o => o.enabled)" class="flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
          <AdsIcon name="i-lucide-alert-triangle" class="size-4 shrink-0" />
          No enabled offers yet — this product currently can't be bought at all. Add at least one offer above.
        </div>
      </div>

      <div class="card">
        <h3 style="font-size: 15px">Add an offer</h3>

        <AdsField label="Type">
          <AdsSelect v-model="newOffer.type" :items="offerTypeOptions" value-key="value" label-key="label" class="w-full" />
        </AdsField>

        <AdsField :label="newOffer.type === 'BuyXGetYFree' ? 'Paid quantity' : 'Required quantity'">
          <AdsNumberInput v-model="newOffer.requiredQuantity" :min="0.5" :step="0.5" class="w-32" />
        </AdsField>

        <AdsField v-if="newOffer.type === 'BuyXGetYFree'" label="Free quantity">
          <AdsNumberInput v-model="newOffer.freeQuantity" :min="0.5" :step="0.5" class="w-32" />
        </AdsField>

        <AdsField v-if="newOffer.type === 'FixedBundlePrice'" label="Bundle price (DZD)" help="Total price for the required quantity.">
          <AdsNumberInput v-model="newOfferBundlePriceDzd" :min="0" class="w-40" />
        </AdsField>

        <p v-if="newOffer.type === 'FreeShipping'" class="muted">
          Display-only — there's no shipping-fee concept yet, so this shows a badge but doesn't change the order total.
        </p>

        <AdsButton :loading="creatingOffer" color="primary" icon="i-lucide-plus" @click="createOffer">
          Add offer
        </AdsButton>
      </div>
    </div>

    <!-- Upsells Tab -->
    <div v-show="activeTab === 'upsells'" class="stack">
      <div class="card">
        <div>
          <h2 style="display: flex; align-items: center; gap: 8px">
            <AdsIcon name="i-lucide-plus-circle" style="width: 18px; height: 18px; color: var(--teal)" /> Upsells
          </h2>
          <p class="muted">
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
              <p class="muted">
                {{ formatDzd(u.priceCentsOverride ?? u.upsellProduct.priceCents) }}
                <span v-if="u.priceCentsOverride != null">(normally {{ formatDzd(u.upsellProduct.priceCents) }})</span>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <AdsSwitch
                :model-value="u.enabled"
                :disabled="savingUpsellId === u.id"
                @update:model-value="toggleUpsellEnabled(u.id, $event as boolean)"
              />
              <AdsButton
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
        <p v-else class="muted">No upsells configured yet.</p>
      </div>

      <div class="card">
        <h3 style="font-size: 15px">Add an upsell</h3>

        <AdsField label="Suggested product">
          <AdsSelect
            v-model="newUpsellProductId"
            :items="otherProducts.map(p => ({ label: p.name, value: p.id }))"
            placeholder="Choose a product…"
            class="w-full"
          />
        </AdsField>

        <AdsField label="Special price (DZD)" help="Leave blank to offer it at its normal price.">
          <AdsNumberInput v-model="newUpsellPriceOverrideDzd" :min="0" class="w-40" />
        </AdsField>

        <AdsButton :loading="creatingUpsell" color="primary" icon="i-lucide-plus" @click="createUpsell">
          Add upsell
        </AdsButton>
      </div>
    </div>

    <!-- Inventory Tab -->
    <div v-show="activeTab === 'inventory'" class="stack">
      <div class="card">
        <h2>Current stock: <span class="tabular text-lg font-bold text-highlighted">{{ product.stockQuantity }}</span></h2>
        <NuxtLink class="btn btn-sm" :to="`/inventory/${id}`"><AdsIcon name="i-lucide-bar-chart-3" />Stock details</NuxtLink>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AdsField label="Change (+/-)">
            <AdsNumberInput v-model="adjustDelta" class="w-full" />
          </AdsField>
          <AdsField label="Reason">
            <AdsSelect v-model="adjustReason" :items="['Restock', 'Correction', 'Damage', 'Sale', 'Return']" class="w-full" />
          </AdsField>
          <AdsField label="Note">
            <AdsInput v-model="adjustNote" placeholder="Optional…" class="w-full" />
          </AdsField>
        </div>
        <p class="mt-3 text-sm text-muted">New stock: <span class="tabular font-medium">{{ product.stockQuantity + adjustDelta }}</span></p>
        <div class="mt-4 flex justify-end">
          <AdsButton :loading="savingAdjust" color="primary" @click="saveAdjust">Save adjustment</AdsButton>
        </div>
      </div>
    </div>
  </div>

  <!-- Variant modal -->
  <AdsDialog v-model:open="showVariantModalBool" :title="`${editingVariant?.id ? 'Edit' : 'New'} variant`">
      <template v-if="editingVariant">
        <AdsField label="SKU"><AdsInput v-model="editingVariant.sku" class="w-full" /></AdsField>
        <div class="grid-2">
          <AdsField label="Price (DZD)"><AdsNumberInput v-model="editingVariantPriceDzd" :min="0" class="w-full" /></AdsField>
          <AdsField label="Stock"><AdsNumberInput v-model="editingVariant.stockQuantity" class="w-full" /></AdsField>
        </div>
        <!-- Option selectors: one per applied attribute, rendered by type -->
        <div v-for="attr in product?.attributes" :key="attr.id" class="stack" style="gap: 8px">
          <b style="font-size: 14px">{{ attr.name }} <span class="muted">({{ attr.type }})</span></b>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in attr.options"
              :key="opt.id"
              type="button"
              class="tag"
              style="cursor: pointer; padding: 6px 10px"
              :style="editingVariant.optionIds.includes(opt.id) ? 'background: var(--teal); color: var(--ivory); border-color: var(--teal)' : ''"
              :aria-pressed="editingVariant.optionIds.includes(opt.id)"
              @click="editingVariant.optionIds = editingVariant.optionIds.includes(opt.id) ? editingVariant.optionIds.filter((x) => x !== opt.id) : [...editingVariant.optionIds, opt.id]"
            >
              <!-- Color: hex swatch -->
              <span v-if="attr.type === 'Color' && opt.colorHex" class="size-4 rounded-full border border-current/20" :style="{ backgroundColor: opt.colorHex }" />
              <!-- Swatch: image thumbnail -->
              <img v-if="attr.type === 'Swatch' && opt.displayValue" :src="opt.displayValue" :alt="opt.value" class="size-5 rounded object-cover" />
              <!-- Size: bold uppercase -->
              <span v-if="attr.type === 'Size'" class="font-bold uppercase">{{ opt.value }}</span>
              <!-- Boolean: icon -->
              <AdsIcon v-else-if="attr.type === 'Boolean'" :name="opt.value === 'Yes' ? 'i-lucide-check' : 'i-lucide-x'" class="size-4" />
              <!-- Measurement: value + unit -->
              <span v-else-if="attr.type === 'Measurement'">{{ opt.value }}<span v-if="opt.displayValue" class="text-muted"> {{ opt.displayValue }}</span></span>
              <!-- Text / Number (default) -->
              <span v-else>{{ opt.value }}</span>
            </button>
          </div>
        </div>
      </template>
    <template #footer>
      <button class="btn" type="button" @click="showVariantModalBool = false">Cancel</button>
      <AdsButton :loading="savingVariant" label="Save variant" @click="saveVariant">Save variant</AdsButton>
    </template>
  </AdsDialog>

  <!-- Generate variants modal — Cartesian product preview -->
  <AdsDialog v-model:open="showGenerateBool" title="Generate variants" width="lg">
        <div><span class="pill shipping">{{ generatingCount }} combinations</span></div>
        <p class="muted">
          All combinations from the product's applied attributes. Edit SKU, price, and stock for each,
          remove any you don't want, then click "Create all" to add the rest in bulk.
        </p>

        <!-- Preview table -->
        <div v-if="generatedVariants.length" style="max-height: 384px; overflow-y: auto">
          <div class="table-wrap"><table style="min-width: 520px">
            <thead>
              <tr>
                <th>Combination</th>
                <th>SKU</th>
                <th class="num">Price</th>
                <th class="num">Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(gv, i) in generatedVariants" :key="i">
                <td>
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
                <td><AdsInput v-model="gv.sku" size="xs" class="w-32" /></td>
                <td>
                  <AdsNumberInput
                    :model-value="gv.priceCents / 100"
                    :min="0"
                    size="xs"
                    class="w-24"
                    @update:model-value="(v) => (gv.priceCents = Math.round((Number(v) || 0) * 100))"
                  />
                </td>
                <td><AdsNumberInput v-model="gv.stockQuantity" size="xs" class="w-20" /></td>
                <td class="num">
                  <AdsButton icon="i-lucide-x" size="xs" variant="ghost" color="error" title="Remove" @click="removeGeneratedVariant(i)" />
                </td>
              </tr>
            </tbody>
          </table></div>
        </div>
        <p v-else class="empty">
          All combinations removed. Click "Regenerate" to start over.
        </p>

    <template #footer>
      <AdsButton appearance="subtle" size="sm" icon="i-lucide-rotate-ccw" label="Regenerate" style="margin-right: auto" @click="openGenerate" />
      <button class="btn" type="button" @click="showGenerateBool = false">Cancel</button>
      <AdsButton :disabled="!generatedVariants.length" :loading="generating" icon="i-lucide-check" label="Create all" @click="createGeneratedVariants" />
    </template>
  </AdsDialog>

  
</AdsPage>
</template>
