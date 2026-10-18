<script setup lang="ts">
import {
  BRAND_FONTS,
  DEFAULT_BRAND,
  RAMP_STOPS,
  brandFontFamily,
  brandFontStylesheetUrl,
  buildColorRamp,
  contrastWithWhite,
  type Brand,
  type BrandFontId,
  type LogoAnalysis,
  type StoreSettings
} from '@amalice/shared'

definePageMeta({ requiredRole: 'SuperAdmin' })

const api = useAdminApi()
const toast = useToast()
const config = useRuntimeConfig()
const auth = useAuthStore()
const { resolveImageUrl } = useResolveImageUrl()

// Load every candidate font once so the picker and the preview can show real
// glyphs. (Cairo is already the app's own font.)
useHead({
  title: 'Brand identity',
  link: BRAND_FONTS.flatMap((f) => {
    const href = brandFontStylesheetUrl(f.id)
    return href ? [{ rel: 'stylesheet', href }] : []
  })
})

const { data: settings, pending, error: loadError } = await useAdminFetch<StoreSettings>('/admin/settings', { key: 'admin-brand' })

const { apply: applyToAdmin } = useAdminBrand()

const brand = reactive<Brand>({ ...DEFAULT_BRAND })
const saved = ref<Brand>({ ...DEFAULT_BRAND })
const palette = ref<string[]>([])
const analysis = ref<LogoAnalysis | null>(null)

function load(from: Brand | null | undefined) {
  Object.assign(brand, { ...DEFAULT_BRAND, ...(from ?? {}) })
  saved.value = { ...brand }
}
watch(settings, (s) => { if (s) load(s.brand) }, { immediate: true })

const dirty = computed(() => JSON.stringify({ ...brand }) !== JSON.stringify(saved.value))
const storeName = computed(() => settings.value?.storeName ?? 'Amalice')

// ---- Colour ----
const ramp = computed(() => (brand.primaryColor ? buildColorRamp(brand.primaryColor) : null))
const contrast = computed(() => (brand.primaryColor ? contrastWithWhite(ramp.value![600]) : null))
const hexDraft = ref('')
watch(() => brand.primaryColor, (v) => { hexDraft.value = v ?? '' }, { immediate: true })
function commitHex() {
  const v = hexDraft.value.trim()
  if (!v) { brand.primaryColor = null; return }
  const withHash = v.startsWith('#') ? v : `#${v}`
  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) brand.primaryColor = withHash.toLowerCase()
  else hexDraft.value = brand.primaryColor ?? ''
}
function setPrimary(hex: string) { brand.primaryColor = hex.toLowerCase() }

// ---- Font ----
const selectedFont = computed<BrandFontId>(() => brand.fontId ?? 'cairo')
function pickFont(id: BrandFontId) { brand.fontId = id === 'cairo' ? null : id }
const fontFamily = computed(() => brandFontFamily(brand.fontId))

// ---- Uploads ----
const logoInput = ref<HTMLInputElement | null>(null)
const faviconInput = ref<HTMLInputElement | null>(null)
const uploading = ref<'logo' | 'favicon' | null>(null)
const analyzing = ref(false)

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await $fetch<{ url: string }>('/admin/upload', {
    baseURL: config.public.apiBase,
    method: 'POST',
    body: formData,
    headers: { Authorization: `Bearer ${auth.token}` }
  })
  return res.url
}

async function analyze(url: string, opts: { announce: boolean }) {
  analyzing.value = true
  try {
    const result = await api<LogoAnalysis>('/admin/settings/brand/analyze-logo', { method: 'POST', body: { logoUrl: url } })
    analysis.value = result
    palette.value = result.palette
    if (result.primaryColor) brand.primaryColor = result.primaryColor
    if (result.fontId) brand.fontId = result.fontId === 'cairo' ? null : result.fontId
    if (opts.announce) {
      toast.add({
        title: 'Identity built from your logo',
        description: result.aiUsed ? 'Colours and font suggested — review them, then save.' : 'Colours extracted. Set GEMINI_API_KEY on the API to also get a font suggestion.',
        color: 'success'
      })
    }
  } catch (e) {
    toast.add({ title: 'Could not analyse the logo', description: (e as { data?: { message?: string } }).data?.message, color: 'error' })
  } finally {
    analyzing.value = false
  }
}

