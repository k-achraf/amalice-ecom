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

// Live preview of a funnel's landing page. It mirrors the funnels site (apps/funnels/src/render.ts +
// styles.ts): same structure, same spacing and type scale, same Arabic copy, so what the admin
// sees is what visitors get. Every page has the same backbone: photos, title + price, the order form
// (offers, short form), then the rest of the page. Reviews come from the product's real approved
// reviews on the live page, so none are drawn here.
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

// Same contrast rules as the site: dark button text on light accents, darkened accent for text on white.
function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (hex: string) => 1.05 / (lum(hex) + 0.05)
const vars = computed(() => {
  const solid = accent.value.solid
  let text = solid
  for (let i = 0; i < 12 && contrast(text) < 4.5; i++) {
    const n = parseInt(text.slice(1), 16)
    const d = (v: number) => Math.round(v * 0.9)
    text = '#' + ((d((n >> 16) & 255) << 16) | (d((n >> 8) & 255) << 8) | d(n & 255)).toString(16).padStart(6, '0')
  }
  return { '--a': solid, '--s': accent.value.soft, '--on': contrast(solid) >= 4.5 ? '#ffffff' : '#1c2022', '--at': text }
})

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

// Offers as the form shows them; the one that saves the most is flagged.
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
const quickBenefits = computed(() => (props.settings.quickBenefits && !compact.value ? props.product.keyBenefits.slice(0, 3) : []))

const plainDescription = computed(() => {
  const html = props.product.description
  if (!html) return ''
  const text = new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? ''
  return text.length > 420 ? `${text.slice(0, 420)}…` : text
})
</script>

