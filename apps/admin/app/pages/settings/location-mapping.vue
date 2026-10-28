<script setup lang="ts">
import { toast } from 'vue-sonner'
import type {
  LocationMapCommuneRow,
  LocationMapCopySuggestion,
  LocationMapStatus,
  LocationMapSummary,
  LocationMapWilayaDetail,
  LocationMapWilayaSummary,
  ShippingCompanyView
} from '@amalice/shared'

// Per-courier location mapping: our 69 wilayas / communes vs the courier's own list.
// EVERYTHING here is manual: suggestions are only proposals, nothing is saved without a click.
definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })
useHead({ title: 'Location mapping' })

const mapApi = useLocationMapApi()
const { run } = useApiAction()

const { data: companies, pending } = await useAdminFetch<ShippingCompanyView[]>('/admin/shipping-companies', {
  key: 'admin-shipping-companies-locmap'
})

const readyCompanies = computed(() => (companies.value ?? []).filter((c) => c.id && c.isLinked && c.locationsSyncedAt))
const companyId = ref<string>('')
const companyOptions = computed(() => readyCompanies.value.map((c) => ({ label: c.name, value: c.provider })))
watch(readyCompanies, (list) => {
  if (!companyId.value && list.length) companyId.value = list[0]!.provider
}, { immediate: true })

// ---- summary + wilaya list ----
const summary = ref<LocationMapSummary | null>(null)
const loadingSummary = ref(false)
const search = ref('')
const attentionOnly = ref(false)
const selectedWilayaId = ref<string | null>(null)

async function loadSummary() {
  if (!companyId.value) return
  loadingSummary.value = true
  const res = await run(() => mapApi.summary(companyId.value), { errorFallback: 'Could not load the location map' })
  loadingSummary.value = false
  if (res) summary.value = res
}

// ---- wilaya detail ----
const detail = ref<LocationMapWilayaDetail | null>(null)
const loadingDetail = ref(false)
const drafts = reactive<Record<string, string>>({})
const busy = reactive<Record<string, boolean>>({})
const wilayaDraft = ref('')

// ---- suggestions from another company (proposals only) ----
const copyFromId = ref('')
const copySuggestions = ref<LocationMapCopySuggestion[] | null>(null)
const loadingCopy = ref(false)
const acceptingAll = ref(false)

watch(companyId, () => {
  summary.value = null
  detail.value = null
  selectedWilayaId.value = null
  copySuggestions.value = null
  copyFromId.value = ''
  loadSummary()
}, { immediate: true })

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const isNewWilaya = (id: string) => Number(id) >= 59

const visibleWilayas = computed(() => {
  const q = norm(search.value.trim())
  return (summary.value?.wilayas ?? []).filter((w: LocationMapWilayaSummary) => {
    if (attentionOnly.value && w.review + w.unmapped === 0) return false
    if (!q) return true
    return norm(w.wilayaName).includes(q) || w.wilayaId === q
  })
})

const totals = computed(() => {
  const t = { matched: 0, review: 0, unmapped: 0, mapped: 0 }
  for (const w of summary.value?.wilayas ?? []) {
    t.matched += w.matched; t.review += w.review; t.unmapped += w.unmapped; t.mapped += w.mapped
  }
  return t
})

async function selectWilaya(id: string) {
  selectedWilayaId.value = id
  copySuggestions.value = null
  copyFromId.value = ''
  await loadDetail()
}

async function loadDetail() {
  if (!companyId.value || !selectedWilayaId.value) return
  const wid = selectedWilayaId.value
  loadingDetail.value = true
  const res = await run(() => mapApi.wilaya(companyId.value, wid), { errorFallback: 'Could not load the wilaya' })
  loadingDetail.value = false
  if (res && selectedWilayaId.value === wid) {
    detail.value = res
    wilayaDraft.value = res.courierWilayaId
    for (const k of Object.keys(drafts)) delete drafts[k]
  }
}

const communeOptions = computed(() =>
  (detail.value?.courierCommunes ?? []).map((c) => ({ label: c.name + (c.postalCode ? ` (${c.postalCode})` : ''), value: c.name }))
)
const courierWilayaOptions = computed(() => (summary.value?.courierWilayaIds ?? []).map((id) => ({ label: `Courier wilaya ${id}`, value: id })))

// Recompute the per-wilaya counters locally after a row changes (optimistic).
function recount() {
  if (!detail.value || !summary.value) return
  const w = summary.value.wilayas.find((x) => x.wilayaId === detail.value!.wilayaId)
  if (!w) return
  w.matched = 0; w.review = 0; w.unmapped = 0; w.mapped = 0
  for (const r of detail.value.communes) w[r.status]++
}