async function onLogoSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = 'logo'
  try {
    brand.logoUrl = await uploadImage(file)
  } catch {
    toast.add({ title: 'Upload failed', color: 'error' })
    return
  } finally {
    uploading.value = null
    input.value = ''
  }
  await analyze(brand.logoUrl!, { announce: true })
}

async function onFaviconSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = 'favicon'
  try {
    brand.faviconUrl = await uploadImage(file)
  } catch {
    toast.add({ title: 'Upload failed', color: 'error' })
  } finally {
    uploading.value = null
    input.value = ''
  }
}

// ---- Save ----
const saving = ref(false)
async function save() {
  saving.value = true
  try {
    const updated = await api<Brand>('/admin/settings/brand', { method: 'PUT', body: { ...brand } })
    load(updated)
    applyToAdmin(updated)
    toast.add({ title: 'Brand identity saved', description: 'The storefront picks it up on the next page load.', color: 'success' })
  } catch {
    toast.add({ title: 'Save failed', color: 'error' })
  } finally {
    saving.value = false
  }
}
function discard() { load(saved.value) }
function resetAll() { Object.assign(brand, DEFAULT_BRAND); palette.value = []; analysis.value = null }

const storefrontBase = config.public.storefrontBase

// Live preview: a miniature storefront header + CTA using the derived ramp.
const previewVars = computed(() => {
  if (!ramp.value) return {}
  return Object.fromEntries(RAMP_STOPS.map((s) => [`--p-${s}`, ramp.value![s]]))
})
</script>

