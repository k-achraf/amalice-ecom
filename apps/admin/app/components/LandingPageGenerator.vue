<script setup lang="ts">
import {
  LANDING_STYLES,
  type AdminProductDetail,
  type LandingLanguage,
  type LandingPageImageProvider,
  type LandingStyle,
  type ProductLandingPage
} from '@amalice/shared'
import { toast } from 'vue-sonner'

// AI landing pages for a product — used on the product's Landing Page tab and
// inside a funnel's Landing step. A page is composed, not painted: the AI writes
// validated copy and paints a text-free background; the copy is drawn by code on
// top of the product's REAL photos (apps/api landing-pages). So the text is always
// spelled right, the product is never distorted, and every line can be fixed by
// hand and re-drawn instantly without another AI call.
const props = withDefaults(defineProps<{
  product: AdminProductDetail
  // 'funnel' adds "use this page" and hides the public URL / Live switch.
  mode?: 'product' | 'funnel'
  selectedId?: string | null
}>(), { mode: 'product', selectedId: null })
const emit = defineEmits<{
  change: [pages: ProductLandingPage[]]
  select: [page: ProductLandingPage]
  completed: [page: ProductLandingPage]
}>()

const api = useAdminApi()
const { run } = useApiAction()
const { resolveImageUrl } = useResolveImageUrl()
const runtimeConfig = useRuntimeConfig()
const { isSuperAdmin, confirmDelete } = useDangerDelete()

const pages = ref<ProductLandingPage[]>([])
const loading = ref(true)
const expandedId = ref<string | null>(null)

// ---- list + polling ----
const statusById = new Map<string, string>()
async function fetchPages() {
  const list = await api<ProductLandingPage[]>(`/admin/products/${props.product.id}/landing-pages`).catch(() => [] as ProductLandingPage[])
  for (const p of list) {
    if (statusById.get(p.id) === 'Generating' && p.status === 'Completed') emit('completed', p)
    statusById.set(p.id, p.status)
  }
  pages.value = list
  emit('change', list)
}
let timer: ReturnType<typeof setInterval> | undefined
function stopPolling() {
  if (timer) clearInterval(timer)
  timer = undefined
}
function pollIfNeeded() {
  stopPolling()
  if (!pages.value.some((p) => p.status === 'Generating')) return
  timer = setInterval(async () => {
    await fetchPages()
    if (!pages.value.some((p) => p.status === 'Generating')) stopPolling()
  }, 3000)
}
onMounted(async () => {
  await fetchPages()
  loading.value = false
  expandedId.value = pages.value[0]?.id ?? null
  pollIfNeeded()
})
onBeforeUnmount(stopPolling)

function replace(updated: ProductLandingPage) {
  pages.value = pages.value.map((p) => (p.id === updated.id ? updated : p))
  statusById.set(updated.id, updated.status)
  emit('change', pages.value)
}

// ---- generation form ----
const formOpen = ref(false)
const photos = ref<string[]>([])
const description = ref('')
const instructions = ref('')
const name = ref('')
const sectionCount = ref(5)
const language = ref<LandingLanguage>('ar')
const style = ref<LandingStyle>('vibrant')
const provider = ref<LandingPageImageProvider>('Gemini')
const generating = ref(false)
const improving = ref(false)

const providers: { value: LandingPageImageProvider; label: string; hint: string }[] = [
  { value: 'Gemini', label: 'AI backgrounds', hint: 'Gemini paints a background for each part. Best look; needs a Gemini key.' },
  { value: 'Pollinations', label: 'Free AI backgrounds', hint: 'Free, no key. Simpler backgrounds.' },
  { value: 'Template', label: 'Designed only', hint: 'No AI images: instant, free, can’t fail.' }
]
const styleLabel: Record<LandingStyle, string> = { vibrant: 'Vibrant', dark: 'Dark', light: 'Light' }
const languages: { value: LandingLanguage; label: string }[] = [
  { value: 'ar', label: 'Arabic (formal)' },
  { value: 'fr', label: 'French' },
  { value: 'en', label: 'English' }
]

