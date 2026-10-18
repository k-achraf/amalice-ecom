<script setup lang="ts">
import {
  FUNNEL_TEMPLATES,
  getFunnelTemplate,
  type FunnelDetail,
  type FunnelListItem,
  type FunnelStatus,
  type FunnelTemplateId,
  type GeneratedFunnelResult,
  type ProductListResponse
} from '@amalice/shared'

definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })
const { resolveImageUrl } = useResolveImageUrl()
useHead({ title: 'Funnels' })

const api = useAdminApi()
const router = useRouter()
const { run } = useApiAction()

const { data: funnels, pending, refresh: refreshFunnels } = await useAdminFetch<FunnelListItem[]>('/admin/funnels', { key: 'admin-funnels' })
// Product picker source. The list endpoint pages, so this covers the first 100 products.
const { data: products } = await useAdminFetch<ProductListResponse>('/admin/products', { key: 'admin-funnels-products', query: { page: '1', pageSize: '100' } })

const all = computed(() => funnels.value ?? [])
const statusFilter = ref<'all' | FunnelStatus>('all')
const search = ref('')

const tabs = computed(() => [
  { label: 'All', value: 'all', count: all.value.length },
  ...(['Live', 'Draft', 'Paused'] as FunnelStatus[]).map((s) => ({ label: s, value: s, count: all.value.filter((f) => f.status === s).length }))
])
const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  return all.value.filter(
    (f) => (statusFilter.value === 'all' || f.status === statusFilter.value) && (!q || f.name.toLowerCase().includes(q) || f.product.name.toLowerCase().includes(q))
  )
})

const STATUS_PILL: Record<FunnelStatus, string> = { Live: 'active', Draft: 'draft', Paused: 'neutral' }
const templateName = (id: string) => getFunnelTemplate(id)?.name ?? id
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString()

// ---- create ----
const showCreate = ref(false)
const templateId = ref<FunnelTemplateId>(FUNNEL_TEMPLATES[0]!.id)
const name = ref('')
const productId = ref<string>('')
const creating = ref(false)
const chosen = computed(() => getFunnelTemplate(templateId.value)!)
const productOptions = computed(() => (products.value?.items ?? []).map((p) => ({ label: p.name, value: p.id })))
const canCreate = computed(() => !!name.value.trim() && !!productId.value)

function openCreate() {
  templateId.value = FUNNEL_TEMPLATES[0]!.id
  name.value = ''
  productId.value = ''
  showCreate.value = true
}

// Suggest a name from the product until the admin types their own.
const nameTouched = ref(false)
watch(productId, (id) => {
  if (nameTouched.value) return
  const p = products.value?.items.find((x) => x.id === id)
  name.value = p ? `${p.name} funnel` : ''
})
watch(showCreate, (open) => {
  if (open) nameTouched.value = false
})

async function create() {
  if (!canCreate.value) return
  creating.value = true
  const created = await run(
    () => api<FunnelDetail>('/admin/funnels', { method: 'POST', body: { name: name.value.trim(), productId: productId.value, templateId: templateId.value } }),
    { success: 'Funnel created', errorFallback: 'Could not create the funnel' }
  )
  creating.value = false
  if (created) {
    showCreate.value = false
    await router.push(`/funnels/${created.id}`)
  }
}

// ---- AI generate: product in, complete Draft funnel out ----
const showAi = ref(false)
const aiProductId = ref('')
const aiLanguage = ref<'ar' | 'fr'>('ar')
const aiInstructions = ref('')
const aiBusy = ref(false)
const aiResult = ref<GeneratedFunnelResult | null>(null)
const aiLanguages = [{ label: 'العربية (Arabic)', value: 'ar' }, { label: 'Français (French)', value: 'fr' }]

function openAi() {
  aiProductId.value = ''
  aiInstructions.value = ''
  aiResult.value = null
  showAi.value = true
}

async function generateAi() {
  if (!aiProductId.value) return
  aiBusy.value = true
  const result = await run(
    () => api<GeneratedFunnelResult>('/admin/funnels/ai-generate', {
      method: 'POST',
      body: { productId: aiProductId.value, language: aiLanguage.value, instructions: aiInstructions.value.trim() || undefined }
    }),
    { success: 'Funnel generated as a draft', errorFallback: 'Could not generate the funnel' }
  )
  aiBusy.value = false
  if (result) {
    aiResult.value = result
    await refreshFunnels()
  }
}

