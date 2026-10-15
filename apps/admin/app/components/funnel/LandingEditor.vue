<script setup lang="ts">
import {
  LANDING_ACCENTS,
  LANDING_ACCENT_HEX,
  LANDING_SECTION_META,
  LANDING_TEMPLATES,
  LandingSettingsSchema,
  ADDRESS_FIELD_MODES,
  defaultLandingSettings,
  getLandingTemplate,
  switchLandingTemplate,
  type AdminProductDetail,
  type FunnelStepView,
  type LandingSettings,
  type LandingTemplateId,
  type ProductLandingPage
} from '@amalice/shared'

// Landing-page settings for one Landing step: pick a template, write the copy,
// choose the accent, order/toggle sections, with a live preview. Pure UI: it edits
// a local draft and emits `save` with the whole settings object; the funnel page
// owns the API call.
const props = defineProps<{
  step: FunnelStepView
  product: AdminProductDetail
  landingPages: ProductLandingPage[]
  saving: boolean
}>()
const emit = defineEmits<{ save: [landing: LandingSettings] }>()

// Run through the schema so settings saved before newer options existed get their defaults.
const saved = computed<LandingSettings | null>(() => {
  const raw = props.step.config.landing
  if (!raw) return null
  const parsed = LandingSettingsSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
})
const draft = ref<LandingSettings | null>(saved.value ? structuredClone(toRaw(saved.value)) : null)
// Re-sync when the saved settings change underneath (after a save, or switching step).
watch(
  () => [props.step.id, JSON.stringify(saved.value)],
  () => {
    draft.value = saved.value ? structuredClone(toRaw(saved.value)) : null
  }
)

const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== JSON.stringify(saved.value))
const device = ref<'desktop' | 'mobile'>('mobile')
const template = computed(() => (draft.value ? getLandingTemplate(draft.value.templateId) : undefined))

function pick(id: LandingTemplateId) {
  draft.value = draft.value ? switchLandingTemplate(draft.value, id) : defaultLandingSettings(id)
}

function move(i: number, dir: -1 | 1) {
  if (!draft.value) return
  const to = i + dir
  const list = draft.value.sections
  if (to < 0 || to >= list.length) return
  ;[list[i], list[to]] = [list[to]!, list[i]!]
}

const pages = computed(() => props.landingPages.filter((p) => p.status === 'Completed' && p.finalImageUrl))
const pageOptions = computed(() => [{ label: 'None', value: '' }, ...pages.value.map((p) => ({ label: `${p.name} (#${p.number})`, value: p.id }))])
const pageId = computed({
  get: () => draft.value?.generatedPageId ?? '',
  set: (v: string) => {
    if (draft.value) draft.value.generatedPageId = v || null
  }
})
const generatedImage = computed(() => pages.value.find((p) => p.id === draft.value?.generatedPageId)?.finalImageUrl ?? null)
const headline = computed({
  get: () => draft.value?.headline ?? '',
  set: (v: string) => {
    if (draft.value) draft.value.headline = v || null
  }
})
const subheadline = computed({
  get: () => draft.value?.subheadline ?? '',
  set: (v: string) => {
    if (draft.value) draft.value.subheadline = v || null
  }
})

const problems = computed(() => {
  const out: string[] = []
  const d = draft.value
  if (!d) return out
  const p = props.product
  const on = d.sections.filter((x) => x.enabled).map((x) => x.type)
  if (!p.images.length && !p.imageUrl) out.push('The product has no photos yet. Add some in the product’s Images tab: the top of the page is built from them.')
  if (d.showOffers && !p.offers.some((o) => o.enabled)) out.push('“Show offers” is on but the product has no enabled offers. Add them in the product’s Offers tab.')
  if (on.includes('description') && !p.description) out.push('“Description” is on but the product has none.')
  if (on.includes('benefits') && !p.keyBenefits.length) out.push('“Key benefits” is on but the product has none. Add them in its Content tab.')
  if (on.includes('specs') && !p.specifications.length) out.push('“Specifications” is on but the product has none. Add them in its Content tab.')
  if (on.includes('faq') && !p.faqs.length) out.push('“FAQ” is on but the product has no questions. Add them in its Content tab.')
  if (d.templateId === 'image-page' && !d.generatedPageId) out.push('Choose a generated landing page to show below the order form.')
  return out
})

const ADDRESS_LABEL: Record<string, string> = { required: 'Required', optional: 'Optional', hidden: 'Not asked' }
const addressOptions = ADDRESS_FIELD_MODES.map((m) => ({ label: ADDRESS_LABEL[m]!, value: m }))