<template>
  <AdsPage title="Brand identity" description="Logo, colours and typography across every storefront template.">
    <template #actions>
      <a class="btn" :href="storefrontBase" target="_blank" rel="noopener"><AdsDesignIcon name="external" />View store</a>
      <button class="btn" type="button" :disabled="!dirty" @click="discard">Discard</button>
      <button class="btn btn-primary" type="button" :disabled="saving || !dirty" @click="save">{{ saving ? 'Saving…' : 'Save brand' }}</button>
    </template>

    <div v-if="pending" class="empty">Loading…</div>
    <div v-else-if="loadError" class="empty"><p style="color: var(--danger-fg)">Failed to load brand settings.</p><p>{{ loadError.message }}</p></div>
    <div v-else class="split wide-side">
      <div class="stack">
        <!-- Logo -->
        <section class="card" aria-labelledby="logo-h">
          <div class="card-head"><h2 id="logo-h">Logo</h2></div>
          <p class="card-sub">Upload your logo and we read its colours{{ analysis?.aiUsed === false ? '' : ' and typeface style' }} to build the identity for you. PNG with a transparent background or SVG works best.</p>
          <div class="brand-logo-row">
            <div class="brand-logo-box">
              <img v-if="brand.logoUrl" :src="resolveImageUrl(brand.logoUrl)" alt="Logo" >
              <span v-else class="muted">No logo</span>
            </div>
            <div class="stack" style="gap: 8px">
              <div style="display: flex; gap: 8px; flex-wrap: wrap">
                <input ref="logoInput" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden @change="onLogoSelected">
                <button class="btn btn-primary" type="button" :disabled="uploading === 'logo' || analyzing" @click="logoInput?.click()">
                  <AdsIcon name="i-lucide-upload" />{{ uploading === 'logo' ? 'Uploading…' : brand.logoUrl ? 'Replace logo' : 'Upload logo' }}
                </button>
                <button v-if="brand.logoUrl" class="btn" type="button" :disabled="analyzing" @click="analyze(brand.logoUrl!, { announce: true })">
                  <AdsIcon name="i-lucide-wand-2" />{{ analyzing ? 'Analysing…' : 'Rebuild identity from logo' }}
                </button>
                <button v-if="brand.logoUrl" class="btn" type="button" @click="brand.logoUrl = null">Remove</button>
              </div>
              <span class="muted" style="font-size: 12px">Shown in the storefront header instead of the store name ({{ storeName }}).</span>
              <AdsBanner v-if="analysis?.fontReason">Font suggestion: {{ analysis.fontReason }}</AdsBanner>
            </div>
          </div>
        </section>

        <!-- Colour -->
        <section class="card" aria-labelledby="color-h">
          <div class="card-head">
            <h2 id="color-h">Primary colour</h2>
            <button v-if="brand.primaryColor" class="btn btn-sm" type="button" @click="brand.primaryColor = null">Use template colours</button>
          </div>
          <p class="card-sub">Drives buttons, links, badges and accents on every template. Leave empty to keep each template's own palette.</p>
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap">
            <input class="brand-color" type="color" :value="brand.primaryColor ?? '#1a73e8'" aria-label="Primary colour" @input="setPrimary(($event.target as HTMLInputElement).value)">
            <AdsInput v-model="hexDraft" placeholder="#1a73e8" style="max-width: 140px" @blur="commitHex" @keydown.enter.prevent="commitHex" />
            <span v-if="!brand.primaryColor" class="muted">Using each template's default colours</span>
          </div>
          <div v-if="palette.length" style="margin-top: 14px">
            <span class="muted" style="font-size: 12px">Colours found in your logo — click one to use it</span>
            <div class="brand-swatches">
              <button v-for="c in palette" :key="c" type="button" class="brand-swatch" :class="{ on: brand.primaryColor === c }" :style="{ background: c }" :title="c" :aria-label="`Use ${c}`" @click="setPrimary(c)" />
            </div>
          </div>
          <div v-if="ramp" style="margin-top: 14px">
            <span class="muted" style="font-size: 12px">Generated shades (500 is your colour)</span>
            <div class="brand-ramp">
              <div v-for="s in RAMP_STOPS" :key="s" :style="{ background: ramp[s] }" :title="`${s}: ${ramp[s]}`"><span :style="{ color: s < 500 ? '#111' : '#fff' }">{{ s }}</span></div>
            </div>
            <AdsBanner v-if="contrast !== null && contrast < 4.5" style="margin-top: 10px">White text on this colour is hard to read (contrast {{ contrast.toFixed(1) }}:1, 4.5:1 recommended). Pick a darker shade for button-heavy templates.</AdsBanner>
          </div>
        </section>

        <!-- Typography -->
        <section class="card" aria-labelledby="font-h">
          <div class="card-head">
            <h2 id="font-h">Typography</h2>
            <span v-if="analysis?.fontId" class="muted">Suggested from your logo</span>
          </div>
          <p class="card-sub">The typeface for all storefront text, headings included. All options support Arabic. Latin numerals in prices and SKUs keep their monospace face.</p>
          <div class="brand-fonts">
            <button
              v-for="f in BRAND_FONTS"
              :key="f.id"
              type="button"
              class="brand-font"
              :class="{ on: selectedFont === f.id }"
              :style="{ fontFamily: `'${f.family}', 'Cairo', sans-serif` }"
              @click="pickFont(f.id)"
            >
              <b>أماليس للتسوق</b>
              <span class="sample">الدفع عند الاستلام 1234</span>
              <small class="meta">{{ f.label }}{{ f.id === 'cairo' ? ' · default' : '' }}</small>
            </button>
          </div>
        </section>

        <!-- Favicon -->
        <section class="card" aria-labelledby="fav-h">
          <div class="card-head"><h2 id="fav-h">Favicon</h2></div>
          <p class="card-sub">The small icon in browser tabs. Square images work best; leave empty to use your logo.</p>
          <div class="brand-logo-row">
            <div class="brand-logo-box" style="width: 64px; height: 64px">
              <img v-if="brand.faviconUrl || brand.logoUrl" :src="resolveImageUrl(brand.faviconUrl || brand.logoUrl!)" alt="Favicon">
              <span v-else class="muted">—</span>
            </div>
            <div style="display: flex; gap: 8px">
              <input ref="faviconInput" type="file" accept="image/png,image/x-icon,image/svg+xml,image/webp" hidden @change="onFaviconSelected">
              <button class="btn" type="button" :disabled="uploading === 'favicon'" @click="faviconInput?.click()"><AdsIcon name="i-lucide-upload" />{{ uploading === 'favicon' ? 'Uploading…' : 'Upload favicon' }}</button>
              <button v-if="brand.faviconUrl" class="btn" type="button" @click="brand.faviconUrl = null">Use logo</button>
            </div>
          </div>
        </section>

        <div><button class="btn" type="button" @click="resetAll">Reset everything to defaults</button></div>
      </div>

      <!-- Live preview -->
      <aside class="stack" style="position: sticky; top: 16px">
        <section class="card" aria-labelledby="prev-h">
          <div class="card-head"><h2 id="prev-h">Preview</h2></div>
          <div class="brand-preview" :style="{ ...previewVars, fontFamily }" dir="rtl">
            <div class="bp-head">
              <img v-if="brand.logoUrl" :src="resolveImageUrl(brand.logoUrl)" alt="">
              <b v-else>{{ storeName }}</b>
              <span class="bp-links"><i /><i /><i /></span>
            </div>
            <div class="bp-body">
              <h3>تسوق مع الدفع عند الاستلام</h3>
              <p>اطلب الآن وادفع عند وصول طلبك إلى باب منزلك.</p>
              <div class="bp-row">
                <button type="button" class="bp-btn" :style="ramp ? { background: ramp[600] } : undefined">اطلب الآن</button>
                <button type="button" class="bp-btn ghost" :style="ramp ? { color: ramp[700], borderColor: ramp[300] } : undefined">التفاصيل</button>
              </div>
              <div class="bp-row">
                <span class="bp-chip" :style="ramp ? { background: ramp[100], color: ramp[800] } : undefined">جديد</span>
                <span class="bp-price" :style="ramp ? { color: ramp[700] } : undefined">4,500 د.ج</span>
              </div>
            </div>
          </div>
          <p class="muted" style="font-size: 12px; margin-top: 8px">Approximate preview. Each template keeps its own layout, shapes and spacing; only colour, font and logo change.</p>
        </section>
      </aside>
    </div>
  </AdsPage>
