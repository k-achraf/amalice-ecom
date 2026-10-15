import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { brotliCompressSync, gzipSync, constants as zc } from 'node:zlib'
import {
  FUNNEL_COPY_AR as T,
  LANDING_ACCENT_HEX,
  formatDa,
  getLandingTemplate,
  offerPriceCents,
  offerTotalQuantity,
  unitsLabel,
  type PublicFunnel,
  type PublicFunnelOffer,
  type PublicFunnelStep
} from '@amalice/shared'
import { config } from './config'
import { CSS } from './styles'
import { esc, escJson, imgSrcset, imgUrl, plainText, sanitizeHtml } from './util'

export interface Rendered {
  etag: string
  identity: Buffer
  br: Buffer
  gzip: Buffer
}

// Client script: plain JS shipped inline (no bundler, no framework). Comment lines and indentation are
// stripped; nothing else is rewritten.
const CLIENT_JS = readFileSync(join(__dirname, '..', 'src', 'client.js'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('//'))
  .join('\n')

const ICONS: Record<string, string> = {
  check: '<path d="M20 6 9 17l-5-5"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  arrow: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'
}
const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(ICONS)
  .map(([id, p]) => `<symbol id="i-${id}" viewBox="0 0 24 24">${p}</symbol>`)
  .join('')}</svg>`
const ico = (n: keyof typeof ICONS) => `<svg aria-hidden="true"><use href="#i-${n}"/></svg>`

const PIXEL_META = /^[0-9]{5,20}$/
const PIXEL_TIKTOK = /^[A-Za-z0-9]{6,40}$/

export function renderPage(f: PublicFunnel): Rendered {
  const html = build(f)
  const identity = Buffer.from(html, 'utf8')
  return {
    etag: `"${createHash('sha1').update(identity).digest('base64url').slice(0, 20)}"`,
    identity,
    br: brotliCompressSync(identity, { params: { [zc.BROTLI_PARAM_QUALITY]: 9, [zc.BROTLI_PARAM_SIZE_HINT]: identity.length } }),
    gzip: gzipSync(identity, { level: 9 })
  }
}

function build(f: PublicFunnel): string {
  const s = f.landing
  const p = f.product
  const tpl = getLandingTemplate(s.templateId)
  const layout = tpl?.layout ?? 'stacked'
  const accent = LANDING_ACCENT_HEX[s.accent]
  const headline = s.headline?.trim() || p.name

  // ---- variants, stock, price ----
  const variants = p.variants
  const defaultVariant = variants.find((v) => v.stockQuantity > 0) ?? variants[0]
  const soldOut = variants.length ? variants.every((v) => v.stockQuantity <= 0) : p.stockQuantity <= 0
  const unit = defaultVariant?.priceCents ?? p.priceCents
  const stockForNotice = variants.length ? variants.reduce((n, v) => n + v.stockQuantity, 0) : p.stockQuantity
  const lowStock = s.showStock && stockForNotice > 0 && stockForNotice <= Math.max(p.lowStockThreshold, 10) ? stockForNotice : null

  // ---- offers ----
  const offers = p.offers
  const showOffers = offers.length > 0 && (s.showOffers || p.requireOfferSelection)
  const offerRows = offers.map((o) => {
    const qty = offerTotalQuantity(o)
    const total = offerPriceCents(o, unit)
    return { o, qty, total, save: Math.max(0, unit * qty - total) }
  })
  const best = offerRows.reduce<(typeof offerRows)[number] | null>((a, r) => (r.save > 0 && (!a || r.save > a.save) ? r : a), null)
  const firstKey = p.requireOfferSelection ? (s.preselectBestOffer && best ? best.o.id : offers[0]?.id) : s.preselectBestOffer && best ? best.o.id : 'one'
  const chosenKey = showOffers ? firstKey : p.requireOfferSelection && offers[0] ? offers[0].id : 'one'
  const chosenRow = offerRows.find((r) => r.o.id === chosenKey)
  const subtotal = chosenRow ? chosenRow.total : unit

  const offerLabel = (o: PublicFunnelOffer) =>
    o.type === 'FixedBundlePrice' ? T.buyX(o.requiredQuantity) : o.type === 'BuyXGetYFree' ? T.buyXGetY(o.requiredQuantity, o.freeQuantity) : T.buyXFreeShipping(o.requiredQuantity)

  // ---- steps ----
  const bumpStep = f.steps.find((x) => x.type === 'OrderBump' && x.offerProduct)
  const formIdx = f.steps.findIndex((x) => x.type === 'OrderForm')
  const after = f.steps.slice(formIdx === -1 ? 0 : formIdx + 1).filter((x) => (x.type === 'Upsell' || x.type === 'Downsell') && x.offerProduct)

  // ---- photos ----
  const photos = p.images.map((i) => ({ url: i.url, alt: i.altText ?? p.name }))
  if (!photos.length && p.imageUrl) photos.push({ url: p.imageUrl, alt: p.name })
  const lcp = photos[0]
  const SIZES = '(min-width:900px) 520px, 100vw'

  const slides = photos
    .slice(0, 8)
    .map((ph, i) => {
      const set = imgSrcset(ph.url)
      return `<div class="slide"><img src="${esc(imgUrl(ph.url, 800))}"${set ? ` srcset="${esc(set)}" sizes="${SIZES}"` : ''} width="800" height="800" alt="${esc(ph.alt)}" decoding="async"${i === 0 ? ' fetchpriority="high"' : ' loading="lazy"'}></div>`
    })
    .join('')

  // ---- form pieces ----
  const variantHtml = variants.length
    ? `<fieldset><legend>${T.variant}</legend><div class="pills">${variants
        .map((v) => `<label class="pill"><input type="radio" name="variant" value="${esc(v.id)}"${v.id === defaultVariant?.id ? ' checked' : ''}${v.stockQuantity <= 0 ? ' disabled' : ''}><span>${esc(v.label)}</span></label>`)
        .join('')}</div></fieldset>`
    : ''

  const offersHtml = showOffers
    ? `<fieldset><legend>${T.chooseOffer}</legend><div class="offers">${[
        ...(p.requireOfferSelection ? [] : [{ key: 'one', label: T.singleUnit, note: T.singleItemNote, total: unit, save: 0, isBest: false }]),
        ...offerRows.map((r) => ({
          key: r.o.id,
          label: offerLabel(r.o),
          note: r.o.type === 'FreeShipping' ? T.freeShippingNote(unitsLabel(r.qty)) : unitsLabel(r.qty),
          total: r.total,
          save: r.save,
          isBest: best?.o.id === r.o.id
        }))
      ]
        .map(
          (o) =>
            `<label class="offer"><input type="radio" name="offer" value="${esc(o.key)}"${o.key === chosenKey ? ' checked' : ''}><i class="rd"></i><span class="g"><b>${esc(o.label)}</b><small>${esc(o.note)}${o.save ? ` · <em data-os="${esc(o.key)}">${esc(T.save(formatDa(o.save)))}</em>` : ''}</small></span><span class="am" data-ot="${esc(o.key)}">${formatDa(o.total)}</span>${o.isBest ? `<span class="rb">${T.bestValue}</span>` : ''}</label>`
        )
        .join('')}</div></fieldset>`
    : ''

  const bumpHtml = bumpStep?.offerProduct
    ? `<label class="bump"><input type="checkbox" name="bump" value="${esc(bumpStep.id)}">${
        bumpStep.offerProduct.imageUrl ? `<img src="${esc(imgUrl(bumpStep.offerProduct.imageUrl, 320))}" width="46" height="46" alt="" loading="lazy" decoding="async">` : ''
      }<span class="g"><b>${esc(bumpStep.headline || T.bump)}</b><span>${esc(bumpStep.offerProduct.name)}</span></span><span class="am">+${formatDa(bumpStep.offerProduct.priceCents)}</span></label>`
    : ''

  const addrLabel = `${T.address}${s.addressField === 'optional' ? ` ${T.optional}` : ''}`
  const field = (name: string, label: string, control: string, err: string) => `<div class="fl" data-f="${name}"><span>${label}</span>${control}<span class="em">${err}</span></div>`

  const form = `<form id="f" class="order" novalidate>
