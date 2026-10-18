<script setup lang="ts">
import {
  FUNNEL_STEP_TYPE_META,
  FunnelStepTypeSchema,
  getFunnelTemplate,
  type FunnelDetail,
  type FunnelStatus,
  type FunnelStepType,
  type FunnelStepView,
  type AdminProductDetail,
  type LandingSettings,
  type ProductLandingPage,
  type ProductListResponse
} from '@amalice/shared'

definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })

const route = useRoute()
const router = useRouter()
const api = useAdminApi()
const { run } = useApiAction()
const { resolveImageUrl } = useResolveImageUrl()
const toast = useToast()

const id = route.params.id as string
const funnelsBase = String(useRuntimeConfig().public.funnelsBase).replace(/\/+$/, '')
const publicUrl = computed(() => (funnel.value ? `${funnelsBase}/f/${funnel.value.slug}` : ''))
async function copyUrl() {
  try {
    await navigator.clipboard.writeText(publicUrl.value)
    toast.add({ title: 'Link copied', color: 'success' })
  } catch {
    toast.add({ title: 'Could not copy the link', color: 'error' })
  }
}
const { data: funnel, pending, error } = await useAdminFetch<FunnelDetail>(`/admin/funnels/${id}`, { key: `admin-funnel-${id}` })
const { data: products } = await useAdminFetch<ProductListResponse>('/admin/products', { key: 'admin-funnels-products', query: { page: '1', pageSize: '100' } })

useHead({ title: computed(() => funnel.value?.name ?? 'Funnel') })

const steps = computed<FunnelStepView[]>(() => funnel.value?.steps ?? [])
const template = computed(() => (funnel.value ? getFunnelTemplate(funnel.value.templateId) : undefined))
const productOptions = computed(() => (products.value?.items ?? []).map((p) => ({ label: p.name, value: p.id })))
const STATUS_PILL: Record<FunnelStatus, string> = { Live: 'active', Draft: 'draft', Paused: 'neutral' }
const OFFER_TYPES: FunnelStepType[] = ['Upsell', 'Downsell', 'OrderBump']
const isOffer = (t: FunnelStepType) => OFFER_TYPES.includes(t)

// Every mutation returns the full funnel, so state is replaced wholesale.
async function mutate(fn: () => Promise<FunnelDetail>, opts?: { success?: string; errorFallback?: string }) {
  const next = await run(fn, opts)
  if (next) funnel.value = next
  return next
}

// ---- settings ----
const form = reactive({ name: '', slug: '', productId: '', metaPixelId: '', tiktokPixelCode: '' })
watch(
  funnel,
  (f) => {
    if (!f) return
    form.name = f.name
    form.slug = f.slug
    form.productId = f.product.id
    form.metaPixelId = f.metaPixelId ?? ''
    form.tiktokPixelCode = f.tiktokPixelCode ?? ''
  },
  { immediate: true }
)
const dirty = computed(() => !!funnel.value && (form.name !== funnel.value.name || form.slug !== funnel.value.slug || form.productId !== funnel.value.product.id || form.metaPixelId !== (funnel.value.metaPixelId ?? '') || form.tiktokPixelCode !== (funnel.value.tiktokPixelCode ?? '')))
const saving = ref(false)
async function saveSettings() {
  saving.value = true
  await mutate(() => api<FunnelDetail>(`/admin/funnels/${id}`, { method: 'PATCH', body: { name: form.name, slug: form.slug, productId: form.productId, metaPixelId: form.metaPixelId.trim(), tiktokPixelCode: form.tiktokPixelCode.trim() } }), {
    success: 'Funnel saved',
    errorFallback: 'Could not save the funnel'
  })
  saving.value = false
}

const statusBusy = ref(false)
async function setStatus(status: FunnelStatus) {
  statusBusy.value = true
  await mutate(() => api<FunnelDetail>(`/admin/funnels/${id}`, { method: 'PATCH', body: { status } }), {
    success: status === 'Live' ? 'Funnel marked as live' : status === 'Paused' ? 'Funnel paused' : 'Funnel moved to draft'
  })
  statusBusy.value = false
}