</template>

<style scoped>
.brand-logo-row { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.brand-logo-box { width: 160px; height: 96px; border: 1px dashed var(--border, #d1d5db); border-radius: 10px; display: flex; align-items: center; justify-content: center; background: repeating-conic-gradient(#f3f4f6 0% 25%, #fff 0% 50%) 50% / 16px 16px; overflow: hidden; }
.brand-logo-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
.brand-color { width: 48px; height: 40px; padding: 2px; border: 1px solid var(--border, #d1d5db); border-radius: 8px; background: transparent; cursor: pointer; }
.brand-swatches { display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
.brand-swatch { width: 36px; height: 36px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px #d1d5db; cursor: pointer; }
.brand-swatch.on { box-shadow: 0 0 0 2px #111; }
.brand-ramp { display: grid; grid-template-columns: repeat(11, 1fr); border-radius: 8px; overflow: hidden; margin-top: 6px; }
.brand-ramp div { height: 44px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 4px; font-size: 10px; font-weight: 600; }
.brand-fonts { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
.brand-font { text-align: right; direction: rtl; border: 1px solid var(--border, #d1d5db); border-radius: 10px; padding: 12px; background: transparent; cursor: pointer; display: flex; flex-direction: column; gap: 4px; }
.brand-font b { font-size: 18px; font-weight: 700; }
.brand-font .sample { font-size: 13px; opacity: .75; }
.brand-font .meta { font-family: system-ui, sans-serif; direction: ltr; text-align: left; font-size: 11px; opacity: .6; margin-top: 4px; }
.brand-font.on { border-color: #111; box-shadow: 0 0 0 1px #111; }
.brand-preview { border: 1px solid var(--border, #e5e7eb); border-radius: 12px; overflow: hidden; background: #fff; color: #111; --p-600: #111827; --p-700: #111827; }
.bp-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #eee; }
.bp-head img { height: 28px; width: auto; max-width: 140px; object-fit: contain; }
.bp-head b { font-size: 18px; }
.bp-links { display: flex; gap: 6px; } .bp-links i { width: 28px; height: 6px; border-radius: 3px; background: #e5e7eb; }
.bp-body { padding: 18px 16px 20px; display: flex; flex-direction: column; gap: 10px; }
.bp-body h3 { font-size: 18px; font-weight: 700; margin: 0; }
.bp-body p { margin: 0; font-size: 13px; color: #4b5563; line-height: 1.7; }
.bp-row { display: flex; gap: 8px; align-items: center; }
.bp-btn { border: 1px solid transparent; background: #111827; color: #fff; border-radius: 8px; padding: 8px 16px; font: inherit; font-weight: 600; font-size: 13px; }
.bp-btn.ghost { background: transparent; color: #111827; border-color: #d1d5db; }
.bp-chip { border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; background: #f3f4f6; }
.bp-price { font-weight: 700; }
@media (max-width: 900px) { .brand-ramp { grid-template-columns: repeat(6, 1fr); } }
</style>