<div class="fh"><b>${T.orderNow}</b><span>${ico('shield')}${T.payWhenArrives}</span></div>
${variantHtml}${offersHtml}${bumpHtml}
${field('name', T.fullName, '<input class="in" name="name" autocomplete="name" required>', T.errName)}
${field('phone', T.phone, `<input class="in" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="${T.phoneHint}" dir="ltr" style="text-align:start" required>`, T.errPhone)}
<div class="two">
${field('wilaya', T.wilaya, `<select class="in" name="wilaya" autocomplete="off" required><option value="">${T.chooseWilaya}</option>${f.wilayas.map((w) => `<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('')}</select>`, T.errWilaya)}
${field('commune', T.commune, `<select class="in" name="commune" autocomplete="off" required disabled><option value="">${T.chooseCommune}</option></select>`, T.errCommune)}
</div>
${s.addressField === 'hidden' ? '' : field('address', addrLabel, '<input class="in" name="address" autocomplete="street-address">', T.errAddress)}
<div class="fl" data-f="ship"><div class="seg"><label><input type="radio" name="ship" value="Home" disabled><span data-sl="Home">${T.homeDelivery}</span></label><label><input type="radio" name="ship" value="Desk" disabled><span data-sl="Desk">${T.deskDelivery}</span></label></div><span class="em">${T.errDelivery}</span></div>
${s.showNotes ? `<div class="fl"><span>${T.notes}</span><textarea class="in" name="notes" maxlength="300"></textarea></div>` : ''}
${
  s.showPrice
    ? `<div class="sum"><div><span>${T.product}</span><span data-sub>${formatDa(subtotal)}</span></div><div><span>${T.delivery}</span><span data-ship>${T.deliveryByWilaya}</span></div><div class="gr"><span>${T.toPay}</span><b data-total>${formatDa(subtotal)}</b></div></div>`
    : ''
}
<div class="fe" id="fe" role="alert"></div>
<button class="cta" type="submit" id="sub">${ico('arrow')}<span>${esc(s.ctaLabel)}</span></button>
${s.trustBadges ? `<ul class="trust"><li>${ico('truck')}${T.trust[0]}</li><li>${ico('eye')}${T.trust[1]}</li><li>${ico('undo')}${T.trust[2]}</li></ul>` : ''}
<p class="safe">${T.safeNote}</p>
</form>`

  // ---- title block ----
  const quick = s.quickBenefits && layout !== 'compact' ? p.keyBenefits.slice(0, 3) : []
  const title = `<div><h1>${esc(headline)}</h1>${s.subheadline ? `<p class="sub">${esc(s.subheadline)}</p>` : ''}${
    s.showPrice ? `<div class="pr"><span class="price" data-unit>${formatDa(unit)}</span>${best ? `<span class="from">${T.lessPerUnit}</span>` : ''}</div>` : ''
  }${f.rating ? `<div class="rt"><span class="st">★</span><b>${f.rating.avg}</b><span>(${f.rating.count})</span></div>` : ''}${lowStock ? `<div class="stock"><i></i>${T.onlyLeft(lowStock)}</div>` : ''}</div>${
    quick.length ? `<ul class="quick">${quick.map((b) => `<li>${ico('check')}<span>${esc(b)}</span></li>`).join('')}</ul>` : ''
  }`

  const gallery = `<div class="gal"><div class="slides" id="sl">${slides || '<div class="slide"></div>'}</div><span class="badge">${ico('truck')}${T.payOnDelivery}</span>${
    photos.length > 1 ? `<span class="cnt" id="cnt">1/${Math.min(photos.length, 8)}</span><div class="dots" id="dots">${photos
      .slice(0, 8)
      .map((_, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`)
      .join('')}</div>` : ''
  }</div>`

  const buy = soldOut ? `${title}<div class="soldout">${T.outOfStock}</div>` : `${title}${form}`

  // ---- details ----
  const details: string[] = []
  if (layout === 'image' && f.generatedImageUrl) {
    details.push(`<img class="long" src="${esc(imgUrl(f.generatedImageUrl, 1080))}"${imgSrcset(f.generatedImageUrl, [640, 1080]) ? ` srcset="${esc(imgSrcset(f.generatedImageUrl, [640, 1080]))}" sizes="(min-width:900px) 640px,100vw"` : ''} alt="" loading="lazy" decoding="async">`)
  }
  for (const sec of s.sections) {
    if (!sec.enabled) continue
    switch (sec.type) {
      case 'description':
        if (p.description) details.push(`<section class="blk"><h2>${T.about}</h2><div class="txt">${sanitizeHtml(p.description)}</div></section>`)
        break
      case 'benefits':
        if (p.keyBenefits.length) details.push(`<section class="blk"><h2>${T.why}</h2><ul class="checks">${p.keyBenefits.map((b) => `<li>${ico('check')}<span>${esc(b)}</span></li>`).join('')}</ul></section>`)
        break
      case 'specs':
        if (p.specifications.length) details.push(`<section class="blk"><h2>${T.specs}</h2><dl class="specs">${p.specifications.slice(0, 12).map((x) => `<dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd>`).join('')}</dl></section>`)
        break
      case 'howItWorks':
        details.push(`<section class="blk"><h2>${T.how}</h2><ol class="how">${T.howSteps.map((x, i) => `<li><b>${i + 1}</b><span>${x}</span></li>`).join('')}</ol></section>`)
        break
      case 'testimonials':
        // Real, approved reviews only. With none, the section is simply omitted (never placeholder quotes).
        if (f.reviews.length) details.push(`<section class="blk"><h2>${T.reviews}</h2><div class="qs">${f.reviews.map((r) => `<blockquote><span class="st">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>${esc(r.text)}${r.author ? `<cite>${esc(r.author)}</cite>` : ''}</blockquote>`).join('')}</div></section>`)
        break
      case 'guarantee':
        details.push(`<section class="gt"><span>${ico('truck')}${T.trust[0]}</span><span>${ico('eye')}${T.trust[1]}</span><span>${ico('undo')}${T.trust[2]}</span></section>`)
        break
      case 'faq':
        if (p.faqs.length) details.push(`<section class="blk"><h2>${T.questions}</h2>${p.faqs.slice(0, 8).map((q) => `<div class="faq"><b>${esc(q.question)}</b><span>${esc(q.answer)}</span></div>`).join('')}</section>`)
        break
    }
  }
  if (!soldOut) details.push(`<section class="end"><span>${esc(headline)}</span><button type="button" class="cta" data-go>${ico('arrow')}<span>${esc(s.ctaLabel)}</span></button></section>`)

  // ---- post-order screens ----
  const offerScreen = (st: PublicFunnelStep) => {
    const op = st.offerProduct!
    return `<section class="scr" data-screen="o:${esc(st.id)}" hidden><p class="kk" style="font-weight:700;color:#b8892b">${T.offerKicker}</p><h1>${esc(st.headline || st.name)}</h1><div class="card">${
      op.imageUrl ? `<img class="op" src="${esc(imgUrl(op.imageUrl, 800))}" width="800" height="800" alt="${esc(op.name)}" loading="lazy" decoding="async">` : ''
    }<b style="font-size:17px">${esc(op.name)}</b><div class="ops">${op.normalPriceCents > op.priceCents ? `<s>${formatDa(op.normalPriceCents)}</s>` : ''}<b>${formatDa(op.priceCents)}</b></div><p class="safe" style="text-align:start">${T.offerNote}</p><div class="fe" data-oe></div><button type="button" class="cta" data-accept="${esc(st.id)}">${ico('arrow')}<span>${T.offerAdd}</span></button><button type="button" class="ghost" data-skip="${esc(st.id)}">${T.offerSkip}</button></div></section>`
  }
  const thanks = `<section class="scr" data-screen="thanks" hidden><div class="big">${ico('check')}</div><h1>${T.thanksTitle}</h1><p id="tb"></p><p>${T.orderNumber}: <span class="oid" id="oid"></span></p><div class="card"><b>${T.thanksNext}</b><ol class="nx">${T.thanksSteps.map((x, i) => `<li><b>${i + 1}</b><span>${x}</span></li>`).join('')}</ol></div></section>`

  // ---- client data (everything the script needs, nothing it must fetch) ----
  const metaId = f.pixels.metaPixelId && PIXEL_META.test(f.pixels.metaPixelId) ? f.pixels.metaPixelId : null
  const ttId = f.pixels.tiktokPixelCode && PIXEL_TIKTOK.test(f.pixels.tiktokPixelCode) ? f.pixels.tiktokPixelCode : null
  const fd = {
    id: f.id,
    slug: f.slug,
    pid: p.id,
    api: config.publicApiBase,
    variants: variants.map((v) => [v.id, v.priceCents, v.stockQuantity]),
    unit: p.priceCents,
    offers: offers.map((o) => ({ id: o.id, t: o.type === 'FixedBundlePrice' ? 'b' : o.type === 'BuyXGetYFree' ? 'x' : 's', r: o.requiredQuantity, f: o.freeQuantity, b: o.bundlePriceCents })),
    cta: s.ctaLabel,
    l: {
      save: T.save('').trim(),
      deliveryBy: T.deliveryByWilaya,
      free: T.free,
      chooseCommune: T.chooseCommune,
      home: T.homeDelivery,
      desk: T.deskDelivery,
      sending: T.sending,
      generic: T.errGeneric,
      network: T.errNetwork,
      thanksBody: T.thanksBody('\u0000')
    },
    bump: bumpStep?.offerProduct ? { id: bumpStep.id, p: bumpStep.offerProduct.priceCents } : null,
    w: f.wilayas.map((w) => [w.id, w.name, w.homePriceCents, w.deskPriceCents]),
    flow: after.map((x) => ({ id: x.id, t: x.type === 'Upsell' ? 'u' : 'd' })),
    addr: s.addressField,
    ab: f.abandonedDelaySeconds,
    px: { m: metaId, t: ttId },
    sold: soldOut
  }

  const description = plainText(p.description) || headline
  const ogImg = lcp && lcp.url.startsWith('/uploads/') ? null : lcp?.url
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(headline)} — ${esc(f.storeName)}</title><meta name="description" content="${esc(description)}"><meta name="theme-color" content="${accent.solid}"><meta property="og:title" content="${esc(headline)}"><meta property="og:description" content="${esc(description)}">${ogImg ? `<meta property="og:image" content="${esc(ogImg)}">` : ''}<link rel="preconnect" href="${esc(config.publicApiBase)}" crossorigin>${
    lcp ? `<link rel="preload" as="image" href="${esc(imgUrl(lcp.url, 800))}"${imgSrcset(lcp.url) ? ` imagesrcset="${esc(imgSrcset(lcp.url))}" imagesizes="${SIZES}"` : ''} fetchpriority="high">` : ''
  }<style>${CSS}</style>`

  const urgency = s.urgency ? `<div class="urg">${esc(s.urgencyText?.trim() || T.defaultUrgency)}</div>` : ''
  // Always present (the visitor can always reach the order button), unless there is nothing left to sell.
  const hasBar = !soldOut

  return `<!doctype html><html lang="${T.lang}" dir="${T.dir}" style="--a:${accent.solid};--s:${accent.soft}"><head>${head}</head><body class="${layout === 'split' ? 'split' : ''}${hasBar ? ' hasbar' : ''}">${SPRITE}<div id="m" data-screen="landing">${urgency}<div class="wrap"><div class="top">${gallery}<div class="buy">${buy}</div></div><div class="det">${details.join('')}</div></div></div>${after.map(offerScreen).join('')}${thanks}${
    hasBar ? `<div class="bar" id="bar"><div class="t"><small>${T.total}</small><b data-total>${formatDa(subtotal)}</b></div><button type="button" class="cta" id="bb">${ico('arrow')}<span>${esc(s.ctaLabel)}</span></button></div>` : ''
  }<script type="application/json" id="fd">${escJson(fd)}</script><script>${CLIENT_JS}</script></body></html>`
}
