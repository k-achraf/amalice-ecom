<script setup lang="ts">
import type {
  AdCreativeType,
  AdTestPlatform,
  AdTestStatus,
  Product,
  SourcedProductDetail,
  SourcedProductStatus,
  SourcingRequestStatus,
  VideoCreativeStatus
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
  requestedQuantity: number
  requestedCountry: string
  unitCostCents: number | null
  status: SourcingRequestStatus
  notes: string
}
interface VideoCreativeFormState {
  url: string
  platform: AdTestPlatform | null
  name: string
  angle: string
  hook: string
  description: string
  status: VideoCreativeStatus
  notes: string
}
interface CompetitorFormState {
  name: string
  url: string
  priceCents: number | null
  details: string
}

const route = useRoute()
const id = route.params.id as string
const api = useAdminApi()
const toast = useToast()
const runtimeConfig = useRuntimeConfig()

const { data: sourced, pending, refresh } = await useAdminFetch<SourcedProductDetail>(`/admin/sourcing/products/${id}`, { key: `admin-sourcing-product-${id}` })
// pageSize capped at 100 by ProductListQuerySchema — see google-sheets.vue's
// comment on the same fix; a larger value 400s and useAdminFetch swallows it
// silently, leaving this picker looking empty instead of erroring visibly.
const { data: products } = await useAdminFetch<{ items: Product[] }>('/admin/products?pageSize=100', { key: 'admin-sourcing-all-products' })

useHead({ title: () => sourced.value?.name ?? 'Sourced product' })

const activeTab = ref<'view' | 'overview' | 'media' | 'adTests' | 'requests' | 'videoCreatives' | 'competitors'>('view')

// Local uploads are stored relative (/uploads/xxx) — resolve against the API
// base for display, same pattern as products/[id].vue's Images tab.
function resolveMediaUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${runtimeConfig.public.apiBase}${url}`
}

const statusOptions = SOURCED_PRODUCT_STATUSES.map((s) => ({ label: s, value: s }))
const statusColor: Record<SourcedProductStatus, 'neutral' | 'info' | 'warning' | 'error' | 'success' | 'primary'> = {
  Researching: 'neutral',
  Testing: 'info',
  TestPassed: 'success',
  TestFailed: 'error',
  Sourcing: 'warning',
  Received: 'primary',
  Live: 'success',
  Discontinued: 'neutral'
}
const platformOptions: AdTestPlatform[] = ['Facebook', 'TikTok', 'Snapchat', 'Google', 'Other']
const creativeTypeOptions: AdCreativeType[] = ['Image', 'Video']
const adTestStatusOptions: AdTestStatus[] = ['Running', 'Passed', 'Failed']
const requestStatusOptions: SourcingRequestStatus[] = ['Requested', 'Confirmed', 'Shipped', 'Received', 'Cancelled']
const videoCreativeStatusOptions: VideoCreativeStatus[] = ['Idea', 'Testing', 'Winner', 'Killed']
const videoCreativeStatusColor: Record<VideoCreativeStatus, 'neutral' | 'info' | 'success' | 'error'> = {
  Idea: 'neutral',
  Testing: 'info',
  Winner: 'success',
  Killed: 'error'
}

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
  Object.assign(requestForm, { requestedQuantity: 1, requestedCountry: '', unitCostCents: null, status: 'Requested', notes: '' })
  showRequestModal.value = true
}

function openEditRequest(r: SourcedProductDetail['sourcingRequests'][number]) {
  editingRequestId.value = r.id
  Object.assign(requestForm, {
    requestedQuantity: r.requestedQuantity,
    requestedCountry: r.requestedCountry,
    unitCostCents: r.unitCostCents,
    status: r.status,
    notes: r.notes ?? ''
  })
  showRequestModal.value = true
}

async function saveRequest() {
  if (!requestForm.requestedCountry.trim()) return
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

// ---- Media tab (images/videos) ----
const uploadingFile = ref(false)
const downloadingUrl = ref(false)
const downloadUrlInput = ref('')
const newMediaUrl = ref('')
const newMediaCaption = ref('')
const savingMediaLink = ref(false)

const fileInput = ref<HTMLInputElement | null>(null)
function triggerFileUpload() {
  fileInput.value?.click()
}

function guessMediaType(url: string): 'Image' | 'Video' {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) ? 'Video' : 'Image'
}

async function onFileSelected(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  uploadingFile.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const auth = useAuthStore()
    const res = await $fetch<{ url: string }>('/admin/upload', {
      baseURL: runtimeConfig.public.apiBase,
      method: 'POST',
      body: formData,
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    await api(`/admin/sourcing/products/${id}/media`, {
      method: 'POST',
      body: { type: file.type.startsWith('video/') ? 'Video' : 'Image', url: res.url, caption: file.name }
    })
    await refresh()
    toast.add({ title: 'Uploaded', color: 'success' })
  } catch {
    toast.add({ title: 'Upload failed', color: 'error' })
  } finally {
    uploadingFile.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function downloadAndAddMedia() {
  if (!downloadUrlInput.value) return
  downloadingUrl.value = true
  try {
    const res = await api<{ url: string }>('/admin/upload-from-url', { method: 'POST', body: { url: downloadUrlInput.value } })
    await api(`/admin/sourcing/products/${id}/media`, { method: 'POST', body: { type: guessMediaType(res.url), url: res.url } })
    downloadUrlInput.value = ''
    await refresh()
    toast.add({ title: 'Downloaded and added', color: 'success' })
  } catch {
    toast.add({ title: 'Download failed — check the URL', color: 'error' })
  } finally {
    downloadingUrl.value = false
  }
}

async function addMediaLink() {
  if (!newMediaUrl.value) return
  savingMediaLink.value = true
  try {
    await api(`/admin/sourcing/products/${id}/media`, {
      method: 'POST',
      body: { type: guessMediaType(newMediaUrl.value), url: newMediaUrl.value, caption: newMediaCaption.value || null }
    })
    newMediaUrl.value = ''
    newMediaCaption.value = ''
    await refresh()
    toast.add({ title: 'Added', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to add', color: 'error' })
  } finally {
    savingMediaLink.value = false
  }
}

async function deleteMedia(mediaId: string) {
  try {
    await api(`/admin/sourcing/products/media/${mediaId}`, { method: 'DELETE' })
    await refresh()
  } catch {
    toast.add({ title: 'Failed to remove', color: 'error' })
  }
}

async function moveMedia(mediaId: string, direction: 'up' | 'down') {
  if (!sourced.value) return
  const items = [...sourced.value.media]
  const idx = items.findIndex((m) => m.id === mediaId)
  if (idx < 0) return
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= items.length) return
  const a = items[idx]!
  const b = items[swapIdx]!
  items[idx] = b
  items[swapIdx] = a
  await api(`/admin/sourcing/products/${id}/media/reorder`, { method: 'POST', body: { orderedIds: items.map((m) => m.id) } })
  await refresh()
}

// ---- Links tab (where this product is listed elsewhere) ----
const newLinkLabel = ref('')
const newLinkUrl = ref('')
const savingLink = ref(false)
const editingLinkId = ref<string | null>(null)
const editLinkLabel = ref('')
const editLinkUrl = ref('')

async function addLink() {
  if (!newLinkLabel.value.trim() || !newLinkUrl.value.trim()) return
  savingLink.value = true
  try {
    await api(`/admin/sourcing/products/${id}/links`, { method: 'POST', body: { label: newLinkLabel.value, url: newLinkUrl.value } })
    newLinkLabel.value = ''
    newLinkUrl.value = ''
    await refresh()
    toast.add({ title: 'Link added', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to add link', color: 'error' })
  } finally {
    savingLink.value = false
  }
}

function openEditLink(l: SourcedProductDetail['links'][number]) {
  editingLinkId.value = l.id
  editLinkLabel.value = l.label
  editLinkUrl.value = l.url
}

async function saveEditLink() {
  if (!editingLinkId.value || !editLinkLabel.value.trim() || !editLinkUrl.value.trim()) return
  savingLink.value = true
  try {
    await api(`/admin/sourcing/products/links/${editingLinkId.value}`, { method: 'PATCH', body: { label: editLinkLabel.value, url: editLinkUrl.value } })
    editingLinkId.value = null
    await refresh()
    toast.add({ title: 'Link updated', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to update link', color: 'error' })
  } finally {
    savingLink.value = false
  }
}

async function deleteLink(linkId: string) {
  try {
    await api(`/admin/sourcing/products/links/${linkId}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'Link removed', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to remove link', color: 'error' })
  }
}