async function saveRow(row: LocationMapCommuneRow, courierCommune: string) {
  if (!detail.value || !courierCommune) return
  const d = detail.value
  const key = row.commune
  busy[key] = true
  const opt = d.courierCommunes.find((c) => c.name === courierCommune)
  const prev = { status: row.status, mapped: row.mapped }
  row.status = 'mapped'
  row.mapped = { courierWilayaId: d.courierWilayaId, courierCommune, courierPostalCode: opt?.postalCode ?? null }
  recount()
  const res = await run(() => mapApi.save(companyId.value, {
    ourWilayaId: d.wilayaId,
    ourCommune: row.commune,
    courierWilayaId: d.courierWilayaId,
    courierCommune,
    courierPostalCode: opt?.postalCode ?? null
  }), { success: `${row.commune} mapped to ${courierCommune}`, errorFallback: 'Could not save the mapping' })
  busy[key] = false
  if (res === undefined) {
    row.status = prev.status
    row.mapped = prev.mapped
    recount()
  } else {
    delete drafts[key]
  }
}

async function removeRow(row: LocationMapCommuneRow) {
  if (!detail.value) return
  const wid = detail.value.wilayaId
  busy[row.commune] = true
  const res = await run(() => mapApi.remove(companyId.value, wid, row.commune), {
    success: `Mapping for ${row.commune} removed`, errorFallback: 'Could not remove the mapping'
  })
  busy[row.commune] = false
  // The automatic status (matched/review/unmapped) comes back from the server.
  if (res !== undefined) await Promise.all([loadDetail(), loadSummary()])
}

const savingWilaya = ref(false)
async function saveWilayaMapping() {
  if (!detail.value || !wilayaDraft.value) return
  const wid = detail.value.wilayaId
  savingWilaya.value = true
  const res = await run(() => mapApi.save(companyId.value, {
    ourWilayaId: wid,
    ourCommune: '',
    courierWilayaId: wilayaDraft.value
  }), { success: 'Wilaya mapping saved', errorFallback: 'Could not save the wilaya mapping' })
  savingWilaya.value = false
  if (res !== undefined) await Promise.all([loadDetail(), loadSummary()])
}

const otherOptions = computed(() => readyCompanies.value.filter((c) => c.provider !== companyId.value).map((c) => ({ label: c.name, value: c.provider })))

async function loadCopy() {
  if (!copyFromId.value || !selectedWilayaId.value) return
  loadingCopy.value = true
  const res = await run(() => mapApi.copyFrom(companyId.value, copyFromId.value, selectedWilayaId.value!), { errorFallback: 'Could not load suggestions' })
  loadingCopy.value = false
  if (res) copySuggestions.value = res
}
watch(copyFromId, loadCopy)

const usableCopy = computed(() => (copySuggestions.value ?? []).filter((s) => s.existsAtThisCompany && s.courierCommune && s.ourCommune))

function dropCopy(s: LocationMapCopySuggestion) {
  if (copySuggestions.value) copySuggestions.value = copySuggestions.value.filter((x) => x !== s)
}

async function acceptCopy(s: LocationMapCopySuggestion, silent = false) {
  if (!s.courierCommune) return false
  const key = `copy:${s.ourCommune}`
  busy[key] = true
  const res = await run(() => mapApi.save(companyId.value, {
    ourWilayaId: s.ourWilayaId,
    ourCommune: s.ourCommune,
    courierWilayaId: s.courierWilayaId,
    courierCommune: s.courierCommune,
    courierPostalCode: s.courierPostalCode
  }), { success: silent ? undefined : `${s.ourCommune} mapped`, errorFallback: 'Could not save the mapping' })
  busy[key] = false
  if (res === undefined) return false
  dropCopy(s)
  if (!silent) await Promise.all([loadDetail(), loadSummary()])
  return true
}

async function acceptAllCopy() {
  acceptingAll.value = true
  let ok = 0
  for (const s of [...usableCopy.value]) {
    if (await acceptCopy(s, true)) ok++
  }
  acceptingAll.value = false
  if (ok) {
    toast.success(`${ok} mappings accepted`)
    await Promise.all([loadDetail(), loadSummary()])
  }
}

// ---- display helpers ----
const STATUS_LABEL: Record<LocationMapStatus, string> = { matched: 'Matched', review: 'Review', unmapped: 'Unmapped', mapped: 'Mapped' }
const STATUS_TONE: Record<LocationMapStatus, string> = { matched: 'confirmed', review: 'new', unmapped: 'returned', mapped: 'delivered' }
</script>