// Mobile conversion readiness: each check is a lever that moves cash-on-delivery conversion on a phone.
const checks = computed(() => {
  const d = draft.value
  const p = props.product
  if (!d) return []
  const enabledOffers = p.offers.filter((o) => o.enabled).length
  const photoCount = p.images.length || (p.imageUrl ? 1 : 0)
  return [
    { ok: photoCount >= 3, label: 'At least 3 product photos', tip: `The product has ${photoCount}. Photos sell on a phone; add more in its Images tab.` },
    { ok: d.addressField !== 'required' && !d.showNotes, label: 'Short order form', tip: 'Make the address optional (the call centre confirms by phone) and keep notes off.' },
    { ok: d.showOffers && enabledOffers > 0, label: 'Quantity offers in the form', tip: enabledOffers ? 'Turn on “Show the product’s offers”.' : 'Add offers in the product’s Offers tab: bigger baskets lift revenue per order.' },
    { ok: d.preselectBestOffer && d.showOffers && enabledOffers > 0, label: 'Best offer preselected', tip: 'Start with the best-value offer selected.' },
    { ok: d.trustBadges, label: 'Trust badges under the button', tip: 'Pay on delivery and inspect-first calm the last-second doubt.' },
    { ok: d.quickBenefits && p.keyBenefits.length >= 3, label: 'Three benefits above the form', tip: p.keyBenefits.length >= 3 ? 'Turn on “Benefits above the form”.' : 'Add at least 3 key benefits in the product’s Content tab.' },
    { ok: d.showStock && p.stockQuantity > 0, label: 'Real scarcity shown', tip: 'Shows “Only N left” automatically when real stock is low.' }
  ]
})
const score = computed(() => checks.value.filter((c) => c.ok).length)

const urgencyText = computed({
  get: () => draft.value?.urgencyText ?? '',
  set: (v: string) => {
    if (draft.value) draft.value.urgencyText = v || null
  }
})

function discard() {
  draft.value = saved.value ? structuredClone(toRaw(saved.value)) : null
}
function save() {
  if (draft.value) emit('save', structuredClone(toRaw(draft.value)))
}
</script>