// ---- Bulk select + permanent delete (SuperAdmin only) ----
const { isSuperAdmin } = useDangerDelete()
const { selected: selIds, allChecked: selAll, indeterminate: selSome, toggleAll: selToggleAll, toggle: selToggle, clear: selClear, count: selCount } = useBulkSelect(visible)
const { bulkDelete, busy: bulkBusy } = useBulkDelete()
const bulkApi = useAdminApi()

async function deleteSelected() {
  const deleted = await bulkDelete([...selIds.value], { noun: 'funnel', remove: (id) => bulkApi(`/admin/funnels/__ID__`.replace('__ID__', id), { method: 'DELETE' }) })
  if (deleted.length) {
    selClear()
    await refreshFunnels()
  }
}
</script>

<template>
  <AdsPage title="Funnels" description="Guided paths from first click to confirmed order">
    <template #actions>
      <button class="btn" type="button" @click="openAi"><AdsIcon name="i-lucide-sparkles" />Generate with AI</button>
      <button class="btn btn-primary" type="button" @click="openCreate"><AdsIcon name="i-lucide-plus" />New funnel</button>
    </template>

    <section class="kpis" aria-label="Funnel summary">
      <AdsKpiCard label="Funnels" :value="all.length" meta="Across all products" />
      <AdsKpiCard label="Live" :value="all.filter((f) => f.status === 'Live').length" color="dark" meta="Marked as live" />
      <AdsKpiCard label="Draft" :value="all.filter((f) => f.status === 'Draft').length" color="warning" meta="Still being built" />
      <AdsKpiCard label="Paused" :value="all.filter((f) => f.status === 'Paused').length" meta="Switched off" />
    </section>

    <section class="card" aria-label="Funnels">
      <div class="card-head">
        <AdsTabs v-model="statusFilter" :items="tabs" />
        <AdsSearch v-model="search" soft placeholder="Funnel or product" label="Search funnels" />
      </div>
      <BulkBar v-if="isSuperAdmin" :count="selCount" :busy="bulkBusy" can-delete @delete="deleteSelected" @clear="selClear" />
      <div class="table-wrap">
        <table style="min-width: 820px">
          <thead><tr><th v-if="isSuperAdmin" style="width: 28px"><input type="checkbox" aria-label="Select all" :checked="selAll" :indeterminate="selSome" @change="selToggleAll(($event.target as HTMLInputElement).checked)"></th><th>Funnel</th><th>Product</th><th>Template</th><th>Steps</th><th>Status</th><th>Updated</th><th><span class="sr">Open</span></th></tr></thead>
          <tbody>
            <tr v-if="pending"><td :colspan="7 + (isSuperAdmin ? 1 : 0)" class="empty">Loading…</td></tr>
            <tr v-else-if="!visible.length">
              <td :colspan="7 + (isSuperAdmin ? 1 : 0)" class="empty">
                {{ all.length ? 'No funnels match this filter.' : 'No funnels yet. Create one from a template to get started.' }}
              </td>
            </tr>
            <tr v-for="f in visible" v-else :key="f.id" class="clickable" @click="router.push(`/funnels/${f.id}`)"><td v-if="isSuperAdmin" @click.stop><input type="checkbox" :aria-label="`Select ${f.name}`" :checked="selIds.has(f.id)" @change="selToggle(f.id, ($event.target as HTMLInputElement).checked)"></td>
              <td>
                <NuxtLink :to="`/funnels/${f.id}`" class="link-cell" @click.stop>{{ f.name }}</NuxtLink>
                <span class="sub mono">/{{ f.slug }}</span>
              </td>
              <td>
                <div class="prod">
                  <img v-if="f.product.imageUrl" :src="resolveImageUrl(f.product.imageUrl)" class="thumb" style="object-fit: cover; width: 32px; height: 32px" alt="">
                  <span v-else class="thumb" style="width: 32px; height: 32px"><AdsIcon name="i-lucide-package" /></span>
                  <span class="strong">{{ f.product.name }}</span>
                </div>
              </td>
              <td>{{ templateName(f.templateId) }}</td>
              <td>{{ f.stepCount }}</td>
              <td><span class="pill" :class="STATUS_PILL[f.status]">{{ f.status }}</span></td>
              <td class="muted">{{ fmtDate(f.updatedAt) }}</td>
              <td class="num"><NuxtLink class="row-btn" :to="`/funnels/${f.id}`" :aria-label="`Open ${f.name}`" @click.stop><AdsIcon name="i-lucide-chevron-right" /></NuxtLink></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <AdsDialog v-model:open="showCreate" title="New funnel" description="Pick a template to start from. You can reorder, add and remove steps afterwards." width="lg">
      <div class="template-grid" role="radiogroup" aria-label="Funnel template">
        <button
          v-for="t in FUNNEL_TEMPLATES"
          :key="t.id"
          type="button"
          role="radio"
          class="template"
          :aria-checked="templateId === t.id"
          @click="templateId = t.id"
        >
          <span class="template-head"><b>{{ t.name }}</b><span class="muted">{{ t.steps.length }} steps</span></span>
          <span class="muted">{{ t.description }}</span>
          <FunnelFlow :steps="t.steps" compact />
          <span class="best"><AdsIcon name="i-lucide-check" />{{ t.bestFor }}</span>
        </button>
      </div>

      <div class="grid-2">
        <AdsField label="Product" required help="The product this funnel sells.">
          <AdsSelect v-model="productId" :items="productOptions" placeholder="Choose a product…" />
        </AdsField>
        <AdsField label="Funnel name" required>
          <AdsInput v-model="name" :placeholder="`${chosen.name} funnel`" @update:model-value="nameTouched = true" />
        </AdsField>
      </div>

      <template #footer>
        <button class="btn" type="button" @click="showCreate = false">Cancel</button>
        <AdsButton :loading="creating" :disabled="!canCreate" icon="i-lucide-check" @click="create">Create funnel</AdsButton>
      </template>
    </AdsDialog>

    <AdsDialog v-model:open="showAi" title="Generate a funnel with AI" description="Pick a product. The AI chooses the workflow, landing layout, settings, copy and which products to offer, and saves it as a draft you can still edit." width="md">
      <template v-if="!aiResult">
        <AdsField label="Product" required><AdsSelect v-model="aiProductId" :items="productOptions" placeholder="Choose a product…" /></AdsField>
        <AdsField label="Copy language" help="Applies to the AI-written texts. Fixed form and button labels of funnel pages stay in Arabic."><AdsSelect v-model="aiLanguage" :items="aiLanguages" /></AdsField>
        <AdsField label="Instructions (optional)" help="e.g. target women 25–40, premium tone, push the bundle."><AdsTextarea v-model="aiInstructions" :rows="3" /></AdsField>
        <p v-if="aiBusy" class="muted">Planning the funnel… this takes up to a minute.</p>
      </template>
      <template v-else>
        <p><b>{{ aiResult.funnel.name }}</b> <span class="pill draft">Draft</span></p>
        <p class="muted"><b>Workflow ({{ templateName(aiResult.funnel.templateId) }}):</b> {{ aiResult.plan.workflowReason }}</p>
        <p v-if="aiResult.plan.templateReason" class="muted"><b>Landing layout:</b> {{ aiResult.plan.templateReason }}</p>
        <ul v-if="aiResult.plan.offers.length" style="padding-inline-start: 18px">
          <li v-for="o in aiResult.plan.offers" :key="o.stepType + o.productName"><b>{{ o.stepType }}:</b> {{ o.productName }}<template v-if="o.discountPercent"> — {{ o.discountPercent }}% off</template></li>
        </ul>
        <p v-for="n in aiResult.plan.notes" :key="n" class="muted">• {{ n }}</p>
        <p class="muted">Review the copy before going live — the AI works only from the product's own information.</p>
      </template>
      <template #footer>
        <template v-if="!aiResult">
          <button class="btn" type="button" @click="showAi = false">Cancel</button>
          <AdsButton :loading="aiBusy" :disabled="!aiProductId" icon="i-lucide-sparkles" @click="generateAi">Generate</AdsButton>
        </template>
        <template v-else>
          <button class="btn" type="button" @click="showAi = false">Close</button>
          <AdsButton icon="i-lucide-arrow-right" @click="router.push(`/funnels/${aiResult!.funnel.id}`)">Open funnel</AdsButton>
        </template>
      </template>
    </AdsDialog>
  </AdsPage>
</template>

<style scoped>
.template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.template { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; text-align: start; padding: 14px; border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--white); color: var(--pine); font: inherit; font-size: 13px; cursor: pointer; }
.template:hover { border-color: var(--teal); }
.template[aria-checked='true'] { border-color: var(--teal); box-shadow: inset 0 0 0 1px var(--teal); background: var(--hover); }
.template-head { display: flex; width: 100%; align-items: baseline; justify-content: space-between; gap: 8px; }
.template-head b { font-size: 15px; font-weight: 600; }
.best { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--teal); }
.best svg { width: 14px; height: 14px; }
</style>