// ---- Video Creatives tab ----
// Modal-based (not inline-row, like Links/Competitors) — enough fields
// (url/platform/name/angle/hook/description/status/notes) that an inline
// row editor would be unusably cramped, same reasoning as the Ad Test modal
// below.
const showVideoCreativeModal = ref(false)
const editingVideoCreativeId = ref<string | null>(null)
const videoCreativeForm = reactive<VideoCreativeFormState>({ url: '', platform: null, name: '', angle: '', hook: '', description: '', status: 'Idea', notes: '' })
const savingVideoCreative = ref(false)

function openCreateVideoCreative() {
  editingVideoCreativeId.value = null
  Object.assign(videoCreativeForm, { url: '', platform: null, name: '', angle: '', hook: '', description: '', status: 'Idea', notes: '' })
  showVideoCreativeModal.value = true
}

function openEditVideoCreative(v: SourcedProductDetail['videoCreatives'][number]) {
  editingVideoCreativeId.value = v.id
  Object.assign(videoCreativeForm, {
    url: v.url,
    platform: v.platform,
    name: v.name ?? '',
    angle: v.angle ?? '',
    hook: v.hook ?? '',
    description: v.description ?? '',
    status: v.status,
    notes: v.notes ?? ''
  })
  showVideoCreativeModal.value = true
}