function htmlToText(html: string): string {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return (div.textContent ?? '').trim()
}
// Its own source text (never written back to the product), composed from
// everything the product already holds.
function compose(p: AdminProductDetail): string {
  const parts: string[] = []
  const d = htmlToText(p.description ?? '')
  if (d) parts.push(d)
  if (p.keyBenefits.length) parts.push(`Key benefits:\n${p.keyBenefits.map((b) => `- ${b}`).join('\n')}`)
  if (p.specifications.length) parts.push(`Specifications:\n${p.specifications.map((s) => `- ${s.label}: ${s.value}`).join('\n')}`)
  if (p.faqs.length) parts.push(`FAQ:\n${p.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n')}`)
  return parts.join('\n\n')
}
watch(() => props.product, (p) => {
  if (p && !description.value) description.value = compose(p)
  if (p && !photos.value.length) photos.value = p.images.slice(0, 6).map((i) => i.url)
}, { immediate: true })
watch(pages, (list) => { if (!list.length && !loading.value) formOpen.value = true })
onMounted(() => { if (!pages.value.length) formOpen.value = true })

function togglePhoto(url: string) {
  photos.value = photos.value.includes(url) ? photos.value.filter((u) => u !== url) : [...photos.value, url]
}

async function improve() {
  if (!description.value.trim()) return
  improving.value = true
  const res = await run(() => api<{ text: string }>('/admin/landing-pages/improve-description', { method: 'POST', body: { text: description.value, productName: props.product.name, instructions: instructions.value.trim() || undefined } }), { success: 'Description improved', errorFallback: 'Could not improve the description' })
  improving.value = false
  if (res) description.value = res.text
}

async function generate() {
  if (!photos.value.length) { toast.warning('Select at least one product photo'); return }
  if (!description.value.trim()) { toast.warning('Add a description to generate from'); return }
  generating.value = true
  const created = await run(() => api<ProductLandingPage>(`/admin/products/${props.product.id}/landing-pages`, {
    method: 'POST',
    body: {
      sourceImageUrls: photos.value.slice(0, 10),
      description: description.value,
      sectionCount: sectionCount.value,
      imageProvider: provider.value,
      language: language.value,
      style: style.value,
      name: name.value.trim() || undefined,
      instructions: instructions.value.trim() || undefined
    }
  }), { errorFallback: 'Could not start the generation' })
  generating.value = false
  if (!created) return
  pages.value = [created, ...pages.value]
  statusById.set(created.id, created.status)
  expandedId.value = created.id
  formOpen.value = false
  name.value = ''
  instructions.value = ''
  emit('change', pages.value)
  pollIfNeeded()
  toast.info('Generating the landing page…', { description: 'Usually 1–2 minutes. You can keep working.' })
}

// ---- editing copy (instant re-render, no AI) ----
const edits = reactive<Record<string, { headline: string; body: string }>>({})
function val(s: { id: string; headline: string; body: string }, field: 'headline' | 'body') {
  return edits[s.id]?.[field] ?? s[field]
}
function setEdit(s: { id: string; headline: string; body: string }, field: 'headline' | 'body', value: string) {
  edits[s.id] = { headline: s.headline, body: s.body, ...edits[s.id], [field]: value }
}
// A section's draft is dropped when the server copy changes underneath it.
watch(pages, (list) => {
  for (const p of list) for (const s of p.sections) {
    const e = edits[s.id]
    if (e && e.headline === s.headline && e.body === s.body) delete edits[s.id]
  }
})
const savingSection = ref<string | null>(null)
async function saveSection(page: ProductLandingPage, sectionId: string) {
  const e = edits[sectionId]
  if (!e) return
  savingSection.value = sectionId
  const updated = await run(() => api<ProductLandingPage>(`/admin/landing-pages/${page.id}/sections/${sectionId}`, { method: 'PUT', body: { headline: e.headline, body: e.body } }), { success: 'Text updated and page re-drawn', errorFallback: 'Could not update the text' })
  savingSection.value = null
  if (updated) { delete edits[sectionId]; replace(updated) }
}
function dirty(sectionId: string, headline: string, body: string) {
  const e = edits[sectionId]
  return !!e && (e.headline !== headline || e.body !== body)
}