<template>
  <div class="stack">
    <!-- Template gallery -->
    <section class="card" aria-label="Landing page template">
      <div class="card-head">
        <h2>Template</h2>
        <span class="muted">{{ draft ? 'Switching keeps your copy, colour and order-form choices.' : 'Every page is: photos, title, order form, then the rest. Pick how it looks.' }}</span>
      </div>
      <div class="gallery" role="radiogroup" aria-label="Landing page template">
        <button
          v-for="t in LANDING_TEMPLATES"
          :key="t.id"
          type="button"
          role="radio"
          class="tpl"
          :aria-checked="draft?.templateId === t.id"
          @click="pick(t.id)"
        >
          <span class="wire" :class="[`w-${t.layout}`, { urgent: t.defaults.urgency }]" aria-hidden="true">
            <i class="photos" /><i class="title" /><i class="form" /><i class="details" />
          </span>
          <b>{{ t.name }}</b>
          <span class="muted">{{ t.description }}</span>
          <span class="best"><AdsIcon name="i-lucide-check" />{{ t.bestFor }}</span>
        </button>
      </div>
    </section>

    <div v-if="draft" class="split wide-side">
      <!-- Preview -->
      <section class="card" aria-label="Preview" style="min-width: 0">
        <div class="card-head">
          <h2>Preview</h2>
          <AdsTabs
            v-model="device"
            :items="[{ label: 'Mobile', value: 'mobile', icon: 'i-lucide-smartphone' }, { label: 'Desktop', value: 'desktop', icon: 'i-lucide-monitor' }]"
          />
        </div>
        <FunnelLandingPreview :settings="draft" :product="product" :generated-image-url="generatedImage" :device="device" />
        <p class="muted">A sketch of the storefront page built from your product’s real photos, price, offers, benefits and FAQ. Scroll inside the phone. The reviews block shows the product’s real approved reviews on the live page, and is left out when there are none.</p>
      </section>

      <div class="stack">
        <p v-for="p in problems" :key="p" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>{{ p }}</span></p>

        <section class="card" aria-label="Mobile conversion">
          <div class="card-head"><h2>Mobile conversion</h2><span class="pill" :class="score >= 7 ? 'confirmed' : score >= 5 ? 'new' : 'returned'">{{ score }}/{{ checks.length }}</span></div>
          <div class="track" aria-hidden="true"><div :style="{ width: `${(score / Math.max(checks.length, 1)) * 100}%`, background: score >= 7 ? 'var(--teal)' : score >= 5 ? 'var(--brass)' : 'var(--danger)' }" /></div>
          <ul class="checklist">
            <li v-for="c in checks" :key="c.label" :class="{ ok: c.ok }">
              <AdsIcon :name="c.ok ? 'i-lucide-check-circle-2' : 'i-lucide-alert-triangle'" />
              <span><b>{{ c.label }}</b><small v-if="!c.ok">{{ c.tip }}</small></span>
            </li>
          </ul>
        </section>

        <section class="card" aria-label="Content">
          <div class="card-head"><h2>Content</h2></div>
          <AdsField label="Headline" :help="`Leave blank to use the product name (${product.name}).`"><AdsInput v-model="headline" placeholder="e.g. The neck fan that fits in your pocket" /></AdsField>
          <AdsField label="Subheadline"><AdsTextarea v-model="subheadline" :rows="2" placeholder="One supporting sentence" /></AdsField>
        </section>

        <section class="card" aria-label="Order form">
          <div class="card-head"><h2>Order form</h2></div>
          <AdsField label="Button text"><AdsInput v-model="draft.ctaLabel" /></AdsField>
          <div class="setting">
            <div class="text"><b>Show the price</b><span>In the title area and the order total.</span></div>
            <AdsSwitch v-model="draft.showPrice" aria-label="Show the price" />
          </div>
          <div class="setting">
            <div class="text"><b>Show the product’s offers</b><span>Let the customer pick a quantity offer in the form.</span></div>
            <AdsSwitch v-model="draft.showOffers" aria-label="Show the product's offers" />
          </div>
          <AdsField label="Address field" help="Fewer fields convert better. The call centre confirms the address by phone.">
            <AdsSelect v-model="draft.addressField" :items="addressOptions" />
          </AdsField>
          <div class="setting">
            <div class="text"><b>Notes box</b><span>An optional free-text field. Off keeps the form shorter.</span></div>
            <AdsSwitch v-model="draft.showNotes" aria-label="Notes box" />
          </div>
          <div class="setting">
            <div class="text"><b>Preselect the best offer</b><span>Start with the best-value offer instead of one unit.</span></div>
            <AdsSwitch v-model="draft.preselectBestOffer" aria-label="Preselect the best offer" />
          </div>
          <div class="setting">
            <div class="text"><b>Trust badges</b><span>Pay on delivery, inspect first, easy returns, under the button.</span></div>
            <AdsSwitch v-model="draft.trustBadges" aria-label="Trust badges" />
          </div>
          <div class="setting">
            <div class="text"><b>Benefits above the form</b><span>The first three key benefits, right under the price.</span></div>
            <AdsSwitch v-model="draft.quickBenefits" aria-label="Benefits above the form" />
          </div>
          <div class="setting">
            <div class="text"><b>Low-stock notice</b><span>“Only N left” when real stock is low. Never invented.</span></div>
            <AdsSwitch v-model="draft.showStock" aria-label="Low-stock notice" />
          </div>
          <div class="setting">
            <div class="text"><b>Urgency banner</b><span>A line across the very top of the page.</span></div>
            <AdsSwitch v-model="draft.urgency" aria-label="Urgency banner" />
          </div>
          <AdsField v-if="draft.urgency" label="Banner text" help="Leave blank for the default line.">
            <AdsInput v-model="urgencyText" placeholder="e.g. Only a few pieces left" />
          </AdsField>
        </section>

        <section class="card" aria-label="Style">
          <div class="card-head"><h2>Accent colour</h2></div>
          <div class="swatches" role="radiogroup" aria-label="Accent colour">
            <button
              v-for="a in LANDING_ACCENTS"
              :key="a"
              type="button"
              role="radio"
              class="swatch"
              :aria-checked="draft.accent === a"
              :title="LANDING_ACCENT_HEX[a].label"
              @click="draft.accent = a"
            >
              <span :style="{ background: LANDING_ACCENT_HEX[a].solid }" /><b>{{ LANDING_ACCENT_HEX[a].label }}</b>
            </button>
          </div>
        </section>

        <section v-if="template?.layout === 'image'" class="card" aria-label="Generated page">
          <div class="card-head"><h2>Generated page</h2></div>
          <AdsField label="Long image" help="Built in the product’s Landing Page tab (AI generation).">
            <AdsSelect v-model="pageId" :items="pageOptions" />
          </AdsField>
          <p v-if="!pages.length" class="muted">No finished generated page for this product yet. <NuxtLink :to="`/products/${product.id}`">Open the product</NuxtLink> and use its Landing Page tab.</p>
        </section>

        <section class="card" aria-label="Sections">
          <div class="card-head"><h2>Rest of the page</h2><span class="muted">Below the order form</span></div>
          <ol class="sec-list">
            <li v-for="(s, i) in draft.sections" :key="s.type" :class="{ off: !s.enabled }">
              <span class="ico"><AdsIcon :name="LANDING_SECTION_META[s.type].icon" /></span>
              <span class="grow info"><b>{{ LANDING_SECTION_META[s.type].label }}</b><span class="muted">{{ LANDING_SECTION_META[s.type].description }}</span></span>
              <AdsSwitch v-model="s.enabled" :aria-label="`Show ${LANDING_SECTION_META[s.type].label}`" />
              <AdsButton square appearance="subtle" size="sm" icon="i-lucide-arrow-up" :disabled="i === 0" aria-label="Move up" @click="move(i, -1)" />
              <AdsButton square appearance="subtle" size="sm" icon="i-lucide-arrow-down" :disabled="i === draft.sections.length - 1" aria-label="Move down" @click="move(i, 1)" />
            </li>
          </ol>
        </section>
      </div>
    </div>

    <div class="savebar" :class="{ on: dirty }">
      <span>Unsaved landing page changes</span>
      <button class="btn" type="button" @click="discard">Discard</button>
      <AdsButton appearance="brass" :loading="saving" icon="i-lucide-check" @click="save">Save landing page</AdsButton>
    </div>
  </div>