async function saveVideoCreative() {
  if (!videoCreativeForm.url.trim()) return
  savingVideoCreative.value = true
  const body = {
    url: videoCreativeForm.url,
    platform: videoCreativeForm.platform,
    name: videoCreativeForm.name || null,
    angle: videoCreativeForm.angle || null,
    hook: videoCreativeForm.hook || null,
    description: videoCreativeForm.description || null,
    status: videoCreativeForm.status,
    notes: videoCreativeForm.notes || null
  }
  try {
    if (editingVideoCreativeId.value) {
      await api(`/admin/sourcing/products/video-creatives/${editingVideoCreativeId.value}`, { method: 'PATCH', body })
    } else {
      await api(`/admin/sourcing/products/${id}/video-creatives`, { method: 'POST', body })
    }
    showVideoCreativeModal.value = false
    await refresh()
    toast.add({ title: 'Video creative saved', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to save video creative', color: 'error' })
  } finally {
    savingVideoCreative.value = false
  }
}

async function deleteVideoCreative(videoCreativeId: string) {
  try {
    await api(`/admin/sourcing/products/video-creatives/${videoCreativeId}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'Video creative removed', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to remove video creative', color: 'error' })
  }
}

// ---- Competitors tab ----
const newCompetitor = reactive<CompetitorFormState>({ name: '', url: '', priceCents: null, details: '' })
const newCompetitorPriceDzd = computed<number | null>({
  get: () => (newCompetitor.priceCents == null ? null : newCompetitor.priceCents / 100),
  set: (v) => { newCompetitor.priceCents = v == null ? null : Math.round(v * 100) }
})
const savingCompetitor = ref(false)
const editingCompetitorId = ref<string | null>(null)
const editCompetitor = reactive<CompetitorFormState>({ name: '', url: '', priceCents: null, details: '' })
const editCompetitorPriceDzd = computed<number | null>({
  get: () => (editCompetitor.priceCents == null ? null : editCompetitor.priceCents / 100),
  set: (v) => { editCompetitor.priceCents = v == null ? null : Math.round(v * 100) }
})

async function addCompetitor() {
  if (!newCompetitor.url.trim()) return
  savingCompetitor.value = true
  try {
    await api(`/admin/sourcing/products/${id}/competitors`, {
      method: 'POST',
      body: { name: newCompetitor.name || null, url: newCompetitor.url, priceCents: newCompetitor.priceCents, details: newCompetitor.details || null }
    })
    Object.assign(newCompetitor, { name: '', url: '', priceCents: null, details: '' })
    await refresh()
    toast.add({ title: 'Competitor added', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to add competitor', color: 'error' })
  } finally {
    savingCompetitor.value = false
  }
}

function openEditCompetitor(c: SourcedProductDetail['competitors'][number]) {
  editingCompetitorId.value = c.id
  Object.assign(editCompetitor, { name: c.name ?? '', url: c.url, priceCents: c.priceCents, details: c.details ?? '' })
}

async function saveEditCompetitor() {
  if (!editingCompetitorId.value || !editCompetitor.url.trim()) return
  savingCompetitor.value = true
  try {
    await api(`/admin/sourcing/products/competitors/${editingCompetitorId.value}`, {
      method: 'PATCH',
      body: { name: editCompetitor.name || null, url: editCompetitor.url, priceCents: editCompetitor.priceCents, details: editCompetitor.details || null }
    })
    editingCompetitorId.value = null
    await refresh()
    toast.add({ title: 'Competitor updated', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to update competitor', color: 'error' })
  } finally {
    savingCompetitor.value = false
  }
}

async function deleteCompetitor(competitorId: string) {
  try {
    await api(`/admin/sourcing/products/competitors/${competitorId}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'Competitor removed', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to remove competitor', color: 'error' })
  }
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
            { label: 'View', value: 'view', icon: 'i-lucide-eye' },
            { label: 'Overview', value: 'overview', icon: 'i-lucide-file-text' },
            { label: 'Media & Links', value: 'media', icon: 'i-lucide-images' },
            { label: 'Video Creatives', value: 'videoCreatives', icon: 'i-lucide-clapperboard' },
            { label: 'Competitors', value: 'competitors', icon: 'i-lucide-swords' },
            { label: 'Ad Tests', value: 'adTests', icon: 'i-lucide-megaphone' },
            { label: 'Sourcing Requests', value: 'requests', icon: 'i-lucide-truck' }
          ]"
        />

        <!-- View Tab — read-only, everything about this sourced product and
             all its related assets on one scroll, so reviewing a candidate
             (deciding whether to test/source it further) doesn't require
             clicking through 6 separate edit tabs. Every other tab stays
             the place to actually change something; this one is purely for
             looking. Each section links back to its edit tab via "Edit →". -->
        <div v-show="activeTab === 'view'" class="space-y-5">
          <div class="admin-kpi-card p-6">
            <div class="flex flex-wrap items-start gap-5">
              <img v-if="sourced.imageUrl" :src="sourced.imageUrl" class="size-24 shrink-0 rounded-lg object-cover" />
              <div v-else class="flex size-24 shrink-0 items-center justify-center rounded-lg bg-[var(--color-admin-surface-tint)]"><UIcon name="i-lucide-package-search" class="size-8 text-muted" /></div>
              <div class="min-w-0 flex-1 space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="text-xl font-semibold text-highlighted">{{ sourced.name }}</h2>
                  <UBadge :color="statusColor[sourced.status]" variant="subtle">{{ sourced.status }}</UBadge>
                </div>
                <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
                  <span v-if="sourced.niche"><UIcon name="i-lucide-tag" class="mr-1 inline size-3.5" />{{ sourced.niche }}</span>
                  <a v-if="sourced.sourceUrl" :href="sourced.sourceUrl" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline"><UIcon name="i-lucide-external-link" class="mr-1 inline size-3.5" />Source</a>
                  <NuxtLink v-if="sourced.linkedProduct" :to="`/products/${sourced.linkedProduct.id}`" class="text-primary hover:underline"><UIcon name="i-lucide-link" class="mr-1 inline size-3.5" />{{ sourced.linkedProduct.name }} (live)</NuxtLink>
                </div>
                <p v-if="sourced.notes" class="whitespace-pre-wrap text-sm text-muted">{{ sourced.notes }}</p>
                <p class="text-xs text-muted">Added {{ new Date(sourced.createdAt).toLocaleDateString() }} · Updated {{ new Date(sourced.updatedAt).toLocaleDateString() }}</p>
              </div>
              <UButton icon="i-lucide-pencil" size="xs" variant="outline" color="neutral" label="Edit details" @click="activeTab = 'overview'" />
            </div>
          </div>

          <!-- Media -->
          <div class="admin-kpi-card p-5">
            <div class="mb-3 flex items-center justify-between">
              <h3 class="text-sm font-medium text-muted">Media ({{ sourced.media.length }})</h3>
              <UButton size="xs" variant="link" color="neutral" trailing-icon="i-lucide-arrow-right" label="Edit" @click="activeTab = 'media'" />
            </div>
            <div v-if="sourced.media.length" class="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6">
              <div v-for="m in sourced.media" :key="m.id" class="relative overflow-hidden rounded-lg border border-[var(--color-admin-border)]">
                <video v-if="m.type === 'Video'" :src="resolveMediaUrl(m.url)" class="aspect-square size-full object-cover" muted />
                <img v-else :src="resolveMediaUrl(m.url)" :alt="m.caption ?? ''" class="aspect-square size-full object-cover" />
              </div>
            </div>
            <p v-else class="py-6 text-center text-sm text-muted">No media yet.</p>
          </div>

          <!-- Links -->
          <div class="admin-kpi-card p-5">
            <div class="mb-3 flex items-center justify-between">
              <h3 class="text-sm font-medium text-muted">Links ({{ sourced.links.length }})</h3>
              <UButton size="xs" variant="link" color="neutral" trailing-icon="i-lucide-arrow-right" label="Edit" @click="activeTab = 'media'" />
            </div>
            <div v-if="sourced.links.length" class="flex flex-wrap gap-2">
              <a v-for="l in sourced.links" :key="l.id" :href="l.url" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-admin-border)] px-3 py-1 text-xs text-primary hover:underline">
                <UBadge color="neutral" variant="subtle" size="sm">{{ l.label }}</UBadge>{{ l.url }}
              </a>
            </div>
            <p v-else class="py-2 text-sm text-muted">No links yet.</p>
          </div>

          <!-- Video Creatives -->
          <div class="admin-kpi-card p-5">
            <div class="mb-3 flex items-center justify-between">
              <h3 class="text-sm font-medium text-muted">Video creatives ({{ sourced.videoCreatives.length }})</h3>
              <UButton size="xs" variant="link" color="neutral" trailing-icon="i-lucide-arrow-right" label="Edit" @click="activeTab = 'videoCreatives'" />
            </div>
            <div v-if="sourced.videoCreatives.length" class="space-y-3">
              <div v-for="v in sourced.videoCreatives" :key="v.id" class="rounded-lg border border-[var(--color-admin-border)] p-3">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium text-highlighted">{{ v.name || 'Untitled creative' }}</span>
                  <UBadge :color="videoCreativeStatusColor[v.status]" variant="subtle" size="sm">{{ v.status }}</UBadge>
                  <UBadge v-if="v.platform" color="neutral" variant="subtle" size="sm">{{ v.platform }}</UBadge>
                </div>
                <a :href="v.url" target="_blank" rel="noopener noreferrer" class="mt-1 block truncate text-sm text-primary hover:underline">{{ v.url }}</a>
                <dl v-if="v.angle || v.hook || v.description" class="mt-2 space-y-1 text-sm">
                  <div v-if="v.angle" class="flex gap-2"><dt class="w-20 shrink-0 text-muted">Angle</dt><dd class="text-highlighted">{{ v.angle }}</dd></div>
                  <div v-if="v.hook" class="flex gap-2"><dt class="w-20 shrink-0 text-muted">Hook</dt><dd>{{ v.hook }}</dd></div>
                  <div v-if="v.description" class="flex gap-2"><dt class="w-20 shrink-0 text-muted">Description</dt><dd class="text-muted">{{ v.description }}</dd></div>
                </dl>
              </div>
            </div>
            <p v-else class="py-2 text-sm text-muted">No video creatives yet.</p>
          </div>

          <!-- Competitors -->
          <div class="admin-kpi-card p-5">
            <div class="mb-3 flex items-center justify-between">
              <h3 class="text-sm font-medium text-muted">Competitors ({{ sourced.competitors.length }})</h3>
              <UButton size="xs" variant="link" color="neutral" trailing-icon="i-lucide-arrow-right" label="Edit" @click="activeTab = 'competitors'" />
            </div>
            <table v-if="sourced.competitors.length" class="admin-table w-full text-sm">
              <thead>
                <tr>
                  <th class="px-3 py-2 text-left">Name</th>
                  <th class="px-3 py-2 text-left">Link</th>
                  <th class="px-3 py-2 text-right">Price</th>
                  <th class="px-3 py-2 text-left">Details</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in sourced.competitors" :key="c.id">
                  <td class="px-3 py-2 font-medium text-highlighted">{{ c.name || '—' }}</td>
                  <td class="px-3 py-2"><a :href="c.url" target="_blank" rel="noopener noreferrer" class="truncate text-primary hover:underline">{{ c.url }}</a></td>
                  <td class="tabular px-3 py-2 text-right">{{ c.priceCents == null ? '—' : formatDzd(c.priceCents) }}</td>
                  <td class="max-w-64 truncate px-3 py-2 text-muted" :title="c.details ?? ''">{{ c.details || '—' }}</td>
                </tr>
              </tbody>
            </table>
            <p v-else class="py-2 text-sm text-muted">No competitors logged yet.</p>
          </div>

          <!-- Ad Tests -->
          <div class="admin-kpi-card p-5">
            <div class="mb-3 flex items-center justify-between">
              <h3 class="text-sm font-medium text-muted">Ad tests ({{ sourced.adTests.length }})</h3>
              <UButton size="xs" variant="link" color="neutral" trailing-icon="i-lucide-arrow-right" label="Edit" @click="activeTab = 'adTests'" />
            </div>
            <table v-if="sourced.adTests.length" class="admin-table w-full text-sm">
              <thead>
                <tr>
                  <th class="px-3 py-2 text-left">Platform</th>
                  <th class="px-3 py-2 text-right">Price</th>
                  <th class="px-3 py-2 text-right">CPA</th>
                  <th class="px-3 py-2 text-right">ROAS</th>
                  <th class="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in sourced.adTests" :key="t.id">
                  <td class="px-3 py-2">
                    <div class="flex items-center gap-1.5">{{ t.platform }}<UIcon v-if="t.isWinner" name="i-lucide-trophy" class="size-3.5 text-warning" /></div>
                  </td>
                  <td class="tabular px-3 py-2 text-right">{{ formatDzd(t.priceCents) }}</td>
                  <td class="tabular px-3 py-2 text-right">{{ adTestCpaCents(t) == null ? '—' : formatDzd(adTestCpaCents(t)!) }}</td>
                  <td class="tabular px-3 py-2 text-right">{{ adTestRoas(t) == null ? '—' : `${adTestRoas(t)!.toFixed(2)}x` }}</td>
                  <td class="px-3 py-2"><UBadge :color="adTestStatusColor[t.status]" variant="subtle" size="sm">{{ t.status }}</UBadge></td>
                </tr>
              </tbody>
            </table>
            <p v-else class="py-2 text-sm text-muted">No ad tests yet.</p>
          </div>

          <!-- Sourcing Requests -->
          <div class="admin-kpi-card p-5">
            <div class="mb-3 flex items-center justify-between">
              <h3 class="text-sm font-medium text-muted">Sourcing requests ({{ sourced.sourcingRequests.length }})</h3>
              <UButton size="xs" variant="link" color="neutral" trailing-icon="i-lucide-arrow-right" label="Edit" @click="activeTab = 'requests'" />
            </div>
            <table v-if="sourced.sourcingRequests.length" class="admin-table w-full text-sm">
              <thead>
                <tr>
                  <th class="px-3 py-2 text-right">Quantity</th>
                  <th class="px-3 py-2 text-left">Country</th>
                  <th class="px-3 py-2 text-right">Unit cost</th>
                  <th class="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in sourced.sourcingRequests" :key="r.id">
                  <td class="tabular px-3 py-2 text-right">{{ r.requestedQuantity }}</td>
                  <td class="px-3 py-2 text-muted">{{ r.requestedCountry }}</td>
                  <td class="tabular px-3 py-2 text-right">{{ r.unitCostCents == null ? '—' : formatDzd(r.unitCostCents) }}</td>
                  <td class="px-3 py-2"><UBadge :color="requestStatusColor[r.status]" variant="subtle" size="sm">{{ r.status }}</UBadge></td>
                </tr>
              </tbody>
            </table>
            <p v-else class="py-2 text-sm text-muted">No sourcing requests yet.</p>
          </div>
        </div>

        <!-- Overview Tab -->
        <div v-show="activeTab === 'overview'" class="admin-kpi-card space-y-5 p-6">
          <UFormField label="Name"><UInput v-model="form.name" class="w-full" /></UFormField>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <!-- Media & Links Tab -->
        <div v-show="activeTab === 'media'" class="space-y-5">
          <!-- Upload from computer -->
          <div class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Upload image or video</h3>
            <div class="flex items-center gap-3">
              <UButton icon="i-lucide-upload" color="primary" :loading="uploadingFile" label="Choose file" @click="triggerFileUpload" />
              <p class="text-xs text-muted">Images (JPG/PNG/WebP/GIF/SVG/AVIF) or videos (MP4/WebM/MOV) — max 50 MB</p>
              <input ref="fileInput" type="file" accept="image/*,video/*" class="hidden" @change="onFileSelected" />
            </div>
          </div>

          <!-- Download from URL -->
          <div class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Download from URL</h3>
            <p class="mb-3 text-xs text-muted">Paste an image or video URL — the server downloads and stores it locally.</p>
            <div class="flex gap-3">
              <UInput v-model="downloadUrlInput" placeholder="https://example.com/photo.jpg" class="flex-1" />
              <UButton icon="i-lucide-download" :loading="downloadingUrl" color="primary" :disabled="!downloadUrlInput" @click="downloadAndAddMedia">Download</UButton>
            </div>
          </div>

          <!-- Link external -->
          <div class="admin-kpi-card p-5">
            <h3 class="mb-3 text-sm font-medium text-muted">Link external image/video</h3>
            <p class="mb-3 text-xs text-muted">Use a remote URL directly (not copied to our server) — e.g. a supplier's product photo/video CDN link.</p>
            <div class="flex gap-3">
              <UInput v-model="newMediaUrl" placeholder="https://…" class="flex-1" />
              <UInput v-model="newMediaCaption" placeholder="Caption (optional)" class="w-48" />
              <UButton icon="i-lucide-link" :loading="savingMediaLink" color="neutral" variant="outline" :disabled="!newMediaUrl" @click="addMediaLink">Link</UButton>
            </div>
          </div>

          <!-- Gallery -->
          <div class="admin-table-wrap">
            <div class="border-b border-[var(--color-admin-border)] p-4">
              <h3 class="text-sm font-medium text-muted">Gallery ({{ sourced.media.length }})</h3>
            </div>
            <div class="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4">
              <div v-for="(m, idx) in sourced.media" :key="m.id" class="group relative overflow-hidden rounded-lg border border-[var(--color-admin-border)]">
                <video v-if="m.type === 'Video'" :src="resolveMediaUrl(m.url)" class="aspect-square size-full object-cover" muted controls />
                <img v-else :src="resolveMediaUrl(m.url)" :alt="m.caption ?? ''" class="aspect-square size-full object-cover" />
                <div class="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <UButton icon="i-lucide-arrow-up" size="xs" variant="solid" color="neutral" :disabled="idx === 0" @click="moveMedia(m.id, 'up')" />
                  <UButton icon="i-lucide-arrow-down" size="xs" variant="solid" color="neutral" :disabled="idx === sourced.media.length - 1" @click="moveMedia(m.id, 'down')" />
                  <UButton icon="i-lucide-trash-2" size="xs" variant="solid" color="error" @click="deleteMedia(m.id)" />
                </div>
                <UBadge size="sm" :color="m.type === 'Video' ? 'primary' : 'neutral'" variant="solid" class="absolute left-1 top-1">{{ m.type }}</UBadge>
              </div>
            </div>
            <p v-if="!sourced.media.length" class="px-4 py-12 text-center text-sm text-muted">No images or videos yet.</p>
          </div>

          <!-- External links -->
          <div class="admin-table-wrap">
            <div class="flex items-center justify-between border-b border-[var(--color-admin-border)] p-4">
              <h3 class="text-sm font-medium text-muted">Links ({{ sourced.links.length }})</h3>
            </div>
            <p class="px-4 pt-3 text-xs text-muted">Where this product is listed elsewhere — the supplier's marketplace page, a competitor selling it, the ad post it was spotted in, etc.</p>
            <div class="space-y-2 p-4">
              <div v-for="l in sourced.links" :key="l.id" class="flex items-center gap-3 rounded-lg border border-[var(--color-admin-border)] bg-[var(--color-admin-bg)] p-3">
                <template v-if="editingLinkId === l.id">
                  <UInput v-model="editLinkLabel" placeholder="Label" class="w-40" />
                  <UInput v-model="editLinkUrl" placeholder="https://…" class="flex-1" />
                  <UButton icon="i-lucide-check" size="xs" color="primary" :loading="savingLink" @click="saveEditLink" />
                  <UButton icon="i-lucide-x" size="xs" variant="ghost" color="neutral" @click="editingLinkId = null" />
                </template>
                <template v-else>
                  <UBadge color="neutral" variant="subtle">{{ l.label }}</UBadge>
                  <a :href="l.url" target="_blank" rel="noopener noreferrer" class="flex-1 truncate text-sm text-primary hover:underline">{{ l.url }}</a>
                  <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" @click="openEditLink(l)" />
                  <UButton icon="i-lucide-trash-2" size="xs" variant="ghost" color="error" @click="deleteLink(l.id)" />
                </template>
              </div>
              <p v-if="!sourced.links.length" class="py-8 text-center text-sm text-muted">No links yet.</p>
            </div>
            <div class="flex gap-3 border-t border-[var(--color-admin-border)] p-4">
              <UInput v-model="newLinkLabel" placeholder="Label (e.g. AliExpress)" class="w-48" />
              <UInput v-model="newLinkUrl" placeholder="https://…" class="flex-1" />
              <UButton icon="i-lucide-plus" :loading="savingLink" color="primary" :disabled="!newLinkLabel.trim() || !newLinkUrl.trim()" @click="addLink">Add link</UButton>
            </div>
          </div>
        </div>

        <!-- Video Creatives Tab -->
        <div v-show="activeTab === 'videoCreatives'" class="admin-table-wrap">
          <div class="flex items-center justify-between border-b border-[var(--color-admin-border)] p-4">
            <h3 class="text-sm font-medium text-muted">Video creatives ({{ sourced.videoCreatives.length }})</h3>
            <UButton icon="i-lucide-plus" size="xs" color="primary" label="New video creative" @click="openCreateVideoCreative" />
          </div>
          <p class="px-4 pt-3 text-xs text-muted">Video ad-creatives worth keeping an eye on — yours or a competitor's — with the angle/hook/description that make it clear why each one is worth testing.</p>
          <div class="space-y-3 p-4">
            <div v-for="v in sourced.videoCreatives" :key="v.id" class="rounded-lg border border-[var(--color-admin-border)] bg-[var(--color-admin-bg)] p-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-medium text-highlighted">{{ v.name || 'Untitled creative' }}</span>
                    <UBadge :color="videoCreativeStatusColor[v.status]" variant="subtle">{{ v.status }}</UBadge>
                    <UBadge v-if="v.platform" color="neutral" variant="subtle">{{ v.platform }}</UBadge>
                  </div>
                  <a :href="v.url" target="_blank" rel="noopener noreferrer" class="mt-1 block truncate text-sm text-primary hover:underline">{{ v.url }}</a>
                </div>
                <div class="flex shrink-0 gap-1">
                  <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" @click="openEditVideoCreative(v)" />
                  <UButton icon="i-lucide-trash-2" size="xs" variant="ghost" color="error" @click="deleteVideoCreative(v.id)" />
                </div>
              </div>
              <dl v-if="v.angle || v.hook || v.description" class="mt-3 space-y-1.5 border-t border-[var(--color-admin-border)] pt-3 text-sm">
                <div v-if="v.angle" class="flex gap-2"><dt class="w-20 shrink-0 text-muted">Angle</dt><dd class="text-highlighted">{{ v.angle }}</dd></div>
                <div v-if="v.hook" class="flex gap-2"><dt class="w-20 shrink-0 text-muted">Hook</dt><dd>{{ v.hook }}</dd></div>
                <div v-if="v.description" class="flex gap-2"><dt class="w-20 shrink-0 text-muted">Description</dt><dd class="text-muted">{{ v.description }}</dd></div>
              </dl>
              <p v-if="v.notes" class="mt-2 text-xs text-muted">{{ v.notes }}</p>
            </div>
            <p v-if="!sourced.videoCreatives.length" class="py-8 text-center text-sm text-muted">No video creatives yet. Click "New video creative" to log one.</p>
          </div>
        </div>

        <!-- Competitors Tab -->
        <div v-show="activeTab === 'competitors'" class="admin-table-wrap">
          <div class="flex items-center justify-between border-b border-[var(--color-admin-border)] p-4">
            <h3 class="text-sm font-medium text-muted">Competitors ({{ sourced.competitors.length }})</h3>
          </div>
          <p class="px-4 pt-3 text-xs text-muted">Who else is selling this product, at what price, and any other detail worth noting.</p>
          <table v-if="sourced.competitors.length" class="admin-table w-full text-sm">
            <thead>
              <tr>
                <th class="px-4 py-2.5 text-left">Name</th>
                <th class="px-4 py-2.5 text-left">Link</th>
                <th class="px-4 py-2.5 text-right">Price</th>
                <th class="px-4 py-2.5 text-left">Details</th>
                <th class="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in sourced.competitors" :key="c.id">
                <template v-if="editingCompetitorId === c.id">
                  <td class="px-4 py-3" colspan="5">
                    <div class="flex flex-wrap items-center gap-3">
                      <UInput v-model="editCompetitor.name" placeholder="Name (optional)" class="w-40" />
                      <UInput v-model="editCompetitor.url" placeholder="https://…" class="min-w-56 flex-1" />
                      <UInputNumber v-model="editCompetitorPriceDzd" :min="0" placeholder="Price (DZD)" class="w-36" />
                      <UButton icon="i-lucide-check" size="xs" color="primary" :loading="savingCompetitor" @click="saveEditCompetitor" />
                      <UButton icon="i-lucide-x" size="xs" variant="ghost" color="neutral" @click="editingCompetitorId = null" />
                    </div>
                    <UTextarea v-model="editCompetitor.details" placeholder="Details (optional)" class="mt-2 w-full" :rows="2" />
                  </td>
                </template>
                <template v-else>
                  <td class="px-4 py-3 font-medium text-highlighted">{{ c.name || '—' }}</td>
                  <td class="px-4 py-3"><a :href="c.url" target="_blank" rel="noopener noreferrer" class="truncate text-primary hover:underline">{{ c.url }}</a></td>
                  <td class="tabular px-4 py-3 text-right">{{ c.priceCents == null ? '—' : formatDzd(c.priceCents) }}</td>
                  <td class="max-w-64 truncate px-4 py-3 text-muted" :title="c.details ?? ''">{{ c.details || '—' }}</td>
                  <td class="px-4 py-3 text-right">
                    <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" @click="openEditCompetitor(c)" />
                    <UButton icon="i-lucide-trash-2" size="xs" variant="ghost" color="error" @click="deleteCompetitor(c.id)" />
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
          <p v-else class="px-4 py-8 text-center text-sm text-muted">No competitors logged yet.</p>
          <div class="space-y-3 border-t border-[var(--color-admin-border)] p-4">
            <div class="flex flex-wrap items-center gap-3">
              <UInput v-model="newCompetitor.name" placeholder="Name (optional)" class="w-40" />
              <UInput v-model="newCompetitor.url" placeholder="https://…" class="min-w-56 flex-1" />
              <UInputNumber v-model="newCompetitorPriceDzd" :min="0" placeholder="Price (DZD)" class="w-36" />
              <UButton icon="i-lucide-plus" :loading="savingCompetitor" color="primary" :disabled="!newCompetitor.url.trim()" @click="addCompetitor">Add</UButton>
            </div>
            <UTextarea v-model="newCompetitor.details" placeholder="Details (optional)" class="w-full" :rows="2" />
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
            <UButton icon="i-lucide-plus" size="xs" color="primary" label="New request" @click="openCreateRequest" />
          </div>
          <table v-if="sourced.sourcingRequests.length" class="admin-table w-full text-sm">
            <thead>
              <tr>
                <th class="px-4 py-2.5 text-right">Quantity</th>
                <th class="px-4 py-2.5 text-left">Country</th>
                <th class="px-4 py-2.5 text-right">Unit cost</th>
                <th class="px-4 py-2.5 text-left">Status</th>
                <th class="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in sourced.sourcingRequests" :key="r.id">
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
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <UFormField label="Platform">
                <USelect v-model="adTestForm.platform" :items="platformOptions" class="w-full" />
              </UFormField>
              <UFormField label="Price (DZD)"><UInputNumber v-model="adTestPriceDzd" :min="0" class="w-full" /></UFormField>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <UFormField label="Creative type">
                <USelect v-model="adTestForm.creativeType" :items="[{ label: 'None', value: null }, ...creativeTypeOptions.map((c) => ({ label: c, value: c }))]" value-key="value" label-key="label" class="w-full" />
              </UFormField>
              <UFormField label="Creative URL"><UInput v-model="adTestForm.creativeUrl" class="w-full" placeholder="https://…" /></UFormField>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <UFormField label="Ad spend (DZD)"><UInputNumber v-model="adTestSpendDzd" :min="0" class="w-full" /></UFormField>
              <UFormField label="Orders"><UInputNumber v-model="adTestForm.ordersCount" :min="0" class="w-full" /></UFormField>
              <UFormField label="Revenue (DZD)"><UInputNumber v-model="adTestRevenueDzd" :min="0" class="w-full" /></UFormField>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <UFormField label="Requested quantity"><UInputNumber v-model="requestForm.requestedQuantity" :min="1" class="w-full" /></UFormField>
              <UFormField label="Requested country"><UInput v-model="requestForm.requestedCountry" class="w-full" /></UFormField>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <UFormField label="Unit cost (DZD)"><UInputNumber v-model="requestUnitCostDzd" :min="0" class="w-full" /></UFormField>
              <UFormField label="Status">
                <USelect v-model="requestForm.status" :items="requestStatusOptions" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Notes"><UTextarea v-model="requestForm.notes" class="w-full" :rows="3" /></UFormField>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" label="Cancel" @click="showRequestModal = false" />
              <UButton :loading="savingRequest" :disabled="!requestForm.requestedCountry.trim()" label="Save" color="primary" @click="saveRequest" />
            </div>
          </div>
        </template>
      </UModal>

      <!-- Video creative modal -->
      <UModal v-model:open="showVideoCreativeModal">
        <template #content>
          <div class="space-y-4 p-6">
            <h3 class="text-lg font-semibold">{{ editingVideoCreativeId ? 'Edit' : 'New' }} video creative</h3>
            <UFormField label="Video URL"><UInput v-model="videoCreativeForm.url" class="w-full" placeholder="https://…" /></UFormField>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <UFormField label="Name" help="Short internal label"><UInput v-model="videoCreativeForm.name" class="w-full" placeholder="e.g. UGC unboxing v2" /></UFormField>
              <UFormField label="Platform">
                <USelect
                  v-model="videoCreativeForm.platform"
                  :items="[{ label: 'None', value: null }, ...platformOptions.map((p) => ({ label: p, value: p }))]"
                  value-key="value"
                  label-key="label"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Status">
                <USelect v-model="videoCreativeForm.status" :items="videoCreativeStatusOptions" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Angle" help="The marketing angle this creative is built around">
              <UInput v-model="videoCreativeForm.angle" class="w-full" placeholder="e.g. Pain point, Before/after, Social proof, Urgency" />
            </UFormField>
            <UFormField label="Hook" help="The opening line/visual — what stops the scroll">
              <UInput v-model="videoCreativeForm.hook" class="w-full" />
            </UFormField>
            <UFormField label="Description" help="What the creative shows/says beyond the hook — a short script summary">
              <UTextarea v-model="videoCreativeForm.description" class="w-full" :rows="3" />
            </UFormField>
            <UFormField label="Notes"><UTextarea v-model="videoCreativeForm.notes" class="w-full" :rows="2" /></UFormField>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" label="Cancel" @click="showVideoCreativeModal = false" />
              <UButton :loading="savingVideoCreative" :disabled="!videoCreativeForm.url.trim()" label="Save" color="primary" @click="saveVideoCreative" />
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