<template>
  <div class="device" :class="[device, `layout-${layout}`, `tpl-${settings.templateId}`]" :style="vars">
    <div v-if="mobile" class="notch" aria-hidden="true"><span /></div>
    <div v-else class="chrome" aria-hidden="true"><i /><i /><i /><span>/f/…</span></div>

    <div class="scroller" :dir="T.dir" :lang="T.lang">
      <div v-if="settings.urgency" class="urg">{{ settings.urgencyText?.trim() || T.defaultUrgency }}</div>

      <main class="wrap">
        <div class="top">
          <!-- 1. Photos -->
          <div class="gal">
            <div class="main">
              <img v-if="photos[active]" :src="photos[active]" alt="">
              <AdsIcon v-else name="i-lucide-image" class="ph" />
            </div>
            <div v-if="photos.length > 1" class="dots"><span><i v-for="(u, i) in photos.slice(0, 8)" :key="i" :class="{ on: i === active }" @click="active = i" /></span></div>
          </div>

          <div class="buy">
            <!-- 2. Title + price -->
            <div>
              <h1>{{ headline }}</h1>
              <p v-if="settings.subheadline" class="sub">{{ settings.subheadline }}</p>
              <div v-if="settings.showPrice" class="price">{{ fmt(product.priceCents) }}</div>
              <p v-if="lowStock" class="stock"><i />{{ T.onlyLeft(lowStock) }}</p>
            </div>
            <ul v-if="quickBenefits.length" class="quick">
              <li v-for="(b, i) in quickBenefits" :key="i"><AdsIcon name="i-lucide-check" />{{ b }}</li>
            </ul>

            <!-- 3. Order form -->
            <form class="order" @submit.prevent>
              <div class="fh"><h2>{{ T.orderNow }}</h2><p>{{ T.payWhenArrives }}</p></div>

              <fieldset v-if="showOffers">
                <legend>{{ T.chooseOffer }}</legend>
                <label v-for="o in offers" :key="o.key" class="offer" :class="{ on: chosen === o.key }">
                  <input v-model="chosen" type="radio" name="offer" :value="o.key">
                  <i class="rd" />
                  <span class="g">
                    <b>{{ o.label }}<span v-if="o.best" class="tg">{{ T.bestValue }}</span></b>
                    <small>{{ o.note }}<template v-if="o.save"> · <em>{{ T.save(fmt(o.save)) }}</em></template></small>
                  </span>
                  <span class="am">{{ fmt(o.total) }}</span>
                </label>
              </fieldset>

              <div class="fl"><span>{{ T.fullName }}</span><i class="in" /></div>
              <div class="fl"><span>{{ T.phone }}</span><i class="in"><em>{{ T.phoneHint }}</em></i></div>
              <div class="two">
                <div class="fl"><span>{{ T.wilaya }}</span><i class="in sel">{{ T.chooseWilaya }}</i></div>
                <div class="fl"><span>{{ T.commune }}</span><i class="in sel off">{{ T.chooseCommune }}</i></div>
              </div>
              <div v-if="settings.addressField !== 'hidden'" class="fl"><span>{{ T.address }}<template v-if="settings.addressField === 'optional'"> {{ T.optional }}</template></span><i class="in" /></div>
              <div class="fl">
                <span>{{ T.delivery }}</span>
                <div class="opts"><span class="opt"><i class="rd" />{{ T.homeDelivery }}</span><span class="opt"><i class="rd" />{{ T.deskDelivery }}</span></div>
              </div>
              <div v-if="settings.showNotes" class="fl"><span>{{ T.notes }}</span><i class="in tall" /></div>

              <div v-if="settings.showPrice" class="sum">
                <div><span>{{ T.product }}</span><span>{{ fmt(total) }}</span></div>
                <div><span>{{ T.delivery }}</span><span>{{ T.deliveryByWilaya }}</span></div>
                <div class="gr"><span>{{ T.toPay }}</span><b>{{ fmt(total) }}</b></div>
              </div>
              <span class="cta">{{ settings.ctaLabel }}</span>
              <ul v-if="settings.trustBadges" class="trust">
                <li><AdsIcon name="i-lucide-truck" />{{ T.trust[0] }}</li>
                <li><AdsIcon name="i-lucide-eye" />{{ T.trust[1] }}</li>
                <li><AdsIcon name="i-lucide-arrow-left" />{{ T.trust[2] }}</li>
              </ul>
              <p class="safe">{{ T.safeNote }}</p>
            </form>
          </div>
        </div>

        <!-- 4. The rest of the page -->
        <div class="det">
          <template v-if="isImage">
            <img v-if="generatedImageUrl" :src="resolveImageUrl(generatedImageUrl)" class="long" alt="">
            <div v-else class="long-ph" dir="ltr"><AdsIcon name="i-lucide-image" /><span>Choose a generated page to show here</span></div>
          </template>

          <template v-for="type in sections" :key="type">
            <section v-if="type === 'description'">
              <h2>{{ T.about }}</h2>
              <p v-if="plainDescription" class="txt">{{ plainDescription }}</p>
              <p v-else class="ghost">{{ T.noteNoDescription }}</p>
            </section>

            <section v-else-if="type === 'benefits'">
              <h2>{{ T.why }}</h2>
              <ul v-if="product.keyBenefits.length" class="checks">
                <li v-for="(b, i) in product.keyBenefits" :key="i"><AdsIcon name="i-lucide-check" />{{ b }}</li>
              </ul>
              <p v-else class="ghost">{{ T.noteNoBenefits }}</p>
            </section>

            <section v-else-if="type === 'specs'">
              <h2>{{ T.specs }}</h2>
              <dl v-if="product.specifications.length" class="specs"><div v-for="(s, i) in product.specifications.slice(0, 12)" :key="i"><dt>{{ s.label }}</dt><dd>{{ s.value }}</dd></div></dl>
              <p v-else class="ghost">{{ T.noteNoSpecs }}</p>
            </section>

            <section v-else-if="type === 'testimonials'">
              <h2>{{ T.reviews }}</h2>
              <p class="ghost" dir="ltr">Shows the product’s real approved reviews on the live page. The section is left out when there are none.</p>
            </section>

            <section v-else-if="type === 'faq'" class="faqs">
              <h2>{{ T.questions }}</h2>
              <template v-if="product.faqs.length">
                <details v-for="(f, i) in product.faqs.slice(0, 4)" :key="i"><summary>{{ f.question }}</summary><p>{{ f.answer }}</p></details>
              </template>
              <p v-else class="ghost">{{ T.noteNoFaq }}</p>
            </section>
          </template>
        </div>
      </main>


      <!-- Pinned order bar: always present -->
      <div class="bar">
        <div class="bi">
          <div class="t"><small>{{ T.total }}</small><b>{{ fmt(total) }}</b></div>
          <span class="cta">{{ settings.ctaLabel }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Mirrors apps/funnels/src/styles.ts: 4px grid; type 12/13/14/15/16/18/20/24; radius 8 (controls), 12 (cards), 4 (tags). */
.device { --ink: #1c2022; --ink2: #596164; --ink3: #8a9295; --line: #e4e7e8; --line2: #cbd1d3; --soft: #f6f7f7; --bad: #b42318; --g: 16px; margin: 0 auto; width: 100%; background: #fff; color: var(--ink); display: flex; flex-direction: column; overflow: hidden; font: 400 15px/1.6 system-ui, -apple-system, 'Segoe UI', 'Noto Sans Arabic', Tahoma, Arial, sans-serif; font-variant-numeric: tabular-nums; }
.device.desktop { border: 1px solid var(--line); border-radius: var(--r-lg); }
.device.mobile { max-width: 390px; border: 8px solid #1c2022; border-radius: 32px; }
.device * { box-sizing: border-box; }
.notch { height: 20px; background: #fff; display: flex; justify-content: center; align-items: center; flex-shrink: 0; }
.notch span { width: 64px; height: 6px; border-radius: 3px; background: #1c2022; }
.chrome { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: var(--soft); border-bottom: 1px solid var(--line); flex-shrink: 0; }
.chrome i { width: 9px; height: 9px; border-radius: 50%; background: var(--line2); }
.chrome span { margin-inline-start: 8px; flex: 1; font-size: 11px; color: var(--ink2); background: #fff; border-radius: 4px; padding: 2px 8px; }
.scroller { overflow-y: auto; position: relative; }
.desktop .scroller { max-height: 760px; }
.mobile .scroller { height: 680px; scrollbar-width: none; }
.mobile .scroller::-webkit-scrollbar { display: none; }
b { font-weight: 700; }
h1, h2, p, ul, ol, dl, dd, fieldset { margin: 0; }
ul, ol { padding: 0; list-style: none; }
fieldset { border: 0; padding: 0; min-width: 0; display: grid; gap: 8px; }
svg { width: 16px; height: 16px; flex: none; stroke-width: 1.75; }

.urg { display: flex; align-items: center; justify-content: center; min-height: 36px; padding: 6px var(--g); background: var(--a); color: var(--on); font-size: 13px; font-weight: 500; text-align: center; }
.hd { display: flex; align-items: center; justify-content: center; height: 48px; border-bottom: 1px solid var(--line); font-size: 15px; font-weight: 700; }
.wrap { max-width: 560px; margin: 0 auto; }
.top { display: grid; }
.gal { position: relative; min-width: 0; }
.main { aspect-ratio: 1 / 1; background: var(--soft); display: flex; align-items: center; justify-content: center; overflow: hidden; color: var(--line2); }
.main img { width: 100%; height: 100%; object-fit: cover; }
.main .ph { width: 40px; height: 40px; }
.dots { position: absolute; inset-inline: 0; bottom: 12px; display: flex; justify-content: center; }
.dots span { display: flex; gap: 6px; padding: 6px 8px; border-radius: 99px; background: rgba(0, 0, 0, .34); }
.dots i { width: 6px; height: 6px; border-radius: 50%; background: rgba(255, 255, 255, .55); cursor: pointer; }
.dots i.on { background: #fff; }
.buy { display: grid; gap: 24px; padding: 16px var(--g) 24px; align-content: start; min-width: 0; }
h1 { font-size: 20px; line-height: 1.45; font-weight: 700; }
.sub { margin-top: 4px; font-size: 14px; color: var(--ink2); }
.price { margin-top: 12px; font-size: 24px; line-height: 1.2; font-weight: 700; }
.stock { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 13px; font-weight: 500; color: var(--bad); }
.stock i { width: 6px; height: 6px; border-radius: 50%; background: var(--bad); }
.quick { display: grid; gap: 8px; font-size: 14px; }
.quick li, .checks li { display: flex; gap: 8px; align-items: flex-start; }
.quick svg, .checks svg { margin-top: 4px; color: var(--at); }

.order { display: grid; gap: 16px; padding: 16px; border: 1px solid var(--line2); border-radius: 12px; }
.fh h2 { font-size: 18px; line-height: 1.4; font-weight: 700; }
.fh p { margin-top: 2px; font-size: 13px; color: var(--ink2); }
legend { padding: 0; margin-bottom: 8px; font-size: 14px; font-weight: 500; }
.offer, .opt { position: relative; display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 12px 16px; border: 1px solid var(--line2); border-radius: 8px; background: #fff; }
.opt { min-height: 48px; font-size: 14px; color: var(--ink3); background: var(--soft); }
.opts { display: grid; gap: 8px; }
.offer input { position: absolute; opacity: 0; pointer-events: none; }
.rd { width: 18px; height: 18px; flex: none; border: 1.5px solid #9ba3a6; border-radius: 50%; display: inline-block; }
.offer.on { border-color: var(--a); box-shadow: 0 0 0 1px var(--a); background: var(--s); }
.offer.on .rd { border-color: var(--a); background: radial-gradient(circle, var(--a) 0 38%, transparent 42%); }
.offer .g { flex: 1; min-width: 0; display: grid; line-height: 1.45; }
.offer b { font-size: 15px; font-weight: 500; }
.offer small { font-size: 13px; color: var(--ink2); }
.offer em { font-style: normal; font-weight: 500; color: var(--at); }
.tg { display: inline-block; margin-inline-start: 8px; padding: 0 6px; border-radius: 4px; background: var(--a); color: var(--on); font-size: 11px; font-weight: 700; line-height: 18px; vertical-align: 1px; }
.am { font-size: 15px; font-weight: 700; white-space: nowrap; }
.fl { display: grid; gap: 6px; }
.fl > span { font-size: 14px; font-weight: 500; }
.in { display: flex; align-items: center; height: 48px; padding: 0 12px; border: 1px solid var(--line2); border-radius: 8px; background: #fff; font-size: 16px; font-style: normal; color: var(--ink3); }
.in em { font-style: normal; font-size: 15px; }
.in.tall { height: 80px; }
.in.sel { justify-content: space-between; color: var(--ink2); }
.in.off { background: var(--soft); color: var(--ink3); }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.sum { display: grid; gap: 8px; padding: 12px 16px; border-radius: 8px; background: var(--soft); font-size: 14px; color: var(--ink2); }
.sum > div { display: flex; justify-content: space-between; gap: 12px; }
.sum .gr { margin-top: 4px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 16px; font-weight: 700; color: var(--ink); }
.cta { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 52px; padding: 0 24px; border-radius: 8px; background: var(--a); color: var(--on); font-size: 16px; font-weight: 700; line-height: 1.3; text-align: center; }
.trust { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 16px; font-size: 13px; color: var(--ink2); }
.trust li { display: flex; align-items: center; gap: 6px; }
.safe { font-size: 13px; color: var(--ink3); text-align: center; }

.det > * { padding: 24px var(--g); border-top: 1px solid var(--line); }
.det h2 { margin-bottom: 12px; font-size: 18px; line-height: 1.4; font-weight: 700; }
.txt { font-size: 15px; line-height: 1.75; white-space: pre-line; }
.ghost { color: var(--ink3); font-style: italic; font-size: 14px; }
.checks { display: grid; gap: 12px; font-size: 15px; }
.specs { display: block; font-size: 14px; }
.specs > div { display: grid; grid-template-columns: 2fr 3fr; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.specs > div:first-child { padding-top: 0; }
.specs > div:last-child { border: 0; padding-bottom: 0; }
.specs dt { color: var(--ink2); }
.specs dd { font-weight: 500; }
.how { display: grid; gap: 12px; font-size: 15px; }
.how li { display: flex; gap: 12px; }
.how b { flex: none; width: 24px; height: 24px; border: 1px solid var(--at); border-radius: 50%; color: var(--at); font-size: 13px; line-height: 22px; text-align: center; }
.gt { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center; font-size: 13px; color: var(--ink2); }
.gt span { display: grid; justify-items: center; gap: 8px; }
.gt svg { width: 20px; height: 20px; color: var(--ink2); }
.det > .faqs { padding-bottom: 8px; }
details { border-bottom: 1px solid var(--line); }
details:last-of-type { border: 0; }
summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 0; font-size: 15px; font-weight: 500; cursor: pointer; list-style: none; }
summary::-webkit-details-marker { display: none; }
details p { padding-bottom: 16px; font-size: 14px; color: var(--ink2); }
.long { width: 100%; max-height: 560px; object-fit: cover; object-position: top; display: block; padding: 0 !important; }
.long-ph { min-height: 220px; display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: center; color: var(--ink3); background: var(--soft); }
.long-ph svg { width: 28px; height: 28px; }
.ft { padding: 24px var(--g) 88px; border-top: 1px solid var(--line); font-size: 13px; color: var(--ink3); text-align: center; }

.bar { position: sticky; bottom: 0; z-index: 3; background: #fff; border-top: 1px solid var(--line2); padding: 12px var(--g); }
.bi { display: flex; align-items: center; gap: 16px; max-width: 560px; margin: 0 auto; }
.bi .t { display: grid; line-height: 1.25; }
.bi .t small { font-size: 12px; color: var(--ink2); }
.bi .t b { font-size: 16px; font-weight: 700; white-space: nowrap; }
.bi .cta { flex: 1; min-height: 48px; }

/* wide screens */
.desktop { --g: 24px; }
.desktop h1 { font-size: 24px; }
.desktop .top { padding: 32px var(--g); }
.desktop .gal { border-radius: 12px; overflow: hidden; border: 1px solid var(--line); }
.desktop .buy { padding: 24px 0 0; }
.desktop.layout-split .wrap { max-width: 1000px; }
.desktop.layout-split .top { grid-template-columns: 1fr 1fr; gap: 16px 32px; align-items: start; }
.desktop.layout-split .buy { padding: 0; }
.desktop.layout-split .det { max-width: 720px; margin-inline: auto; }
.tpl-compact .slide { aspect-ratio: 16 / 9; }
.tpl-compact .buy { gap: 12px; padding-top: 12px; }
.tpl-compact h1 { font-size: 18px; }
.tpl-compact .price { margin-top: 8px; font-size: 20px; }
.tpl-compact .order { padding: 12px; gap: 12px; }
.tpl-bold .slide { aspect-ratio: 4 / 5; }
.tpl-bold .buy { text-align: center; }
.tpl-bold h1 { font-size: 24px; line-height: 1.35; }
.tpl-bold .price { font-size: 30px; color: var(--at); }
.tpl-bold .stock, .tpl-bold .rt { justify-content: center; }
.tpl-bold .quick { text-align: start; }
.tpl-bold .order { border: 2px solid var(--a); background: var(--s); text-align: start; }
.tpl-bold .cta { min-height: 58px; font-size: 18px; }
.tpl-bold .det h2 { color: var(--at); }
.tpl-bold .urg { min-height: 44px; font-size: 14px; font-weight: 700; }
.tpl-side-by-side .order { background: var(--soft); border-color: var(--line); }
.tpl-side-by-side .det h2 { padding-inline-start: 12px; border-inline-start: 3px solid var(--a); }
</style>