<template>
  <AdsPage title="Location mapping" description="Match our wilayas and communes with each courier's own list. Nothing is saved until you click.">
    <template #actions>
      <NuxtLink to="/settings/shipping-companies" class="btn hide-sm"><AdsDesignIcon name="delivery" />Shipping companies</NuxtLink>
    </template>

    <div v-if="pending" class="empty">Loading…</div>

    <AdsBanner v-else-if="!readyCompanies.length" tone="warning">
      No courier is ready yet. Link a company and sync its communes first in
      <NuxtLink to="/settings/shipping-companies" class="link-cell">Shipping companies</NuxtLink>
      (Settings, then Sync communes).
    </AdsBanner>

    <template v-else>
      <div class="card" style="padding: 14px 16px; display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end">
        <AdsField label="Shipping company" style="flex: 1 1 220px; max-width: 320px">
          <AdsSelect v-model="companyId" :options="companyOptions" />
        </AdsField>
        <div v-if="summary" style="display: flex; flex-wrap: wrap; gap: 6px; padding-bottom: 6px">
          <span class="pill confirmed">{{ totals.matched }} matched</span>
          <span class="pill new">{{ totals.review }} to review</span>
          <span class="pill returned">{{ totals.unmapped }} unmapped</span>
          <span class="pill delivered">{{ totals.mapped }} mapped</span>
        </div>
      </div>

      <div v-if="loadingSummary && !summary" class="empty">Loading the location map…</div>

      <div v-else-if="summary" class="lm-grid">
        <!-- Wilaya list -->
        <section class="card lm-list" aria-label="Wilayas">
          <div class="stack" style="padding: 12px; gap: 10px">
            <AdsSearch v-model="search" soft placeholder="Search wilayas…" label="Search wilayas" />
            <label class="check"><input v-model="attentionOnly" type="checkbox">Needs attention only</label>
          </div>
          <ul class="lm-wilayas">
            <li v-for="w in visibleWilayas" :key="w.wilayaId">
              <button type="button" class="lm-wilaya" :class="{ on: w.wilayaId === selectedWilayaId }" @click="selectWilaya(w.wilayaId)">
                <span class="lm-wname">
                  <span class="muted mono">{{ w.wilayaId }}</span> {{ w.wilayaName }}
                  <span v-if="isNewWilaya(w.wilayaId)" class="pill vip" style="margin-inline-start: 4px">new wilaya</span>
                </span>
                <span class="lm-chips">
                  <span v-if="w.review" class="pill new" title="To review">{{ w.review }}</span>
                  <span v-if="w.unmapped" class="pill returned" title="Unmapped">{{ w.unmapped }}</span>
                  <span v-if="w.mapped" class="pill delivered" title="Mapped">{{ w.mapped }}</span>
                  <span v-if="w.matched" class="pill confirmed" title="Matched">{{ w.matched }}</span>
                </span>
              </button>
            </li>
            <li v-if="!visibleWilayas.length" class="muted" style="padding: 14px">No wilaya matches.</li>
          </ul>
        </section>

        <!-- Detail -->
        <section class="stack" style="min-width: 0">
          <AdsEmptyState v-if="!selectedWilayaId" icon="i-lucide-truck" title="Pick a wilaya" description="Choose a wilaya in the list to review its communes." />
          <div v-else-if="loadingDetail && !detail" class="empty">Loading…</div>
          <template v-else-if="detail">
            <div class="card" style="padding: 14px 16px">
              <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
                <h2 style="font-size: 16px">{{ detail.wilayaId }} · {{ detail.wilayaName }}</h2>
                <span v-if="isNewWilaya(detail.wilayaId)" class="pill vip">new wilaya</span>
                <span class="pill" :class="detail.courierWilayaSource === 'mapped' ? 'delivered' : 'neutral'">
                  Courier wilaya {{ detail.courierWilayaId }} ({{ detail.courierWilayaSource }})
                </span>
              </div>
              <div v-if="isNewWilaya(detail.wilayaId)" style="display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; margin-top: 12px">
                <AdsField label="Courier wilaya for this wilaya" style="flex: 1 1 220px; max-width: 320px">
                  <AdsSelect v-model="wilayaDraft" :options="courierWilayaOptions" />
                </AdsField>
                <AdsButton :loading="savingWilaya" :disabled="!wilayaDraft || wilayaDraft === detail.courierWilayaId" @click="saveWilayaMapping">Save</AdsButton>
              </div>
            </div>

            <div class="card" style="padding: 14px 16px">
              <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end">
                <AdsField label="Suggest from another company" style="flex: 1 1 220px; max-width: 320px">
                  <AdsSelect v-model="copyFromId" :options="otherOptions" placeholder="Choose a company…" :disabled="!otherOptions.length" />
                </AdsField>
                <AdsButton v-if="usableCopy.length" :loading="acceptingAll" appearance="default" @click="acceptAllCopy">Accept all usable ({{ usableCopy.length }})</AdsButton>
              </div>
              <p v-if="!otherOptions.length" class="muted" style="margin-top: 8px">No other company with synced communes.</p>
              <p v-if="loadingCopy" class="muted" style="margin-top: 8px">Loading suggestions…</p>
              <template v-else-if="copySuggestions">
                <p v-if="!copySuggestions.length" class="muted" style="margin-top: 8px">That company has nothing mapped in this wilaya.</p>
                <div v-else class="table-wrap" style="margin-top: 10px">
                  <table style="min-width: 480px">
                    <thead><tr><th>Our commune</th><th>Proposed courier commune</th><th><span class="sr">Action</span></th></tr></thead>
                    <tbody>
                      <tr v-for="s in copySuggestions" :key="s.ourCommune">
                        <td class="strong">{{ s.ourCommune }}</td>
                        <td>
                          {{ s.courierCommune ?? '—' }}
                          <span v-if="!s.existsAtThisCompany" class="pill returned" style="margin-inline-start: 6px">not in this courier's list</span>
                        </td>
                        <td class="num" style="white-space: nowrap">
                          <AdsButton size="sm" :loading="busy[`copy:${s.ourCommune}`]" :disabled="!s.existsAtThisCompany || !s.courierCommune" @click="acceptCopy(s)">Accept</AdsButton>
                          <AdsButton size="sm" appearance="subtle" @click="dropCopy(s)">Ignore</AdsButton>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
            </div>

            <div class="card">
              <div class="table-wrap">
                <table style="min-width: 640px">
                  <thead><tr><th>Our commune</th><th>Status</th><th>Courier commune</th></tr></thead>
                  <tbody>
                    <tr v-for="row in detail.communes" :key="row.commune">
                      <td class="strong">{{ row.commune }}</td>
                      <td><span class="pill" :class="STATUS_TONE[row.status]">{{ STATUS_LABEL[row.status] }}</span></td>
                      <td style="white-space: normal">
                        <div v-if="row.status === 'matched'" class="muted" style="margin-bottom: 6px">{{ row.matchedCommune?.name ?? 'Same name' }}</div>
                        <div v-else-if="row.status === 'mapped'" style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
                          <span>{{ row.mapped?.courierCommune ?? '—' }}<span v-if="row.mapped?.courierPostalCode" class="muted"> ({{ row.mapped.courierPostalCode }})</span></span>
                          <AdsButton size="sm" appearance="subtle" :loading="busy[row.commune]" @click="removeRow(row)">Remove</AdsButton>
                        </div>
                        <div v-if="row.status === 'review' && row.suggestions.length" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px">
                          <AdsButton v-for="s in row.suggestions.slice(0, 3)" :key="s.name" size="sm" appearance="default" :disabled="busy[row.commune]" @click="saveRow(row, s.name)">Use {{ s.name }}</AdsButton>
                        </div>
                        <div v-if="row.status !== 'mapped'" style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center">
                          <div style="flex: 1 1 200px; min-width: 160px">
                            <AdsSearchSelect v-model="drafts[row.commune]" :options="communeOptions" placeholder="Choose courier commune…" />
                          </div>
                          <AdsButton size="sm" :loading="busy[row.commune]" :disabled="!drafts[row.commune]" @click="saveRow(row, drafts[row.commune]!)">Save</AdsButton>
                        </div>
                        <details v-else style="margin-top: 4px">
                          <summary class="muted" style="cursor: pointer; font-size: 12px">Change</summary>
                          <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 6px">
                            <div style="flex: 1 1 200px; min-width: 160px">
                              <AdsSearchSelect v-model="drafts[row.commune]" :options="communeOptions" placeholder="Choose courier commune…" />
                            </div>
                            <AdsButton size="sm" :loading="busy[row.commune]" :disabled="!drafts[row.commune]" @click="saveRow(row, drafts[row.commune]!)">Save</AdsButton>
                          </div>
                        </details>
                      </td>
                    </tr>
                    <tr v-if="!detail.communes.length"><td colspan="3" class="muted">No communes for this wilaya.</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </section>
      </div>
    </template>
  </AdsPage>
</template>

<style scoped>
.lm-grid { display: grid; grid-template-columns: minmax(260px, 340px) minmax(0, 1fr); gap: 16px; align-items: start; }
.lm-list { overflow: hidden; }
.lm-wilayas { list-style: none; margin: 0; padding: 0; max-height: 70vh; overflow-y: auto; border-top: 1px solid var(--line-soft); }
.lm-wilaya { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 12px; text-align: start; background: none; border: 0; border-bottom: 1px solid var(--line-soft); cursor: pointer; font: inherit; }
.lm-wilaya:hover { background: var(--hover); }
.lm-wilaya.on { background: var(--hover); box-shadow: inset 3px 0 0 var(--teal); }
.lm-wname { font-size: 14px; }
.lm-chips { display: flex; gap: 4px; flex-shrink: 0; }
@media (max-width: 860px) {
  .lm-grid { grid-template-columns: minmax(0, 1fr); }
  .lm-wilayas { max-height: 280px; }
}
</style>