// ---- new background for one section ----
const regenFor = ref<string | null>(null)
const regenText = reactive<Record<string, string>>({})
async function regenerate(page: ProductLandingPage, sectionId: string) {
  const updated = await run(() => api<ProductLandingPage>(`/admin/landing-pages/${page.id}/sections/${sectionId}/regenerate`, { method: 'POST', body: { instructions: regenText[sectionId]?.trim() || undefined } }), { errorFallback: 'Could not regenerate' })
  if (!updated) return
  regenFor.value = null
  regenText[sectionId] = ''
  replace(updated)
  pollIfNeeded()
}

// ---- look ----
const restyling = ref<string | null>(null)
async function restyle(page: ProductLandingPage, body: { style?: LandingStyle; accentColor?: string | null }) {
  restyling.value = page.id
  const updated = await run(() => api<ProductLandingPage>(`/admin/landing-pages/${page.id}/design`, { method: 'PUT', body }), { errorFallback: 'Could not change the look' })
  restyling.value = null
  if (updated) replace(updated)
}

// ---- page actions ----
const savingEnabled = ref<string | null>(null)
async function toggleLive(page: ProductLandingPage, enabled: boolean) {
  savingEnabled.value = page.id
  const updated = await run(() => api<ProductLandingPage>(`/admin/landing-pages/${page.id}`, { method: 'PUT', body: { enabled } }), { success: enabled ? 'Now live at its URL' : 'Hidden', errorFallback: 'Could not update' })
  savingEnabled.value = null
  if (updated) replace(updated)
}
async function remove(page: ProductLandingPage) {
  if (!confirmDelete(`Permanently delete the landing page “${page.name}”?`)) return
  const res = await run(() => api(`/admin/landing-pages/${page.id}`, { method: 'DELETE' }), { success: 'Landing page deleted', errorFallback: 'Could not delete' })
  if (res === undefined) return
  pages.value = pages.value.filter((p) => p.id !== page.id)
  emit('change', pages.value)
}
function urlOf(page: ProductLandingPage) {
  return `${runtimeConfig.public.storefrontBase}/lp/${props.product.slug}/${page.number}`
}
async function copyUrl(page: ProductLandingPage) {
  try { await navigator.clipboard.writeText(urlOf(page)); toast.success('URL copied') } catch { toast.error('Could not copy') }
}

const lightbox = ref<string | null>(null)
const statusTone: Record<string, string> = { Completed: 'confirmed', Generating: 'new', Failed: 'returned', Pending: 'neutral' }
function progress(page: ProductLandingPage) {
  const done = page.sections.filter((s) => s.status === 'completed').length
  const copyReady = page.sections.some((s) => s.headline)
  return page.sections.length ? `${copyReady ? 'Text written · ' : 'Writing the text… '}${copyReady ? `${done}/${page.sections.length} sections drawn` : ''}` : 'Starting…'
}
</script>

