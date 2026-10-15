<script setup lang="ts">
import {
  FUNNEL_COPY_AR as T,
  LANDING_ACCENT_HEX,
  formatDa,
  getLandingTemplate,
  offerPriceCents,
  offerTotalQuantity,
  unitsLabel,
  type LandingSettings,
  type ProductOffer
} from '@amalice/shared'

// Live preview of a funnel's landing page, phone-first. Backbone of every template:
// product photos, title + price, the order form (offers, short form), then the rest
// of the page. Built for cash-on-delivery conversion on a phone: big tap targets,
// 16px inputs (no iOS zoom), a short form, tappable offer cards with the best value
// flagged, honest scarcity (real stock only) and an order bar pinned to the bottom.
// Customer reviews are sample text (the platform has no review text) and are labelled.
const props = defineProps<{
  settings: LandingSettings
  product: {
    name: string
    description: string | null
    priceCents: number
    stockQuantity: number
    lowStockThreshold: number
    imageUrl: string | null
    images: { url: string }[]
    keyBenefits: string[]
    faqs: { question: string; answer: string }[]
    specifications: { label: string; value: string }[]
    offers: ProductOffer[]
  }
  generatedImageUrl?: string | null
  device: 'desktop' | 'mobile'
}>()

const { resolveImageUrl } = useResolveImageUrl()
const template = computed(() => getLandingTemplate(props.settings.templateId))
const layout = computed(() => template.value?.layout ?? 'stacked')
const accent = computed(() => LANDING_ACCENT_HEX[props.settings.accent])
const sections = computed(() => props.settings.sections.filter((s) => s.enabled).map((s) => s.type))
const photos = computed(() => {
  const list = props.product.images.map((i) => i.url)
  if (!list.length && props.product.imageUrl) list.push(props.product.imageUrl)
  return list.map(resolveImageUrl)
})
const active = ref(0)
watch(photos, () => (active.value = 0))

const fmt = formatDa
const headline = computed(() => props.settings.headline?.trim() || props.product.name)
const isImage = computed(() => layout.value === 'image')
const compact = computed(() => layout.value === 'compact')
const mobile = computed(() => props.device === 'mobile')

// Offers as the form shows them: the plain unit first, then each enabled offer. The one that
// saves the customer the most is flagged "Best value".
const offers = computed(() => {
  const unit = props.product.priceCents
  const list = [{ key: 'one', label: T.singleUnit, note: T.singleItemNote, total: unit, save: 0, best: false }]
  for (const o of props.product.offers.filter((x) => x.enabled)) {
    const qty = offerTotalQuantity(o)
    const total = offerPriceCents(o, unit)
    const label = o.type === 'FixedBundlePrice' ? T.buyX(o.requiredQuantity) : o.type === 'BuyXGetYFree' ? T.buyXGetY(o.requiredQuantity, o.freeQuantity) : T.buyXFreeShipping(o.requiredQuantity)
    list.push({ key: o.id, label, note: o.type === 'FreeShipping' ? T.freeShippingNote(unitsLabel(qty)) : unitsLabel(qty), total, save: Math.max(0, unit * qty - total), best: false })
  }
  const top = list.reduce((a, b) => (b.save > a.save ? b : a), list[0]!)
  if (top.save > 0) top.best = true
  return list
})
const chosen = ref('one')
function resetChoice() {
  const best = offers.value.find((o) => o.best)
  chosen.value = props.settings.preselectBestOffer && best ? best.key : 'one'
}
watch(() => [offers.value.map((o) => o.key).join(), props.settings.preselectBestOffer], resetChoice, { immediate: true })
const total = computed(() => offers.value.find((o) => o.key === chosen.value)?.total ?? props.product.priceCents)
const showOffers = computed(() => props.settings.showOffers && offers.value.length > 1)

const lowStock = computed(() => {
  const n = props.product.stockQuantity
  return props.settings.showStock && n > 0 && n <= Math.max(props.product.lowStockThreshold, 10) ? n : null
})
const quickBenefits = computed(() => (props.settings.quickBenefits ? props.product.keyBenefits.slice(0, 3) : []))