</template>

<style scoped>
.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.tpl { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; text-align: start; padding: 12px; border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--white); color: var(--pine); font: inherit; font-size: 13px; cursor: pointer; }
.tpl:hover { border-color: var(--teal); }
.tpl[aria-checked='true'] { border-color: var(--teal); box-shadow: inset 0 0 0 1px var(--teal); background: var(--hover); }
.tpl b { font-size: 14px; font-weight: 600; }
.best { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--teal); margin-top: auto; }
.best svg { width: 14px; height: 14px; }

/* Wireframe thumbnails: photos / title / order form / details, drawn per layout. */
.wire { width: 100%; aspect-ratio: 16 / 11; border-radius: var(--r); background: var(--ivory); border: 1px solid var(--line-soft); padding: 8px; display: grid; gap: 4px; position: relative; overflow: hidden; }
.wire i { background: var(--white); border: 1px solid var(--line); border-radius: 3px; display: block; }
.wire .photos { background: var(--mist); }
.wire .form { background: var(--white); border-color: var(--teal); }
.wire .details { background: var(--ivory); border-style: dashed; }
.w-stacked, .w-image { grid-template-rows: 1.5fr 0.35fr 1fr 0.7fr; }
.w-stacked i, .w-image i, .w-compact i { grid-column: 1; }
.w-image .details { background: var(--mist); border-style: solid; }
.w-split { grid-template-columns: 1fr 1fr; grid-template-rows: 0.35fr 1fr 0.6fr; }
.w-split .photos { grid-row: 1 / 3; grid-column: 1; }
.w-split .title { grid-row: 1; grid-column: 2; }
.w-split .form { grid-row: 2; grid-column: 2; }
.w-split .details { grid-row: 3; grid-column: 1 / 3; }
.w-compact { grid-template-rows: 0.55fr 0.3fr 1.2fr 0.5fr; }
.wire.urgent::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 7px; background: var(--brass); }
.wire::after { content: ''; position: absolute; inset: auto 8px 4px 8px; height: 6px; border-radius: 2px; background: var(--teal); }

.checklist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.checklist li { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; color: var(--warn-fg); }
.checklist li.ok { color: var(--teal); }
.checklist svg { width: 17px; height: 17px; flex-shrink: 0; margin-top: 1px; }
.checklist span { display: flex; flex-direction: column; gap: 2px; }
.checklist b { font-weight: 600; }
.checklist small { font-size: 12px; color: var(--text-2); }
.swatches { display: flex; flex-wrap: wrap; gap: 8px; }
.swatch { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px 6px 6px; border: 1px solid var(--line); border-radius: var(--r); background: var(--white); color: var(--pine); font: inherit; font-size: 13px; cursor: pointer; }
.swatch[aria-checked='true'] { border-color: var(--teal); box-shadow: inset 0 0 0 1px var(--teal); }
.swatch span { width: 22px; height: 22px; border-radius: 4px; }
.swatch b { font-weight: 500; }

.sec-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.sec-list li { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--row-line); }
.sec-list li:first-child { padding-top: 0; }
.sec-list li:last-child { border-bottom: 0; padding-bottom: 0; }
.sec-list li.off .info, .sec-list li.off .ico { opacity: .45; }
.ico { width: 32px; height: 32px; border-radius: var(--r); background: var(--mist); color: var(--teal); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ico svg { width: 16px; height: 16px; }
.info { display: flex; flex-direction: column; min-width: 0; font-size: 13px; }
.info b { font-weight: 600; }
</style>