<template>
  <div class="stack">
    <div v-if="mode === 'funnel'" class="notice">
      <AdsIcon name="i-lucide-sparkles" />
      <span>Generate a long landing page with AI, then press <b>Use this page</b>. It is shown below the order form. The AI writes the copy and paints the background; the text and your real product photos are drawn by code, so nothing is misspelled or distorted — and you can fix any line by hand.</span>
    </div>

    <div v-if="loading" class="empty">Loading…</div>

    <!-- Existing pages -->
    <section v-for="page in pages" :key="page.id" class="card lp" :class="{ chosen: selectedId === page.id }">
      <div class="head">
        <div class="titles">
          <h3>{{ page.name }}</h3>
          <span class="pill" :class="statusTone[page.status]">{{ page.status }}</span>
          <span class="pill outline">{{ page.imageProvider === 'Template' ? 'Designed' : page.imageProvider }}</span>
          <span v-if="page.design" class="pill neutral">{{ page.design.language.toUpperCase() }} · {{ styleLabel[page.design.style] }}</span>
          <span v-if="selectedId === page.id" class="pill confirmed">In use</span>
          <AdsIcon v-if="page.status === 'Generating'" name="i-lucide-refresh-cw" class="spin" />
        </div>
        <div class="actions">
          <button v-if="mode === 'funnel' && page.status === 'Completed'" class="btn btn-sm" :class="{ 'btn-primary': selectedId !== page.id }" type="button" :disabled="selectedId === page.id" @click="emit('select', page)">
            <AdsIcon name="i-lucide-check" />{{ selectedId === page.id ? 'Selected' : 'Use this page' }}
          </button>
          <template v-if="mode === 'product' && page.status === 'Completed'">
            <span class="muted">Live</span>
            <AdsSwitch :model-value="page.enabled" :disabled="savingEnabled === page.id" :aria-label="`Publish ${page.name}`" @update:model-value="(v: boolean) => toggleLive(page, v)" />
          </template>
          <button class="btn btn-sm btn-ghost" type="button" @click="expandedId = expandedId === page.id ? null : page.id"><AdsIcon :name="expandedId === page.id ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" /></button>
          <button v-if="isSuperAdmin" class="btn btn-sm btn-ghost" type="button" aria-label="Delete" @click="remove(page)"><AdsIcon name="i-lucide-trash-2" /></button>
        </div>
      </div>

      <p v-if="mode === 'product' && page.status === 'Completed'" class="muted url">
        <a :href="urlOf(page)" target="_blank" rel="noopener">{{ urlOf(page) }}</a>
        <button class="btn btn-sm btn-ghost" type="button" aria-label="Copy URL" @click="copyUrl(page)"><AdsIcon name="i-lucide-copy" /></button>
      </p>
      <p v-if="page.status === 'Generating'" class="muted">{{ progress(page) }}</p>
      <p v-if="page.errorMessage" class="notice danger"><AdsIcon name="i-lucide-alert-triangle" /><span>{{ page.errorMessage }}</span></p>

      <div v-if="expandedId === page.id && page.sections.length" class="body">
        <!-- Preview -->
        <div v-if="page.finalImageUrl" class="preview">
          <button type="button" class="thumb" :aria-label="`Enlarge ${page.name}`" @click="lightbox = resolveImageUrl(page.finalImageUrl!)">
            <img :src="resolveImageUrl(page.finalImageUrl)" :alt="page.name" loading="lazy">
          </button>
          <div v-if="page.status === 'Completed'" class="look">
            <b>Look</b>
            <div class="seg" role="group" aria-label="Style">
              <button v-for="s in LANDING_STYLES" :key="s" type="button" class="btn btn-sm" :class="{ 'btn-primary': page.design?.style === s }" :disabled="restyling === page.id" @click="restyle(page, { style: s })">{{ styleLabel[s] }}</button>
            </div>
            <label class="colour">
              <input type="color" :value="page.design?.accentColor ?? '#1f5f5b'" :disabled="restyling === page.id" aria-label="Accent colour" @change="restyle(page, { accentColor: ($event.target as HTMLInputElement).value })">
              <span>Accent</span>
            </label>
            <button class="btn btn-sm btn-ghost" type="button" :disabled="restyling === page.id" @click="restyle(page, { accentColor: null })">Auto colour</button>
          </div>
        </div>

        <!-- Section copy -->
        <div class="sections">
          <article v-for="(s, i) in page.sections" :key="s.id" class="sec">
            <div class="sec-head">
              <span class="pill neutral">{{ s.role === 'hero' ? 'Top' : s.role === 'cta' ? 'Order' : `Feature ${page.sections.slice(0, i + 1).filter((x) => x.role === 'feature').length}` }}</span>
              <AdsIcon v-if="s.status === 'generating'" name="i-lucide-refresh-cw" class="spin" />
              <AdsIcon v-else-if="s.status === 'failed'" name="i-lucide-alert-triangle" />
            </div>
            <template v-if="s.headline || s.status === 'completed'">
              <AdsInput :model-value="val(s, 'headline')" dir="auto" maxlength="120" :disabled="page.status === 'Generating'" aria-label="Headline" @update:model-value="(v?: string | null) => setEdit(s, 'headline', v ?? '')" />
              <AdsTextarea :model-value="val(s, 'body')" dir="auto" :rows="2" maxlength="220" :disabled="page.status === 'Generating'" aria-label="Supporting text" @update:model-value="(v?: string | null) => setEdit(s, 'body', v ?? '')" />
              <div class="sec-actions">
                <button v-if="dirty(s.id, s.headline, s.body)" class="btn btn-sm btn-primary" type="button" :disabled="savingSection === s.id" @click="saveSection(page, s.id)"><AdsIcon name="i-lucide-check" />Save text</button>
                <button v-if="page.imageProvider !== 'Template'" class="btn btn-sm" type="button" :disabled="page.status === 'Generating'" @click="regenFor = regenFor === s.id ? null : s.id"><AdsIcon name="i-lucide-refresh-cw" />New background</button>
              </div>
              <div v-if="regenFor === s.id" class="regen">
                <AdsTextarea v-model="regenText[s.id]" :rows="2" placeholder="Optional direction, e.g. warmer light, wooden table…" />
                <button class="btn btn-sm btn-primary" type="button" @click="regenerate(page, s.id)"><AdsIcon name="i-lucide-sparkles" />Generate background</button>
              </div>
            </template>
            <p v-if="s.errorMessage" class="notice danger"><span>{{ s.errorMessage }}</span></p>
            <p v-if="s.warning" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>{{ s.warning }}</span></p>
          </article>
        </div>
      </div>
    </section>

    <!-- Generate form -->
    <section class="card" aria-label="Generate a landing page">
      <div class="head">
        <div class="titles"><h3><AdsIcon name="i-lucide-sparkles" style="color: var(--teal)" /> Generate a new landing page</h3></div>
        <button class="btn btn-sm" type="button" @click="formOpen = !formOpen"><AdsIcon :name="formOpen ? 'i-lucide-chevron-up' : 'i-lucide-plus'" />{{ formOpen ? 'Close' : 'New page' }}</button>
      </div>

      <div v-if="formOpen" class="stack">
        <AdsField label="Name" help="To tell pages apart, e.g. “TikTok angle”."><AdsInput v-model="name" placeholder="Landing Page" /></AdsField>

        <AdsField label="Product photos" help="The page shows these real photos untouched. Pick the best ones (1–10).">
          <div v-if="product.images.length" class="photos">
            <button v-for="img in product.images" :key="img.id" type="button" class="ph" :class="{ on: photos.includes(img.url) }" :aria-pressed="photos.includes(img.url)" @click="togglePhoto(img.url)">
              <img :src="resolveImageUrl(img.url)" :alt="img.altText ?? ''" loading="lazy">
              <span v-if="photos.includes(img.url)" class="tick"><AdsIcon name="i-lucide-check" /></span>
            </button>
          </div>
          <p v-else class="muted">Add product photos in the product’s Images tab first.</p>
        </AdsField>

        <AdsField label="Product information to write from" help="Its own text (never changes the product), prefilled from the description, benefits, specifications and FAQ. The copy only uses facts found here.">
          <AdsTextarea v-model="description" :rows="7" />
          <button class="btn btn-sm" type="button" style="margin-top: 8px; align-self: flex-start" :disabled="improving || !description.trim()" @click="improve"><AdsIcon name="i-lucide-sparkles" />{{ improving ? 'Improving…' : 'Improve with AI' }}</button>
        </AdsField>

        <div class="row3">
          <AdsField label="Language"><AdsSelect v-model="language" :options="languages" /></AdsField>
          <AdsField label="Style"><AdsSelect v-model="style" :options="LANDING_STYLES.map((s) => ({ label: styleLabel[s], value: s }))" /></AdsField>
          <AdsField label="Sections"><AdsSelect v-model="sectionCount" :options="[3, 4, 5, 6, 7]" /></AdsField>
        </div>

        <AdsField label="Backgrounds">
          <div class="providers" role="radiogroup" aria-label="Backgrounds">
            <button v-for="p in providers" :key="p.value" type="button" role="radio" class="prov" :aria-checked="provider === p.value" @click="provider = p.value">
              <b>{{ p.label }}</b><span class="muted">{{ p.hint }}</span>
            </button>
          </div>
        </AdsField>

        <AdsField label="Extra direction (optional)" help="Tone or art direction, e.g. “for a younger audience”, “mention the zip pocket”. It can’t add claims the product doesn’t support.">
          <AdsTextarea v-model="instructions" :rows="2" placeholder="Any specific direction…" />
        </AdsField>

        <button class="btn btn-primary" type="button" style="align-self: flex-start" :disabled="generating" @click="generate"><AdsIcon name="i-lucide-sparkles" />{{ generating ? 'Starting…' : 'Generate landing page' }}</button>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="lightbox" class="lightbox" role="dialog" aria-label="Preview" @click="lightbox = null">
        <img :src="lightbox" alt="Landing page preview">
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.lp.chosen { border-color: var(--teal); box-shadow: inset 0 0 0 1px var(--teal); }
.head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
.titles { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
.titles h3 { font-size: 15px; display: inline-flex; align-items: center; gap: 6px; }
.actions { display: flex; align-items: center; gap: 8px; }
.url { display: flex; align-items: center; gap: 4px; font-size: 12px; word-break: break-all; }
.body { display: grid; grid-template-columns: minmax(0, 240px) minmax(0, 1fr); gap: 18px; align-items: start; }
@media (max-width: 760px) { .body { grid-template-columns: 1fr; } }
.preview { display: flex; flex-direction: column; gap: 10px; }
.thumb { padding: 0; border: 1px solid var(--line); border-radius: var(--r); background: var(--white); overflow: hidden; cursor: zoom-in; max-height: 520px; }
.thumb img { width: 100%; display: block; object-fit: cover; object-position: top; }
.look { display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
.seg { display: flex; gap: 4px; flex-wrap: wrap; }
.colour { display: inline-flex; align-items: center; gap: 8px; }
.colour input { width: 36px; height: 30px; padding: 0; border: 1px solid var(--line); border-radius: 6px; background: none; }
.sections { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.sec { display: flex; flex-direction: column; gap: 6px; padding: 12px; border: 1px solid var(--line); border-radius: var(--r); }
.sec-head { display: flex; align-items: center; gap: 8px; }
.sec-actions, .regen { display: flex; flex-wrap: wrap; gap: 8px; }
.regen { flex-direction: column; align-items: flex-start; }
.photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; }
.ph { position: relative; aspect-ratio: 1; padding: 0; border: 2px solid var(--line); border-radius: var(--r); overflow: hidden; background: var(--white); cursor: pointer; }
.ph.on { border-color: var(--teal); }
.ph img { width: 100%; height: 100%; object-fit: cover; display: block; }
.tick { position: absolute; top: 4px; inset-inline-end: 4px; width: 20px; height: 20px; border-radius: 50%; background: var(--teal); color: #fff; display: grid; place-items: center; }
.tick svg { width: 12px; height: 12px; }
.row3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 640px) { .row3 { grid-template-columns: 1fr; } }
.providers { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; }
.prov { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; text-align: start; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--r); background: var(--white); color: var(--pine); font: inherit; font-size: 13px; cursor: pointer; }
.prov[aria-checked='true'] { border-color: var(--teal); box-shadow: inset 0 0 0 1px var(--teal); background: var(--hover); }
.lightbox { position: fixed; inset: 0; z-index: 1000; background: rgba(8, 15, 15, 0.86); overflow: auto; display: flex; justify-content: center; padding: 24px; cursor: zoom-out; }
.lightbox img { width: min(560px, 100%); height: auto; align-self: flex-start; border-radius: 8px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
