// Funnel page client. Plain JS, no framework, inlined into the page. Everything it needs is in #fd
// (rendered by the server); it only calls the API for communes, the order, offers and analytics.
(function () {
  var fd = JSON.parse(document.getElementById('fd').textContent)
  var L = fd.l
  var $ = function (s, c) { return (c || document).querySelector(s) }
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)) }
  var fmt = function (c) { return (c / 100).toLocaleString('en-US') + ' دج' }
  var form = $('#f')
  var bar = $('#bar')
  var loadedAt = Date.now()

  function uuid() {
    var b = new Uint8Array(16)
    crypto.getRandomValues(b)
    b[6] = (b[6] & 15) | 64
    b[8] = (b[8] & 63) | 128
    var h = [].map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2) }).join('')
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20)
  }
  function store(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v) } catch (e) { return null } }
  function visitor() {
    try {
      var v = localStorage.getItem('f.vid')
      if (!v) { v = uuid(); localStorage.setItem('f.vid', v) }
      return v
    } catch (e) { return uuid() }
  }
  function cookie(n) { var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : undefined }
  function digits(s) { return String(s).replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 1632 }).replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 1776 }) }
  function phoneOf(s) { return digits(s).replace(/[\s.\-()]/g, '') }
  var PHONE = /^(?:\+?213|0)[567]\d{8}$/

  // ---------- ad-source attribution (mirror of the storefront's useAttribution.ts) ----------
  // Remembers where the visitor came from (utm_*, campaign/ad ids, click ids, landing URL, referrer) for 30 days; the first touch is kept, the last touch is only replaced by a visit that carries an ad signal.
  var AP = { utmSource: [['utm_source'], 200], utmMedium: [['utm_medium'], 200], utmCampaign: [['utm_campaign'], 300], utmContent: [['utm_content'], 300], utmTerm: [['utm_term'], 300], campaignId: [['campaign_id', 'utm_id'], 100], adsetId: [['adset_id', 'adgroup_id'], 100], adId: [['ad_id', 'creative_id'], 100], campaignName: [['campaign_name'], 300], adsetName: [['adset_name', 'adgroup_name'], 300], adName: [['ad_name'], 300], placement: [['placement'], 100], fbclid: [['fbclid'], 500], ttclid: [['ttclid'], 500], gclid: [['gclid'], 500] }
  function adSignal(t) { return !!(t.utmSource || t.utmMedium || t.utmCampaign || t.campaignId || t.adsetId || t.adId || t.fbclid || t.ttclid || t.gclid) }
  function attrRead() { try { var s = JSON.parse(localStorage.getItem('f.attr')); return s && s.exp > Date.now() ? s : null } catch (e) { return null } }
  function attrWrite(s) { try { localStorage.setItem('f.attr', JSON.stringify(s)) } catch (e) {} }
  function attrCapture() {
    var q = new URLSearchParams(location.search), t = { capturedAt: Date.now() }
    Object.keys(AP).forEach(function (f) {
      var v = null
      AP[f][0].forEach(function (k) { if (!v && q.get(k) && q.get(k).trim()) v = q.get(k).trim() })
      if (v) t[f] = v.slice(0, AP[f][1])
    })
    t.landingUrl = (location.origin + location.pathname + location.search).slice(0, 2000)
    try { if (document.referrer && new URL(document.referrer).host !== location.host) t.referrer = document.referrer.slice(0, 2000) } catch (e) {}
    var s = attrRead(), exp = Date.now() + 2592000000
    if (!s) attrWrite({ first: t, last: t, exp: exp })
    else if (adSignal(t)) attrWrite({ first: s.first, last: t, exp: exp })
  }
  function attribution() {
    var s = attrRead(), a = {}, k
    if (s) for (k in s.last) a[k] = s.last[k]
    a.channel = 'funnel'
    a.pageUrl = (location.origin + location.pathname + location.search).slice(0, 2000)
    a.visitorId = visitor()
    if (s && s.first.capturedAt !== s.last.capturedAt) a.firstTouch = s.first
    return a
  }
  attrCapture()

  // ---------- pixels: stubs now, scripts when the visitor interacts or the page is idle ----------
  var pq = [], pxReady = false
  function px(fn) { pxReady ? fn() : pq.push(fn) }
  function loadPx() {
    if (pxReady) return
    pxReady = true
    if (fd.px.m) {
      !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
      fbq('init', fd.px.m)
      fbq('track', 'PageView')
    }
    if (fd.px.t) {
      !function (w, d, t) {
        w.TiktokAnalyticsObject = t
        var ttq = w[t] = w[t] || []
        ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent']
        ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } }
        for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i])
        ttq.instance = function (t) { for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]); return e }
        ttq.load = function (e, n) { var i = 'https://analytics.tiktok.com/i18n/pixel/events.js'; ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = i; ttq._t = ttq._t || {}; ttq._t[e] = +new Date(); ttq._o = ttq._o || {}; ttq._o[e] = n || {}; var o = d.createElement('script'); o.type = 'text/javascript'; o.async = !0; o.src = i + '?sdkid=' + e + '&lib=' + t; var a = d.getElementsByTagName('script')[0]; a.parentNode.insertBefore(o, a) }
        ttq.load(fd.px.t)
        ttq.page()
      }(window, document, 'ttq')
    }
    var q = pq
    pq = []
    q.forEach(function (f) { try { f() } catch (e) {} })
  }
  ;['pointerdown', 'touchstart', 'scroll', 'keydown'].forEach(function (n) { addEventListener(n, loadPx, { once: true, passive: true }) })
  addEventListener('load', function () { ('requestIdleCallback' in window) ? requestIdleCallback(loadPx, { timeout: 2500 }) : setTimeout(loadPx, 2000) })

  function metaEv(n, p, id) { if (fd.px.m) px(function () { window.fbq && fbq('track', n, p, id ? { eventID: id } : undefined) }) }
  function ttEv(n, p, id) { if (fd.px.t) px(function () { if (window.ttq) { if (id) p.event_id = id; ttq.track(n, p) } }) }

  metaEv('ViewContent', { content_ids: [fd.pid], content_type: 'product', value: fd.unit / 100, currency: 'DZD' })
  ttEv('ViewContent', { contents: [{ content_id: fd.pid, content_type: 'product', price: fd.unit / 100 }], value: fd.unit / 100, currency: 'DZD' })

  // First-party traffic count (admin dashboard). Fire and forget.
  try { fetch(fd.api + '/analytics/view', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'Funnel', entityId: fd.id, path: location.pathname, visitorId: visitor() }), keepalive: true }).catch(function () {}) } catch (e) {}

  // ---------- photo carousel dots ----------
  var sl = $('#sl'), dots = $$('#dots i'), cnt = $('#cnt')
  if (sl && dots.length) {
    var raf = 0
    sl.addEventListener('scroll', function () {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(function () {
        var i = Math.max(0, Math.min(dots.length - 1, Math.round(Math.abs(sl.scrollLeft) / sl.clientWidth)))
        dots.forEach(function (d, k) { d.className = k === i ? 'on' : '' })
        if (cnt) cnt.textContent = (i + 1) + '/' + dots.length
      })
    }, { passive: true })
  }

  // ---------- screens ----------
  var order = null
  var flow = fd.flow
  var fi = -1
  function show(id) {
    $$('[data-screen]').forEach(function (s) { s.hidden = s.getAttribute('data-screen') !== id })
    if (bar) bar.hidden = id !== 'landing'
    scrollTo(0, 0)
    if (order) store('f.' + fd.slug, JSON.stringify({ o: order, s: id, t: Date.now() }))
  }
  function thanks() {
    var parts = L.thanksBody.split('\u0000')
    $('#tb').textContent = parts[0] + order.phone + (parts[1] || '')
    $('#oid').textContent = order.id.slice(0, 8).toUpperCase()
    show('thanks')
  }
  function go(i, accepted) {
    var j = i + 1
    if (accepted && i >= 0 && flow[i].t === 'u') while (j < flow.length && flow[j].t === 'd') j++
    if (j >= flow.length) return thanks()
    fi = j
    show('o:' + flow[j].id)
  }
  try {
    var saved = JSON.parse(store('f.' + fd.slug) || 'null')
    if (saved && saved.o && Date.now() - saved.t < 30 * 60000) {
      order = saved.o
      fi = flow.map(function (f) { return 'o:' + f.id }).indexOf(saved.s)
      saved.s === 'thanks' ? thanks() : show(saved.s)
    }
  } catch (e) {}

  if (!form) return

  // ---------- price maths (the server re-prices everything; this is only what the visitor sees) ----------
  var st = { off: 'one', ship: '', wil: null, bump: false }
  var checked = form.querySelector('[name=offer]:checked')
  if (checked) st.off = checked.value
  function vsel() { var r = form.querySelector('[name=variant]:checked'); return r ? r.value : null }
  function unit() {
    var id = vsel()
    if (id) for (var i = 0; i < fd.variants.length; i++) if (fd.variants[i][0] === id) return fd.variants[i][1]
    return fd.unit
  }
  function oq(o) { return o.t === 'x' ? o.r + o.f : o.r }
  function ot(o, u) { return o.t === 'b' ? (o.b == null ? u * o.r : o.b) : u * o.r }
  function offer() { for (var i = 0; i < fd.offers.length; i++) if (fd.offers[i].id === st.off) return fd.offers[i]; return null }
  function qty() { var o = offer(); return o ? oq(o) : 1 }
  function shipCents() { return st.wil && st.ship ? (st.ship === 'Home' ? st.wil[2] : st.wil[3]) : null }
  function total() { var u = unit(), o = offer(); return (o ? ot(o, u) : u) + (shipCents() || 0) + (st.bump && fd.bump ? fd.bump.p : 0) }
  function set(sel, txt) { $$(sel).forEach(function (e) { e.textContent = txt }) }
  function recalc() {
    var u = unit(), o = offer(), sub = (o ? ot(o, u) : u) + (st.bump && fd.bump ? fd.bump.p : 0), sc = shipCents()
    set('[data-unit]', fmt(u))
    set('[data-ot="one"]', fmt(u))
    fd.offers.forEach(function (x) {
      var t = ot(x, u), sv = Math.max(0, u * oq(x) - t)
      set('[data-ot="' + x.id + '"]', fmt(t))
      set('[data-os="' + x.id + '"]', sv > 0 ? L.save + ' ' + fmt(sv) : '')
    })
    set('[data-sub]', fmt(sub))
    set('[data-ship]', sc == null ? L.deliveryBy : sc === 0 ? L.free : fmt(sc))
    set('[data-total]', fmt(sub + (sc || 0)))
  }

  // ---------- wilaya → delivery options + communes ----------
  var communes = {}
  function loadCommunes(id) {
    var sel = form.commune
    sel.disabled = true
    sel.innerHTML = '<option value="">' + L.chooseCommune + '</option>'
    if (!id) return
    var fill = function (list) {
      if (form.wilaya.value !== id) return
      var frag = document.createDocumentFragment()
      list.forEach(function (c) { var o = document.createElement('option'); o.value = c.name; o.textContent = c.name; frag.appendChild(o) })
      sel.appendChild(frag)
      sel.disabled = false
    }
    if (communes[id]) return fill(communes[id])
    fetch(fd.api + '/communes?wilayaId=' + encodeURIComponent(id)).then(function (r) { return r.json() }).then(function (l) { communes[id] = l; fill(l) }).catch(function () { sel.disabled = false })
  }
  function onWilaya() {
    var id = form.wilaya.value
    st.wil = null
    for (var i = 0; i < fd.w.length; i++) if (fd.w[i][0] === id) st.wil = fd.w[i]
    var kinds = [['Home', 2], ['Desk', 3]]
    kinds.forEach(function (k) {
      var price = st.wil ? st.wil[k[1]] : null
      var r = form.querySelector('[name=ship][value=' + k[0] + ']')
      r.disabled = price == null
      var lab = k[0] === 'Home' ? L.home : L.desk
      set('[data-sl="' + k[0] + '"]', price == null ? lab : lab + ' · ' + (price === 0 ? L.free : fmt(price)))
    })
    var cur = form.querySelector('[name=ship]:checked')
    if (!cur || cur.disabled) {
      if (cur) cur.checked = false
      st.ship = ''
      var first = form.querySelector('[name=ship]:not(:disabled)')
      if (first) { first.checked = true; st.ship = first.value }
    }
    loadCommunes(id)
  }

  // ---------- searchable selects (wilaya / commune) ----------
  // The native <select> stays in the DOM (hidden) as the source of truth; a text box + list sits on top.
  function norm(s) { return digits(s).toLowerCase().normalize('NFD').replace(/[̀-ًͯ-ٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim() }
  function combo(sel) {
    var box = document.createElement('div')
    box.className = 'cb'
    var inp = document.createElement('input')
    inp.className = 'in'
    inp.type = 'text'
    inp.autocomplete = 'off'
    inp.setAttribute('role', 'combobox')
    inp.setAttribute('aria-expanded', 'false')
    var list = document.createElement('ul')
    list.className = 'cl'
    list.hidden = true
    sel.style.display = 'none'
    sel.parentNode.insertBefore(box, sel)
    box.appendChild(inp)
    box.appendChild(list)
    box.appendChild(sel)
    var items = []
    var hi = -1
    function refresh() {
      items = $$('option', sel).filter(function (o) { return o.value !== '' }).map(function (o) { return { v: o.value, t: o.textContent, n: norm(o.textContent) } })
      inp.disabled = sel.disabled
      inp.placeholder = sel.options.length ? sel.options[0].textContent : ''
      inp.value = sel.value ? sel.options[sel.selectedIndex].textContent : ''
    }
    function close() { list.hidden = true; inp.setAttribute('aria-expanded', 'false'); hi = -1 }
    function show() {
      var q = norm(inp.value === (sel.value && sel.options[sel.selectedIndex].textContent) ? '' : inp.value)
      var m = items.filter(function (i) { return !q || i.n.indexOf(q) !== -1 })
      list.innerHTML = ''
      if (!m.length) { var e = document.createElement('li'); e.className = 'ce'; e.textContent = '—'; list.appendChild(e) }
      m.forEach(function (i) {
        var li = document.createElement('li')
        li.textContent = i.t
        li.setAttribute('role', 'option')
        li.dataset.v = i.v
        if (i.v === sel.value) li.className = 'on'
        list.appendChild(li)
      })
      hi = -1
      list.hidden = false
      inp.setAttribute('aria-expanded', 'true')
    }
    function pick(v) {
      sel.value = v
      sel.dispatchEvent(new Event('change', { bubbles: true }))
      refresh()
      close()
    }
    function move(d) {
      var lis = $$('li[data-v]', list)
      if (!lis.length) return
      if (hi >= 0) lis[hi].classList.remove('hv')
      hi = (hi + d + lis.length) % lis.length
      lis[hi].classList.add('hv')
      lis[hi].scrollIntoView({ block: 'nearest' })
    }
    inp.addEventListener('focus', function () { inp.select(); show() })
    inp.addEventListener('input', show)
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) show(); move(1) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
      else if (e.key === 'Enter') {
        var lis = $$('li[data-v]', list)
        if (!list.hidden && lis.length) { e.preventDefault(); pick(lis[hi >= 0 ? hi : 0].dataset.v) }
      } else if (e.key === 'Escape') { close(); refresh() }
    })
    inp.addEventListener('blur', function () { setTimeout(function () { close(); refresh() }, 150) })
    list.addEventListener('mousedown', function (e) { e.preventDefault() })
    list.addEventListener('click', function (e) { var li = e.target.closest('li[data-v]'); if (li) pick(li.dataset.v) })
    new MutationObserver(refresh).observe(sel, { childList: true, attributes: true, attributeFilter: ['disabled'] })
    refresh()
  }
  combo(form.wilaya)
  combo(form.commune)

  form.addEventListener('change', function (e) {
    var n = e.target.name
    if (n === 'offer') st.off = e.target.value
    else if (n === 'ship') st.ship = e.target.value
    else if (n === 'bump') st.bump = e.target.checked
    else if (n === 'wilaya') onWilaya()
    var f = e.target.closest && e.target.closest('.fl')
    if (f) f.classList.remove('er')
    recalc()
  })

  // ---------- checkout started + abandoned cart ----------
  var started = false
  function startCheckout() {
    if (started) return
    started = true
    var v = total() / 100
    metaEv('InitiateCheckout', { content_ids: [fd.pid], content_type: 'product', contents: [{ id: fd.pid, quantity: qty() }], value: v, currency: 'DZD', num_items: qty() })
    ttEv('InitiateCheckout', { contents: [{ content_id: fd.pid, quantity: qty(), price: unit() / 100 }], value: v, currency: 'DZD' })
  }
  form.addEventListener('focusin', startCheckout)

  var abTimer = 0, abId = null, abDone = false, submitted = false
  function items() {
    var it = { productId: fd.pid, quantity: qty() }
    var v = vsel(), o = offer()
    if (v) it.variantId = v
    if (o) it.offerId = o.id
    return [it]
  }
  function fireAbandoned() {
    if (abDone || submitted) return
    abDone = true
    var fields = { phone: form.phone.value }
    ;['name', 'commune', 'address'].forEach(function (k) { if (form[k] && form[k].value.trim()) fields[k] = form[k].value.trim() })
    var body = { fields: fields, items: items(), tracking: { fbp: cookie('_fbp'), fbc: cookie('_fbc'), ttp: cookie('_ttp'), attribution: attribution() } }
    if (st.wil) body.wilayaId = st.wil[0]
    if (st.ship) body.shippingType = st.ship
    fetch(fd.api + '/orders/abandoned', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json() }).then(function (j) { if (j && j.id) abId = j.id }).catch(function () {})
  }
  form.addEventListener('input', function (e) {
    var f = e.target.closest && e.target.closest('.fl')
    if (f) f.classList.remove('er')
    if (e.target.name === 'phone') {
      clearTimeout(abTimer)
      if (!abDone && PHONE.test(phoneOf(e.target.value))) abTimer = setTimeout(fireAbandoned, fd.ab * 1000)
    }
  })

  // ---------- validate + submit ----------
  function flag(name, ok, bad) { var e = $('[data-f="' + name + '"]', form); if (e) e.classList.toggle('er', !ok); if (!ok) bad.push(name) }
  function validate() {
    var bad = []
    flag('name', form.name.value.trim().length >= 2, bad)
    flag('phone', PHONE.test(phoneOf(form.phone.value)), bad)
    flag('wilaya', !!form.wilaya.value, bad)
    flag('commune', !!form.commune.value, bad)
    if (fd.addr === 'required') flag('address', form.address.value.trim().length >= 3, bad)
    flag('ship', !!st.ship, bad)
    return bad
  }
  var btn = $('#sub'), fe = $('#fe'), busy = false, key = uuid()
  function busyUi(on) { busy = on; btn.disabled = on; $('span', btn).textContent = on ? L.sending : fd.cta }
  function fail(msg) { fe.textContent = msg || L.generic; fe.className = 'fe on'; fe.scrollIntoView({ block: 'center' }) }
  function submit(e) {
    if (e) e.preventDefault()
    if (busy) return
    var bad = validate()
    if (bad.length) {
      var t = $('[data-f="' + bad[0] + '"]', form)
      t.scrollIntoView({ block: 'center' })
      var i = $('input:not([type=radio]),select', t)
      if (i) i.focus({ preventScroll: true })
      return
    }
    busyUi(true)
    fe.className = 'fe'
    clearTimeout(abTimer)
    var fields = { name: form.name.value.trim(), phone: form.phone.value.trim(), commune: form.commune.value }
    if (form.address && form.address.value.trim()) fields.address = form.address.value.trim()
    if (form.notes && form.notes.value.trim()) fields.notes = form.notes.value.trim()
    var body = { fields: fields, wilayaId: st.wil[0], shippingType: st.ship, quantity: 1, idempotencyKey: key, formLoadedAt: loadedAt, tracking: { fbp: cookie('_fbp'), fbc: cookie('_fbc'), ttp: cookie('_ttp'), attribution: attribution() } }
    var v = vsel(), o = offer()
    if (v) body.variantId = v
    if (o) body.offerId = o.id
    if (st.bump && fd.bump) body.bumpStepId = fd.bump.id
    if (abId) body.convertsAbandonedOrderId = abId
    fetch(fd.api + '/public/funnels/' + fd.slug + '/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j } }, function () { return { ok: r.ok, j: {} } }) })
      .then(function (res) {
        if (!res.ok || !res.j.id) {
          busyUi(false)
          var m = res.j && res.j.message
          return fail(typeof m === 'string' ? m : Array.isArray(m) ? m[0] : null)
        }
        submitted = true
        order = { id: res.j.id, phone: form.phone.value.trim(), total: res.j.totalCents }
        var q = qty() + (st.bump ? 1 : 0), val = res.j.totalCents / 100
        metaEv('Purchase', { content_ids: [fd.pid], content_type: 'product', contents: [{ id: fd.pid, quantity: q }], value: val, currency: 'DZD' }, order.id)
        ttEv('CompletePayment', { contents: [{ content_id: fd.pid, quantity: q, price: val / q }], value: val, currency: 'DZD' }, order.id)
        go(-1, false)
      })
      .catch(function () { busyUi(false); fail(L.network) })
  }
  form.addEventListener('submit', submit)

  // ---------- upsell / downsell ----------
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-accept],[data-skip],[data-go]')
    if (!a) return
    if (a.hasAttribute('data-go')) { startCheckout(); form.scrollIntoView({ block: 'start' }); setTimeout(function () { form.name.focus({ preventScroll: true }) }, 450); return }
    var sid = a.getAttribute('data-accept') || a.getAttribute('data-skip')
    var idx = flow.map(function (f) { return f.id }).indexOf(sid)
    if (a.hasAttribute('data-skip')) return go(idx, false)
    if (a.disabled) return
    var err = $('[data-oe]', a.closest('.card'))
    a.disabled = true
    fetch(fd.api + '/public/funnels/' + fd.slug + '/orders/' + order.id + '/offers/' + sid, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: order.phone }) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j } }) })
      .then(function (res) {
        a.disabled = false
        if (!res.ok) { err.textContent = L.generic; err.className = 'fe on'; return }
        order.total = res.j.totalCents
        go(idx, true)
      })
      .catch(function () { a.disabled = false; err.textContent = L.network; err.className = 'fe on' })
  })

  // ---------- pinned order bar: always visible ----------
  if (bar) {
    // The bar never hides: while the form is on screen it submits the order, otherwise it takes the visitor to the form.
    $('#bb').addEventListener('click', function () {
      startCheckout()
      var r = form.getBoundingClientRect()
      if (r.top < innerHeight * 0.5 && r.bottom > innerHeight * 0.35) return submit()
      form.scrollIntoView({ block: 'start' })
      setTimeout(function () { form.name.focus({ preventScroll: true }) }, 450)
    })
  }

  onWilaya()
  recalc()
})()