async function duplicate() {
  const copy = await run(() => api<FunnelDetail>(`/admin/funnels/${id}/duplicate`, { method: 'POST' }), { success: 'Funnel duplicated' })
  if (copy) await router.push(`/funnels/${copy.id}`)
}

const { isSuperAdmin } = useDangerDelete()
async function remove() {
  if (!funnel.value || !confirm(`Delete "${funnel.value.name}"? This can't be undone.`)) return
  const ok = await run(() => api(`/admin/funnels/${id}`, { method: 'DELETE' }), { success: 'Funnel deleted' })
  if (ok) await router.push('/funnels')
}

// ---- steps ----
const stepBusy = ref<string | null>(null)

async function move(index: number, dir: -1 | 1) {
  const to = index + dir
  if (to < 0 || to >= steps.value.length) return
  const ids = steps.value.map((s) => s.id)
  ;[ids[index], ids[to]] = [ids[to]!, ids[index]!]
  stepBusy.value = steps.value[index]!.id
  await mutate(() => api<FunnelDetail>(`/admin/funnels/${id}/steps/reorder`, { method: 'POST', body: { stepIds: ids } }), { errorFallback: 'Could not reorder the steps' })
  stepBusy.value = null
}

async function toggleStep(step: FunnelStepView, enabled: boolean) {
  stepBusy.value = step.id
  await mutate(() => api<FunnelDetail>(`/admin/funnels/${id}/steps/${step.id}`, { method: 'PATCH', body: { enabled } }), { errorFallback: 'Could not update the step' })
  stepBusy.value = null
}

async function removeStep(step: FunnelStepView) {
  if (!confirm(`Remove the step "${step.name}"?`)) return
  stepBusy.value = step.id
  await mutate(() => api<FunnelDetail>(`/admin/funnels/${id}/steps/${step.id}`, { method: 'DELETE' }), { success: 'Step removed', errorFallback: 'Could not remove the step' })
  stepBusy.value = null
}

const newType = ref<FunnelStepType>('Upsell')
const adding = ref(false)
const typeOptions = FunnelStepTypeSchema.options.map((t) => ({ label: FUNNEL_STEP_TYPE_META[t].label, value: t }))
async function addStep() {
  adding.value = true
  await mutate(() => api<FunnelDetail>(`/admin/funnels/${id}/steps`, { method: 'POST', body: { type: newType.value } }), {
    success: 'Step added',
    errorFallback: 'Could not add the step'
  })
  adding.value = false
}

// ---- landing page tab ----
type Tab = 'flow' | 'landing' | 'stats' | 'orders'
const TABS: Tab[] = ['flow', 'landing', 'stats', 'orders']
const tab = ref<Tab>(TABS.includes(route.query.tab as Tab) ? (route.query.tab as Tab) : 'flow')
watch(tab, (t) => router.replace({ query: { ...route.query, tab: t === 'flow' ? undefined : t } }))
// The data tabs fetch on first open (v-if), then stay mounted so switching back is instant.
const opened = reactive({ stats: tab.value === 'stats', orders: tab.value === 'orders' })
watch(tab, (t) => { if (t === 'stats' || t === 'orders') opened[t] = true })

const landingSteps = computed(() => steps.value.filter((s) => s.type === 'Landing'))
const landingStepId = ref<string>('')
const landingStep = computed(() => landingSteps.value.find((s) => s.id === landingStepId.value) ?? landingSteps.value[0] ?? null)
watch(
  landingSteps,
  (list) => {
    if (!list.some((s) => s.id === landingStepId.value)) landingStepId.value = list[0]?.id ?? ''
  },
  { immediate: true }
)

// The preview needs the product's photos/benefits/FAQ, and the image template needs its generated pages.
const productDetail = ref<AdminProductDetail | null>(null)
const productPages = ref<ProductLandingPage[]>([])
const loadingProduct = ref(false)
async function loadProduct(productId: string) {
  loadingProduct.value = true
  try {
    const [detail, pages] = await Promise.all([
      api<AdminProductDetail>(`/admin/products/${productId}`),
      api<ProductLandingPage[]>(`/admin/products/${productId}/landing-pages`).catch(() => [] as ProductLandingPage[])
    ])
    productDetail.value = detail
    productPages.value = pages
  } catch {
    productDetail.value = null
  } finally {
    loadingProduct.value = false
  }
}
watch(() => funnel.value?.product.id, (pid) => pid && loadProduct(pid), { immediate: true })