const plainDescription = computed(() => {
  const html = props.product.description
  if (!html) return ''
  const text = new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? ''
  return text.length > 420 ? `${text.slice(0, 420)}…` : text
})
const benefits = computed(() => props.product.keyBenefits)
const faqs = computed(() => props.product.faqs.slice(0, 4))
const specs = computed(() => props.product.specifications.slice(0, 8))
</script>

<template>
  <div class="device" :class="[device, `layout-${layout}`]" :style="{ '--a': accent.solid, '--s': accent.soft }">
    <div v-if="mobile" class="notch" aria-hidden="true"><span /></div>
    <div v-else class="chrome" aria-hidden="true"><i /><i /><i /><span>/f/…</span></div>

    <div class="scroller" :dir="T.dir" :lang="T.lang">
      <div v-if="settings.urgency" class="urgency"><AdsIcon name="i-lucide-clock" />{{ settings.urgencyText?.trim() || T.defaultUrgency }}</div>

      <div class="page">
        <div class="top">
          <!-- 1. Photos -->
          <div class="photos">
            <div class="main">
              <img v-if="photos[active]" :src="photos[active]" alt="">
              <AdsIcon v-else name="i-lucide-image" />
              <span class="cod-badge"><AdsIcon name="i-lucide-truck" />{{ T.payOnDelivery }}</span>
              <span v-if="photos.length > 1" class="count">{{ active + 1 }}/{{ photos.length }}</span>
            </div>
            <div v-if="photos.length > 1 && mobile" class="dots"><button v-for="(u, i) in photos.slice(0, 8)" :key="i" type="button" :class="{ on: i === active }" :aria-label="`Photo ${i + 1}`" @click="active = i" /></div>
            <div v-else-if="photos.length > 1" class="strip">
              <button v-for="(u, i) in photos.slice(0, compact ? 4 : 6)" :key="i" type="button" :class="{ on: i === active }" :aria-label="`Photo ${i + 1}`" @click="active = i"><img :src="u" alt=""></button>
            </div>
          </div>

          <div class="buy">
            <!-- 2. Title + price -->
            <div class="title">
              <h2>{{ headline }}</h2>
              <p v-if="settings.subheadline" class="sub">{{ settings.subheadline }}</p>
              <div v-if="settings.showPrice" class="price-row">
                <span class="price">{{ fmt(product.priceCents) }}</span>
                <span v-if="offers.find((o) => o.best)" class="from">{{ T.lessPerUnit }}</span>
              </div>
              <p v-if="lowStock" class="stock"><i />{{ T.onlyLeft(lowStock) }}</p>
            </div>

            <ul v-if="quickBenefits.length" class="quick">
              <li v-for="(b, i) in quickBenefits" :key="i"><AdsIcon name="i-lucide-check" />{{ b }}</li>
            </ul>

            <!-- 3. Order form -->
            <form class="order" @submit.prevent>
              <div class="form-head"><b>{{ T.orderNow }}</b><span><AdsIcon name="i-lucide-shield" />{{ T.payWhenArrives }}</span></div>

              <fieldset v-if="showOffers">
                <legend>{{ T.chooseOffer }}</legend>
                <label v-for="o in offers" :key="o.key" class="offer" :class="{ on: chosen === o.key }">
                  <input v-model="chosen" type="radio" name="offer" :value="o.key">
                  <span class="radio" aria-hidden="true" />
                  <span class="grow">
                    <b>{{ o.label }}</b>
                    <small>{{ o.note }}<template v-if="o.save"> · <em>{{ T.save(fmt(o.save)) }}</em></template></small>
                  </span>
                  <span class="amt">{{ fmt(o.total) }}</span>
                  <span v-if="o.best" class="ribbon">{{ T.bestValue }}</span>
                </label>
              </fieldset>

              <div class="field"><span>{{ T.fullName }}</span><i><AdsIcon name="i-lucide-user" /></i></div>
              <div class="field"><span>{{ T.phone }}</span><i><AdsIcon name="i-lucide-phone-call" /><em>{{ T.phoneHint }}</em></i></div>
              <div class="two">
                <div class="field"><span>{{ T.wilaya }}</span><i><AdsIcon name="i-lucide-chevron-down" /></i></div>
                <div class="field"><span>{{ T.commune }}</span><i><AdsIcon name="i-lucide-chevron-down" /></i></div>
              </div>
              <div v-if="settings.addressField !== 'hidden'" class="field"><span>{{ T.address }}<template v-if="settings.addressField === 'optional'"> {{ T.optional }}</template></span><i /></div>
              <div class="seg" aria-hidden="true"><span class="on"><AdsIcon name="i-lucide-package" />{{ T.homeDelivery }}</span><span><AdsIcon name="i-lucide-truck" />{{ T.deskDelivery }}</span></div>
              <div v-if="settings.showNotes" class="field"><span>{{ T.notes }}</span><i class="tall" /></div>

              <div v-if="settings.showPrice" class="sum">
                <div><span>{{ T.product }}</span><span>{{ fmt(total) }}</span></div>
                <div><span>{{ T.delivery }}</span><span>{{ T.deliveryByWilaya }}</span></div>
                <div class="grand"><span>{{ T.toPay }}</span><b>{{ fmt(total) }}</b></div>
              </div>
              <span class="btn-cta"><AdsIcon name="i-lucide-arrow-right" />{{ settings.ctaLabel }}</span>

              <ul v-if="settings.trustBadges" class="trust">
                <li><AdsIcon name="i-lucide-truck" />{{ T.trust[0] }}</li>
                <li><AdsIcon name="i-lucide-eye" />{{ T.trust[1] }}</li>
                <li><AdsIcon name="i-lucide-arrow-left" />{{ T.trust[2] }}</li>
              </ul>
              <small class="safe">{{ T.safeNote }}</small>
            </form>
          </div>
        </div>

        <!-- 4. The rest of the page -->
        <div class="details">
          <template v-if="isImage">
            <img v-if="generatedImageUrl" :src="resolveImageUrl(generatedImageUrl)" class="long" alt="">
            <div v-else class="long-ph"><AdsIcon name="i-lucide-image" /><span dir="ltr">Choose a generated page to show here</span></div>
          </template>

          <template v-for="type in sections" :key="type">
            <section v-if="type === 'description'" class="block">
              <h3>{{ T.about }}</h3>
              <p v-if="plainDescription" class="text">{{ plainDescription }}</p>
              <p v-else class="ghost">{{ T.noteNoDescription }}</p>
            </section>

            <section v-else-if="type === 'benefits'" class="block">
              <h3>{{ T.why }}</h3>
              <ul v-if="benefits.length" class="checks">
                <li v-for="(b, i) in benefits" :key="i"><AdsIcon name="i-lucide-check" />{{ b }}</li>
              </ul>
              <p v-else class="ghost">{{ T.noteNoBenefits }}</p>
            </section>

            <section v-else-if="type === 'specs'" class="block">
              <h3>{{ T.specs }}</h3>
              <dl v-if="specs.length" class="specs"><template v-for="(s, i) in specs" :key="i"><dt>{{ s.label }}</dt><dd>{{ s.value }}</dd></template></dl>
              <p v-else class="ghost">{{ T.noteNoSpecs }}</p>
            </section>

            <section v-else-if="type === 'howItWorks'" class="block">
              <h3>{{ T.how }}</h3>
              <ol class="steps">
                <li v-for="(x, i) in T.howSteps" :key="i"><b>{{ i + 1 }}</b>{{ x }}</li>
              </ol>
            </section>

            <section v-else-if="type === 'testimonials'" class="block">
              <h3>{{ T.reviews }}</h3>
              <p class="ghost" dir="ltr">Shows the product’s real approved reviews on the live page. A funnel with none omits this section.</p>
            </section>

            <section v-else-if="type === 'guarantee'" class="guarantee">
              <span><AdsIcon name="i-lucide-truck" />{{ T.trust[0] }}</span>
              <span><AdsIcon name="i-lucide-eye" />{{ T.trust[1] }}</span>
              <span><AdsIcon name="i-lucide-arrow-left" />{{ T.trust[2] }}</span>
            </section>

            <section v-else-if="type === 'faq'" class="block">
              <h3>{{ T.questions }}</h3>
              <template v-if="faqs.length"><div v-for="(f, i) in faqs" :key="i" class="faq"><b>{{ f.question }}</b><span>{{ f.answer }}</span></div></template>
              <p v-else class="ghost">{{ T.noteNoFaq }}</p>
            </section>
          </template>

          <section class="closing">
            <b>{{ headline }}</b>
            <span class="btn-cta"><AdsIcon name="i-lucide-arrow-right" />{{ settings.ctaLabel }}</span>
          </section>
        </div>
      </div>

      <!-- Pinned order bar: always present -->
      <div class="sticky">
        <span v-if="settings.showPrice" class="sp"><small>{{ T.total }}</small><b>{{ fmt(total) }}</b></span>
        <span class="btn-cta"><AdsIcon name="i-lucide-arrow-right" />{{ settings.ctaLabel }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.device { --a: #1f5f5b; --s: #e6ede9; margin: 0 auto; width: 100%; color: var(--pine); background: var(--white); display: flex; flex-direction: column; overflow: hidden; }
.device.desktop { border: 1px solid var(--line); border-radius: var(--r-lg); }
.device.mobile { max-width: 390px; border: 9px solid var(--pine); border-radius: 36px; box-shadow: 0 10px 30px rgba(14, 41, 40, .18); }
.notch { height: 22px; background: var(--white); display: flex; justify-content: center; align-items: center; flex-shrink: 0; }
.notch span { width: 74px; height: 7px; border-radius: 4px; background: var(--pine); opacity: .85; }
.chrome { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: var(--ivory); border-bottom: 1px solid var(--line-soft); flex-shrink: 0; }
.chrome i { width: 9px; height: 9px; border-radius: 50%; background: var(--line); }
.chrome span { margin-inline-start: 8px; flex: 1; font-size: 11px; color: var(--text-2); background: var(--white); border-radius: 4px; padding: 2px 8px; }
.scroller { overflow-y: auto; position: relative; }
.desktop .scroller { max-height: 760px; }
.mobile .scroller { height: 680px; scrollbar-width: none; }
.mobile .scroller::-webkit-scrollbar { display: none; }
.urgency { background: var(--a); color: #fff; text-align: center; font-weight: 600; font-size: 12.5px; padding: 8px 14px; display: flex; align-items: center; justify-content: center; gap: 6px; position: sticky; top: 0; z-index: 3; }
.urgency svg { width: 14px; height: 14px; flex-shrink: 0; }
.page { display: flex; flex-direction: column; font-size: 13px; line-height: 1.5; }

/* Backbone */
.top { display: flex; flex-direction: column; gap: 14px; padding: 12px 14px 18px; background: linear-gradient(180deg, var(--s), var(--white) 55%); }
.desktop .top { padding: 20px 24px; gap: 16px; }
.photos { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.main { position: relative; aspect-ratio: 1 / 1; width: 100%; border-radius: 14px; background: var(--white); border: 1px solid var(--line-soft); display: flex; align-items: center; justify-content: center; overflow: hidden; color: var(--line); }
.desktop .main { max-height: 420px; }
.main img { width: 100%; height: 100%; object-fit: cover; }
.main > svg { width: 44px; height: 44px; }
.cod-badge { position: absolute; top: 10px; inset-inline-start: 10px; background: var(--a); color: #fff; font-size: 11px; font-weight: 600; padding: 4px 9px; border-radius: 999px; display: inline-flex; align-items: center; gap: 5px; }
.cod-badge svg { width: 12px; height: 12px; }
.count { position: absolute; bottom: 10px; inset-inline-end: 10px; background: rgba(14, 41, 40, .65); color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 999px; }
.dots { display: flex; justify-content: center; gap: 6px; }
.dots button { width: 7px; height: 7px; padding: 0; border: 0; border-radius: 50%; background: var(--line); cursor: pointer; }
.dots button.on { background: var(--a); width: 18px; border-radius: 4px; }
.strip { display: flex; gap: 6px; overflow-x: auto; }
.strip button { flex: 0 0 56px; height: 56px; padding: 0; border: 2px solid transparent; border-radius: var(--r); background: none; overflow: hidden; cursor: pointer; opacity: .7; }
.strip button.on { border-color: var(--a); opacity: 1; }
.strip img { width: 100%; height: 100%; object-fit: cover; display: block; }
.buy { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.title { display: flex; flex-direction: column; gap: 6px; }
h2 { font-size: 21px; line-height: 1.25; margin: 0; letter-spacing: -.01em; }
.sub { margin: 0; color: var(--text-2); font-size: 14px; }
.price-row { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; }
.price { font-size: 26px; font-weight: 800; color: var(--a); line-height: 1.1; }
.from { font-size: 12px; color: var(--text-2); }
.stock { margin: 0; display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: #8a3a26; background: #f5e3dd; padding: 5px 10px; border-radius: 999px; align-self: flex-start; }
.stock i { width: 7px; height: 7px; border-radius: 50%; background: #b4533a; }
.quick { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.quick li { display: flex; gap: 8px; align-items: flex-start; font-size: 13.5px; font-weight: 500; }
.quick svg { width: 17px; height: 17px; color: var(--a); flex-shrink: 0; margin-top: 1px; }

/* Order form */
.order { background: var(--white); border: 1.5px solid var(--a); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 6px 18px rgba(14, 41, 40, .08); }
.form-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.form-head b { font-size: 17px; }
.form-head span { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--a); font-weight: 600; }
.form-head svg { width: 14px; height: 14px; }
fieldset { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
legend { font-size: 12px; color: var(--text-2); padding: 0; margin-bottom: 6px; }
.offer { position: relative; display: flex; align-items: center; gap: 10px; border: 1.5px solid var(--line); border-radius: 12px; padding: 12px; min-height: 56px; cursor: pointer; background: var(--white); }
.offer.on { border-color: var(--a); background: var(--s); }
.offer input { position: absolute; opacity: 0; pointer-events: none; }
.radio { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--line); flex-shrink: 0; display: inline-block; }
.offer.on .radio { border-color: var(--a); background: radial-gradient(circle, var(--a) 0 45%, transparent 50%); }
.offer .grow { display: flex; flex-direction: column; line-height: 1.3; min-width: 0; }
.offer b { font-size: 14px; }
.offer small { color: var(--text-2); font-size: 11.5px; }
.offer small em { font-style: normal; color: var(--a); font-weight: 700; }
.amt { font-weight: 800; font-size: 15px; white-space: nowrap; }
.ribbon { position: absolute; top: -9px; inset-inline-end: 10px; background: var(--brass); color: #fff; font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 999px; letter-spacing: .02em; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field > span { font-size: 12px; color: var(--text-2); font-weight: 500; }
.field i { height: 48px; border: 1.5px solid var(--line); border-radius: 12px; background: var(--white); display: flex; align-items: center; gap: 8px; padding: 0 12px; color: var(--text-2); font-style: normal; }
.field i.tall { height: 72px; }
.field i svg { width: 16px; height: 16px; flex-shrink: 0; }
.field i em { font-style: normal; font-size: 13px; opacity: .6; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.seg { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: var(--ivory); border-radius: 12px; padding: 4px; }
.seg span { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; border-radius: 9px; font-weight: 600; font-size: 12.5px; color: var(--text-2); }
.seg span.on { background: var(--white); color: var(--a); box-shadow: 0 1px 3px rgba(14, 41, 40, .15); }
.seg svg { width: 15px; height: 15px; }
.sum { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: var(--text-2); padding-top: 8px; border-top: 1px dashed var(--line); }
.sum > div { display: flex; justify-content: space-between; }
.sum .grand { color: var(--pine); font-size: 15px; font-weight: 600; padding-top: 4px; }
.sum .grand b { color: var(--a); font-size: 20px; font-weight: 800; }
.btn-cta { display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--a); color: #fff; font-weight: 700; font-size: 16px; min-height: 54px; padding: 0 18px; border-radius: 14px; text-align: center; box-shadow: 0 4px 0 rgba(0, 0, 0, .18); }
.btn-cta svg { width: 18px; height: 18px; }
.trust { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.trust li { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; font-size: 11px; line-height: 1.25; color: var(--text-2); font-weight: 500; }
.trust svg { width: 18px; height: 18px; color: var(--a); }
.safe { text-align: center; color: var(--text-2); font-size: 11px; }

/* Layouts */
.desktop.layout-split .top { flex-direction: row; align-items: flex-start; gap: 24px; }
.desktop.layout-split .photos { flex: 1 1 50%; }
.desktop.layout-split .buy { flex: 1 1 50%; }
.layout-compact .main { aspect-ratio: 4 / 3; }
.layout-compact .top { gap: 10px; }
.layout-compact .order { gap: 8px; }
.layout-compact h2 { font-size: 19px; }
.layout-compact .quick { display: none; }

/* Details */
.details { display: flex; flex-direction: column; }
.details > * { border-top: 1px solid var(--row-line); }
.block { padding: 18px 14px; }
.desktop .block { padding: 20px 24px; }
h3 { font-size: 16px; margin: 0 0 10px; display: flex; align-items: center; gap: 8px; }
.tag { font-style: normal; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; background: var(--warn-bg); color: var(--warn-fg); border-radius: 3px; padding: 2px 6px; }
.text { margin: 0; white-space: pre-line; font-size: 14px; }
.ghost { margin: 0; color: var(--text-2); font-style: italic; }
.checks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; font-size: 14px; }
.checks li { display: flex; gap: 8px; align-items: flex-start; }
.checks svg { width: 17px; height: 17px; color: var(--a); flex-shrink: 0; margin-top: 2px; }
.specs { display: grid; grid-template-columns: max-content 1fr; gap: 6px 18px; margin: 0; font-size: 13.5px; }
.specs dt { color: var(--text-2); }
.specs dd { margin: 0; font-weight: 500; }
.steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.steps li { background: var(--s); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
.steps b { width: 24px; height: 24px; border-radius: 6px; background: var(--a); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; }
.mobile .steps, .mobile .quotes { grid-template-columns: 1fr; }
.mobile .steps li { flex-direction: row; align-items: center; gap: 10px; }
.quotes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
blockquote { margin: 0; background: var(--ivory); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
.stars { color: var(--brass); letter-spacing: 2px; }
cite { font-size: 11px; color: var(--text-2); font-style: normal; }
.guarantee { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 18px; padding: 16px 14px; background: var(--s); font-weight: 600; font-size: 12.5px; }
.guarantee span { display: inline-flex; align-items: center; gap: 6px; }
.guarantee svg { width: 16px; height: 16px; color: var(--a); }
.faq { display: flex; flex-direction: column; gap: 2px; padding: 11px 0; border-top: 1px solid var(--row-line); font-size: 13.5px; }
.faq:first-of-type { border-top: 0; padding-top: 0; }
.faq span { color: var(--text-2); }
.long { width: 100%; max-height: 560px; object-fit: cover; object-position: top; display: block; }
.long-ph { width: 100%; min-height: 220px; display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: center; color: var(--text-2); background: var(--hover); }
.long-ph svg { width: 28px; height: 28px; }
.closing { display: flex; flex-direction: column; gap: 12px; padding: 20px 14px 24px; text-align: center; background: var(--s); font-size: 16px; }
.mobile .closing { padding-bottom: 96px; }

/* Pinned order bar (phones) */
.sticky { position: sticky; bottom: 0; z-index: 3; display: flex; align-items: center; gap: 12px; padding: 10px 12px calc(10px + 4px); background: var(--white); border-top: 1px solid var(--line); box-shadow: 0 -6px 16px rgba(14, 41, 40, .1); }
.sticky .sp { display: flex; flex-direction: column; line-height: 1.1; }
.sticky small { font-size: 10.5px; color: var(--text-2); }
.sticky b { color: var(--a); font-size: 17px; font-weight: 800; white-space: nowrap; }
.sticky .btn-cta { flex: 1; min-height: 48px; font-size: 15px; }
</style>