const savingLanding = ref(false)
async function saveLanding(landing: LandingSettings) {
  const step = landingStep.value
  if (!step) return
  savingLanding.value = true
  await mutate(
    () => api<FunnelDetail>(`/admin/funnels/${id}/steps/${step.id}`, { method: 'PATCH', body: { config: { ...step.config, landing } } }),
    { success: 'Landing page saved', errorFallback: 'Could not save the landing page' }
  )
  savingLanding.value = false
}

// A funnel without a landing step (e.g. "Quick order") can add one; it goes first.
const addingLanding = ref(false)
async function addLandingStep() {
  addingLanding.value = true
  const before = new Set(steps.value.map((s) => s.id))
  const next = await mutate(() => api<FunnelDetail>(`/admin/funnels/${id}/steps`, { method: 'POST', body: { type: 'Landing', name: 'Sales page' } }), {
    errorFallback: 'Could not add the landing page step'
  })
  const created = next?.steps.find((s) => !before.has(s.id))
  if (created && next) {
    const ids = [created.id, ...next.steps.filter((s) => s.id !== created.id).map((s) => s.id)]
    await mutate(() => api<FunnelDetail>(`/admin/funnels/${id}/steps/reorder`, { method: 'POST', body: { stepIds: ids } }))
  }
  addingLanding.value = false
}

// ---- step editor drawer ----
const editingId = ref<string | null>(null)
const editing = computed(() => steps.value.find((s) => s.id === editingId.value) ?? null)
const drawerOpen = computed({
  get: () => editing.value !== null,
  set: (v) => {
    if (!v) editingId.value = null
  }
})
const stepForm = reactive({ name: '', headline: '', offerProductId: '', priceDzd: null as number | null })
const savingStep = ref(false)

function openStep(step: FunnelStepView) {
  stepForm.name = step.name
  stepForm.headline = step.config.headline ?? ''
  stepForm.offerProductId = step.config.offerProductId ?? ''
  stepForm.priceDzd = step.config.priceCentsOverride != null ? step.config.priceCentsOverride / 100 : null
  editingId.value = step.id
}

const offerProduct = computed(() => products.value?.items.find((p) => p.id === stepForm.offerProductId))

async function saveStep() {
  if (!editing.value) return
  savingStep.value = true
  const offer = isOffer(editing.value.type)
  const next = await mutate(
    () =>
      api<FunnelDetail>(`/admin/funnels/${id}/steps/${editing.value!.id}`, {
        method: 'PATCH',
        body: {
          name: stepForm.name.trim(),
          config: {
            ...editing.value!.config,
            headline: stepForm.headline.trim() || null,
            ...(offer
              ? {
                  offerProductId: stepForm.offerProductId || null,
                  priceCentsOverride: stepForm.priceDzd != null && stepForm.offerProductId ? Math.round(Number(stepForm.priceDzd) * 100) : null
                }
              : {})
          }
        }
      }),
    { success: 'Step saved', errorFallback: 'Could not save the step' }
  )
  savingStep.value = false
  if (next) editingId.value = null
}

const fmtDzd = (cents: number) => `${(cents / 100).toLocaleString('en-US')} DA`
const warnings = computed(() => {
  const out: string[] = []
  const on = steps.value.filter((s) => s.enabled)
  if (!on.some((s) => s.type === 'OrderForm')) out.push('There is no active order form, so visitors cannot place an order.')
  const missing = on.filter((s) => isOffer(s.type) && !s.config.offerProductId)
  if (missing.length) out.push(`${missing.map((s) => `“${s.name}”`).join(', ')} ${missing.length === 1 ? 'has' : 'have'} no offer product yet.`)
  return out
})
</script>

<template>
  <AdsPage :title="funnel?.name ?? 'Funnel'" :description="funnel?.product.name ?? 'Funnel'">
    <template #breadcrumb>
      <NuxtLink to="/funnels">Funnels</NuxtLink><AdsIcon name="i-lucide-chevron-right" style="width: 14px; height: 14px" /><span>{{ funnel?.name ?? 'Funnel' }}</span>
    </template>
    <template v-if="funnel" #title-extra>
      <span class="pill" :class="STATUS_PILL[funnel.status]" style="margin-left: 10px; vertical-align: middle">{{ funnel.status }}</span>
    </template>
    <template v-if="funnel" #actions>
      <button class="btn hide-sm" type="button" @click="duplicate"><AdsIcon name="i-lucide-copy" />Duplicate</button>
      <button v-if="isSuperAdmin" class="btn btn-danger hide-sm" type="button" @click="remove"><AdsIcon name="i-lucide-trash-2" />Delete</button>
      <AdsButton v-if="funnel.status !== 'Live'" :loading="statusBusy" icon="i-lucide-check" @click="setStatus('Live')">{{ funnel.status === 'Paused' ? 'Resume' : 'Mark as live' }}</AdsButton>
      <AdsButton v-else appearance="default" :loading="statusBusy" icon="i-lucide-pause-circle" @click="setStatus('Paused')">Pause</AdsButton>
    </template>

    <div v-if="pending" class="empty">Loading…</div>
    <div v-else-if="error || !funnel" class="empty">Funnel not found.</div>
    <template v-else>
      <p v-if="funnel.status !== 'Live'" class="notice warn">
        <AdsIcon name="i-lucide-alert-triangle" />
        <span>This funnel is <b>{{ funnel.status }}</b>: its public page returns “not found” until you mark it live.</span>
      </p>
      <div v-else class="notice">
        <AdsIcon name="i-lucide-check-circle-2" />
        <span style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; min-width: 0">
          <span>Live at</span>
          <a :href="publicUrl" target="_blank" rel="noopener" class="mono" style="overflow-wrap: anywhere">{{ publicUrl }}</a>
          <button type="button" class="btn btn-sm" @click="copyUrl"><AdsIcon name="i-lucide-copy" />Copy link</button>
          <a :href="publicUrl" target="_blank" rel="noopener" class="btn btn-sm"><AdsIcon name="i-lucide-external-link" />Open page</a>
        </span>
      </div>

      <AdsTabs
        v-model="tab"
        underline
        :items="[{ label: 'Flow', value: 'flow' }, { label: 'Landing page', value: 'landing' }, { label: 'Stats', value: 'stats' }, { label: 'Orders', value: 'orders' }]"
      />

      <FunnelStats v-if="opened.stats" v-show="tab === 'stats'" :funnel-id="id" />
      <FunnelOrders v-if="opened.orders" v-show="tab === 'orders'" :funnel-id="id" />

      <section v-show="tab === 'landing'" class="stack" aria-label="Landing page settings">
        <div v-if="loadingProduct && !productDetail" class="empty">Loading the product…</div>
        <div v-else-if="!productDetail" class="empty">Could not load the funnel’s product.</div>
        <section v-else-if="!landingStep" class="card">
          <div class="empty" style="padding: 48px 20px">
            <AdsIcon name="i-lucide-image" style="width: 32px; height: 32px; color: var(--teal); display: block; margin: 0 auto" />
            <h2 style="font-size: 18px; margin-top: 10px; color: var(--pine)">This funnel has no landing page</h2>
            <p>Add a landing page step to choose a template and design the page visitors see first.</p>
            <button class="btn btn-primary" type="button" style="margin-top: 16px" :disabled="addingLanding" @click="addLandingStep"><AdsIcon name="i-lucide-plus" />Add a landing page</button>
          </div>
        </section>
        <template v-else>
          <div v-if="landingSteps.length > 1" class="field" style="flex-direction: row; align-items: center; gap: 10px">
            <span class="muted">Editing</span>
            <AdsSelect v-model="landingStepId" :items="landingSteps.map((s) => ({ label: s.name, value: s.id }))" size="sm" style="width: 240px" />
          </div>
          <FunnelLandingEditor :step="landingStep" :product="productDetail" :landing-pages="productPages" :saving="savingLanding" @save="saveLanding" @pages-changed="(list: ProductLandingPage[]) => (productPages = list)" />
        </template>
      </section>

      <div v-show="tab === 'flow'" class="split">
        <div class="stack">
          <section class="card" aria-label="Funnel flow">
            <div class="card-head"><h2>Funnel flow</h2><span class="muted">{{ steps.filter((s) => s.enabled).length }} of {{ steps.length }} steps active</span></div>
            <FunnelFlow :steps="steps" />
            <p v-for="w in warnings" :key="w" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>{{ w }}</span></p>
          </section>

          <section class="card" aria-label="Steps">
            <div class="card-head"><h2>Steps</h2></div>
            <ol class="step-list">
              <li v-for="(s, i) in steps" :key="s.id" class="step-row" :class="{ off: !s.enabled }">
                <span class="idx">{{ i + 1 }}</span>
                <span class="ico"><AdsIcon :name="FUNNEL_STEP_TYPE_META[s.type].icon" /></span>
                <div class="grow info">
                  <button type="button" class="name" @click="openStep(s)">{{ s.name }}</button>
                  <span class="muted">
                    {{ FUNNEL_STEP_TYPE_META[s.type].label }}
                    <template v-if="isOffer(s.type)">
                      ·
                      <template v-if="s.offerProduct">{{ s.offerProduct.name }} at {{ fmtDzd(s.config.priceCentsOverride ?? s.offerProduct.priceCents) }}</template>
                      <span v-else style="color: var(--warn-fg)">No product chosen</span>
                    </template>
                  </span>
                </div>
                <AdsSwitch :model-value="s.enabled" :disabled="stepBusy === s.id" :aria-label="`Enable ${s.name}`" @update:model-value="(v: boolean) => toggleStep(s, v)" />
                <AdsButton square appearance="subtle" size="sm" icon="i-lucide-arrow-up" :disabled="i === 0 || !!stepBusy" aria-label="Move up" @click="move(i, -1)" />
                <AdsButton square appearance="subtle" size="sm" icon="i-lucide-arrow-down" :disabled="i === steps.length - 1 || !!stepBusy" aria-label="Move down" @click="move(i, 1)" />
                <AdsButton square appearance="subtle" size="sm" icon="i-lucide-pencil" aria-label="Edit step" @click="openStep(s)" />
                <AdsButton square appearance="subtle" size="sm" icon="i-lucide-trash-2" :disabled="!!stepBusy" aria-label="Remove step" @click="removeStep(s)" />
              </li>
              <li v-if="!steps.length" class="empty">This funnel has no steps.</li>
            </ol>
            <div class="add-row">
              <AdsSelect v-model="newType" :items="typeOptions" size="sm" style="width: 200px" />
              <AdsButton appearance="default" size="sm" :loading="adding" icon="i-lucide-plus" @click="addStep">Add step</AdsButton>
              <span class="muted">{{ FUNNEL_STEP_TYPE_META[newType].description }}</span>
            </div>
          </section>
        </div>

        <div class="stack">
          <section class="card" aria-label="Settings">
            <div class="card-head"><h2>Settings</h2></div>
            <AdsField label="Name"><AdsInput v-model="form.name" /></AdsField>
            <AdsField label="Slug" help="Used in the funnel URL once the storefront serves funnels."><AdsInput v-model="form.slug" class="mono" /></AdsField>
            <AdsField label="Product"><AdsSelect v-model="form.productId" :items="productOptions" /></AdsField>
            <AdsField label="Meta pixel ID (this funnel)" help="Leave empty to use the store's pixel. Server-side events for this funnel's orders go to this pixel too, using the store's access token (works when both pixels are in the same Meta business)."><AdsInput v-model="form.metaPixelId" class="mono" placeholder="e.g. 1234567890123" /></AdsField>
            <AdsField label="TikTok pixel code (this funnel)" help="Leave empty to use the store's pixel."><AdsInput v-model="form.tiktokPixelCode" class="mono" placeholder="e.g. C1ABCDEFGH23" /></AdsField>
            <AdsButton :loading="saving" :disabled="!dirty || !form.name.trim() || !form.slug.trim()" icon="i-lucide-check" @click="saveSettings">Save settings</AdsButton>
          </section>

          <section class="card" aria-label="Template">
            <div class="card-head"><h2>Template</h2></div>
            <template v-if="template">
              <b>{{ template.name }}</b>
              <p class="muted">{{ template.description }}</p>
              <FunnelFlow :steps="template.steps" compact />
            </template>
            <p v-else class="muted">Created from “{{ funnel.templateId }}”, which is no longer in the catalog.</p>
            <dl class="details">
              <dt>Product</dt>
              <dd>
                <NuxtLink :to="`/products/${funnel.product.id}`">{{ funnel.product.name }}</NuxtLink>
              </dd>
              <dt>Created</dt><dd>{{ new Date(funnel.createdAt).toLocaleDateString() }}</dd>
              <dt>Updated</dt><dd>{{ new Date(funnel.updatedAt).toLocaleDateString() }}</dd>
            </dl>
          </section>
        </div>
      </div>
    </template>

    <AdsDrawer v-model:open="drawerOpen" :title="editing?.name ?? 'Step'">
      <template v-if="editing">
        <p class="pill neutral" style="align-self: flex-start">{{ FUNNEL_STEP_TYPE_META[editing.type].label }}</p>
        <p class="muted">{{ FUNNEL_STEP_TYPE_META[editing.type].description }}</p>
        <AdsField label="Step name" description="Only shown here in the admin."><AdsInput v-model="stepForm.name" /></AdsField>
        <AdsField v-if="editing.type !== 'Landing'" label="Headline" help="Optional line shown at the top of this step once the storefront renders funnels.">
          <AdsInput v-model="stepForm.headline" placeholder="e.g. Add the matching case for less" />
        </AdsField>
        <p v-else class="notice">
          <AdsIcon name="i-lucide-image" />
          <span>Template, headline, colours and sections are set in the <button type="button" class="link-cell" style="border: 0; background: none; padding: 0; cursor: pointer" @click="drawerOpen = false; tab = 'landing'">Landing page tab</button>.</span>
        </p>
        <template v-if="isOffer(editing.type)">
          <AdsField label="Offer product" required>
            <AdsSelect v-model="stepForm.offerProductId" :items="[{ label: 'Choose a product…', value: '' }, ...productOptions.filter((p) => p.value !== funnel?.product.id)]" />
          </AdsField>
          <AdsField label="Special price (DZD)" :help="offerProduct ? `Leave blank to use the normal price (${fmtDzd(offerProduct.priceCents)}).` : 'Leave blank to use the normal price.'">
            <AdsNumberInput v-model="stepForm.priceDzd" :min="0" :disabled="!stepForm.offerProductId" />
          </AdsField>
          <div v-if="offerProduct?.imageUrl" class="prod">
            <img :src="resolveImageUrl(offerProduct.imageUrl)" class="thumb" style="object-fit: cover" alt="">
            <span class="strong">{{ offerProduct.name }}</span>
          </div>
        </template>
      </template>
      <template #footer>
        <button class="btn" type="button" @click="drawerOpen = false">Cancel</button>
        <AdsButton :loading="savingStep" :disabled="!stepForm.name.trim()" icon="i-lucide-check" @click="saveStep">Save step</AdsButton>
      </template>
    </AdsDrawer>
  </AdsPage>
</template>

<style scoped>
.step-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.step-row { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--row-line); }
.step-row:first-child { padding-top: 0; }
.step-row.off .info, .step-row.off .ico, .step-row.off .idx { opacity: .5; }
.idx { width: 24px; height: 24px; border-radius: var(--r-sm); background: var(--ivory); color: var(--text-2); font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ico { width: 36px; height: 36px; border-radius: var(--r); background: var(--mist); color: var(--teal); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ico svg { width: 18px; height: 18px; }
.info { display: flex; flex-direction: column; min-width: 0; font-size: 13px; }
.name { border: 0; background: none; padding: 0; font: inherit; font-size: 14px; font-weight: 600; color: var(--pine); text-align: start; cursor: pointer; }
.name:hover { text-decoration: underline; }
.add-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding-top: 4px; }
</style>
