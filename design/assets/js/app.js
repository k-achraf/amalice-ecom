/* =========================================================
   Leezil Admin — core: helpers, icons, layout, overlays.
   Page scripts live in assets/js/pages/*.js and register with
   LZ.page("name", function () { ... }).
   ========================================================= */
(function () {
  "use strict";

  var LZ = window.LZ = { pages: {} };

  /* ---------- Helpers ---------- */
  LZ.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  LZ.money = function (n) { return Number(n || 0).toLocaleString("en-US"); };
  LZ.da = function (n) { return LZ.money(n) + " DA"; };
  LZ.$ = function (sel, root) { return (root || document).querySelector(sel); };
  LZ.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  LZ.initials = function (name) { return String(name).split(" ").map(function (p) { return p[0]; }).join("").slice(0, 2).toUpperCase(); };
  LZ.param = function (k) { return new URLSearchParams(location.search).get(k); };
  LZ.slug = function (s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };
  LZ.page = function (name, fn) { LZ.pages[name] = fn; };
  LZ.on = function (root, event, selector, fn) {
    root.addEventListener(event, function (e) {
      var t = e.target.closest(selector);
      if (t && root.contains(t)) fn(e, t);
    });
  };

  /* ---------- Icons (24×24, 1.6 stroke, round caps — brand icon spec) ---------- */
  var I = LZ.ICONS = {
    overview: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    orders: '<path d="M5.5 8h13l-1 12.5h-11L5.5 8z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>',
    headset: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3.5" y="13" width="4" height="6" rx="1"/><rect x="16.5" y="13" width="4" height="6" rx="1"/><path d="M18.5 19v.5a2 2 0 0 1-2 2H13"/>',
    cart: '<path d="M3 4h2.5l2.2 11h10.6l2-8H6.6"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
    products: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    layers: '<path d="M12 3.5l8.5 4.5L12 12.5 3.5 8 12 3.5z"/><path d="M3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5"/>',
    customers: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c1.8.8 3 2.6 3 4.7"/>',
    rates: '<path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8a1.4 1.4 0 0 1 0 2l-7 7a1.4 1.4 0 0 1-2 0l-8-8z"/><circle cx="8" cy="8" r="1.3"/>',
    delivery: '<path d="M2.5 6.5h12v10h-12z"/><path d="M14.5 10h4l3 3v3.5h-7"/><circle cx="6.5" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/>',
    store: '<path d="M4 9.5V20h16V9.5"/><path d="M3 9.5l1.5-5h15l1.5 5c0 1.4-1.1 2.5-2.5 2.5S16 10.9 16 9.5c0 1.4-1.1 2.5-2.5 2.5h-3C9.1 12 8 10.9 8 9.5 8 10.9 6.9 12 5.5 12S3 10.9 3 9.5z"/><path d="M10 20v-4.5h4V20"/>',
    apps: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M17 3.5v7M13.5 7h7"/>',
    users: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/><path d="M16.5 3.5l1 1 2-2" transform="translate(1 1)"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.4-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5.1-7.5-9.5V6L12 3z"/><path d="M9 12l2 2 4-4"/>',
    settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    external: '<path d="M7 17L17 7M9 7h8v8"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M4.5 19.5h15"/>',
    upload: '<path d="M12 20V9M7.5 13.5L12 9l4.5 4.5M4.5 4.5h15"/>',
    print: '<path d="M7 8V3.5h10V8M7 17H4.5V9.5A1.5 1.5 0 0 1 6 8h12a1.5 1.5 0 0 1 1.5 1.5V17H17"/><rect x="7" y="14" width="10" height="6.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    more: '<path d="M5.5 12h.01M12 12h.01M18.5 12h.01" stroke-width="3"/>',
    alert: '<path d="M12 3.5l9 16H3l9-16z"/><path d="M12 10v4.5M12 17.2v.1"/>',
    info: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M12 11v5.5M12 7.8v.1"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="1.5"/><path d="M15.5 8.5v-3a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5.5V14A1.5 1.5 0 0 0 5 15.5h3.5"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    phone: '<path d="M5 3.5h3.5l1.5 4.5-2.2 1.5a11 11 0 0 0 6.7 6.7L16 14l4.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5A16 16 0 0 1 3.5 5 1.5 1.5 0 0 1 5 3.5z"/>',
    phoneoff: '<path d="M5 3.5h3.5l1.5 4.5-2.2 1.5a11 11 0 0 0 6.7 6.7L16 14l4.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5A16 16 0 0 1 3.5 5 1.5 1.5 0 0 1 5 3.5z"/><path d="M3 21L21 3"/>',
    message: '<path d="M4 5h16v11H9l-5 4V5z"/><path d="M8 9.5h8M8 12.5h5"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="1.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    pin: '<path d="M12 21s-6.5-6.1-6.5-11A6.5 6.5 0 0 1 18.5 10c0 4.9-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-8.5 8.5"/>',
    drag: '<path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01" stroke-width="2.6"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8.5M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 14.5 4.5L20 15.5M20 20v-4.5h-4.5"/>',
    note: '<path d="M5 3.5h10l4 4v13H5z"/><path d="M14.5 3.5v4.5H19M8.5 12h7M8.5 15.5h7"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.9 1.4-2l-.4-1.1c-.5-1.2.4-2.4 1.6-2.4h2.2a3.7 3.7 0 0 0 3.7-3.7C20.5 7 16.7 3.5 12 3.5z"/><path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01" stroke-width="2.6"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.7 3.5 5.5 3.5 8.5s-1 5.8-3.5 8.5c-2.5-2.7-3.5-5.5-3.5-8.5s1-5.8 3.5-8.5z"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
    zap: '<path d="M13 3L5 13.5h6.5L10.5 21 19 10.5h-6.5L13 3z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    send: '<path d="M21 3L10 14M21 3l-6.5 18-4.5-7-7-4.5L21 3z"/>',
    wallet: '<rect x="3" y="6" width="18" height="13.5" rx="1.5"/><path d="M3 9.5h18M16 14h2"/>',
    earbuds: '<circle cx="7" cy="7" r="3"/><path d="M7 10v10"/><circle cx="17" cy="7" r="3"/><path d="M17 10v10"/>',
    smartwatch: '<rect x="6.5" y="6.5" width="11" height="11" rx="3"/><path d="M9 6.5L9.5 3h5l.5 3.5M9 17.5l.5 3.5h5l.5-3.5M12 9.5V12l1.5 1.5"/>',
    headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4" height="6.5" rx="1.5"/><rect x="16.5" y="14" width="4" height="6.5" rx="1.5"/>',
    charger: '<path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0V7zM12 16v5"/>',
    mobile: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
    sunglasses: '<path d="M3 9h18M4 9c0 3 1.5 5 3.5 5S11 12 11 9M13 9c0 3 1.5 5 3.5 5S20 12 20 9"/>',
    ring: '<circle cx="12" cy="15" r="6"/><path d="M10 5l2-2 2 2-2 2.5z"/>',
    gift: '<rect x="4" y="9" width="16" height="4" rx="1"/><path d="M5 13v7.5h14V13M12 9v11.5M12 9C10 9 8 8 8 6.5S10 4 12 9zM12 9c2 0 4-1 4-2.5S14 4 12 9z"/>'
  };
  LZ.icon = function (name, extra) {
    return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"' + (extra || "") + ">" + (I[name] || "") + "</svg>";
  };
  LZ.hydrateIcons = function (root) {
    LZ.$$("svg[data-icon]", root).forEach(function (el) {
      el.setAttribute("viewBox", "0 0 24 24");
      el.setAttribute("aria-hidden", "true");
      el.classList.add("i");
      el.innerHTML = I[el.getAttribute("data-icon")] || "";
    });
  };

  /* ---------- Status badges ---------- */
  LZ.STATUS = { "New": "new", "Confirmed": "confirmed", "Out for delivery": "shipping", "Delivered": "delivered", "Returned": "returned", "Cancelled": "cancelled" };
  LZ.statusPill = function (s) { return '<span class="pill ' + (LZ.STATUS[s] || "neutral") + '">' + LZ.esc(s) + "</span>"; };
  LZ.pill = function (text, cls) { return '<span class="pill ' + (cls || "neutral") + '">' + LZ.esc(text) + "</span>"; };
  LZ.toggle = function (name, checked, label) {
    return '<label class="switch"><input type="checkbox"' + (name ? ' name="' + name + '"' : "") + (checked ? " checked" : "") +
      (label ? ' aria-label="' + LZ.esc(label) + '"' : "") + "><span></span></label>";
  };

  /* ---------- Layout ---------- */
  var NAV = [
    { group: "Store", items: [
      { key: "overview", label: "Overview", href: "index.html", icon: "overview" },
      { key: "orders", label: "Orders", href: "orders.html", icon: "orders" },
      { key: "call-center", label: "Call center", href: "call-center.html", icon: "headset", count: "callQueue" },
      { key: "abandoned-carts", label: "Abandoned carts", href: "abandoned-carts.html", icon: "cart" },
      { key: "customers", label: "Customers", href: "customers.html", icon: "customers" }
    ] },
    { group: "Catalogue", items: [
      { key: "products", label: "Products", href: "products.html", icon: "products" },
      { key: "attributes", label: "Attributes & options", href: "attributes.html", icon: "layers" }
    ] },
    { group: "Shipping", items: [
      { key: "shipping-rates", label: "Shipping rates", href: "shipping-rates.html", icon: "rates" },
      { key: "shipping-companies", label: "Shipping companies", href: "shipping-companies.html", icon: "delivery" }
    ] },
    { group: "Online store", items: [
      { key: "storefront", label: "Storefront", href: "storefront.html", icon: "store" },
      { key: "apps", label: "Apps", href: "apps.html", icon: "apps" }
    ] },
    { group: "Admin", items: [
      { key: "users", label: "Users & roles", href: "users.html", icon: "shield" }
    ] }
  ];
  // Child pages highlight their parent in the menu
  var PARENT = { "product-edit": "products", "order": "orders" };

  function buildLayout() {
    var app = LZ.$(".app");
    if (!app) return;
    var page = app.getAttribute("data-page");
    var current = PARENT[page] || page;
    var D = window.LEEZIL_DATA || {};

    var nav = NAV.map(function (g) {
      return '<span class="nav-label">' + g.group + "</span>" + g.items.map(function (p) {
        var on = p.key === current;
        var count = p.count && D[p.count] ? D[p.count].length : 0;
        return '<a href="' + p.href + '"' + (on ? ' class="active" aria-current="page"' : "") + ">" + LZ.icon(p.icon) +
          "<span>" + LZ.esc(p.label) + "</span>" + (count ? '<span class="count">' + count + "</span>" : "") + "</a>";
      }).join("");
    }).join("");

    var aside = document.createElement("aside");
    aside.className = "sidebar";
    aside.id = "sidebar";
    aside.innerHTML =
      '<a href="index.html" aria-label="Leezil admin home"><img class="logo" src="assets/img/leezil-logo-ivory.svg" alt="Leezil"></a>' +
      '<nav class="nav" aria-label="Main">' + nav + "</nav>" +
      '<div class="store-card"><div class="live"><i></i>Store is online</div>' +
      '<div style="font-size:15px;font-weight:600">leezil.com</div>' +
      '<a href="storefront.html">View storefront' + LZ.icon("external", ' style="width:14px;height:14px"') + "</a></div>";
    app.insertBefore(aside, app.firstChild);

    var scrim = document.createElement("div");
    scrim.className = "scrim";
    document.body.appendChild(scrim);

    var bar = document.createElement("div");
    bar.className = "mobile-bar";
    bar.innerHTML = '<button class="icon-btn" type="button" data-menu aria-label="Open menu" aria-controls="sidebar">' + LZ.icon("menu") + "</button>" +
      '<img src="assets/img/leezil-icon-teal.svg" alt=""><span class="grow">Leezil Admin</span>' +
      '<button class="icon-btn" type="button" aria-label="Notifications, 3 new">' + LZ.icon("bell") + '<span class="ping"></span></button>';
    app.insertBefore(bar, LZ.$(".main", app));

    var tabs = document.createElement("nav");
    tabs.className = "tabbar";
    tabs.setAttribute("aria-label", "Quick");
    var quick = [["overview", "Home", "index.html", "overview"], ["orders", "Orders", "orders.html", "orders"], ["call-center", "Calls", "call-center.html", "headset"], ["products", "Products", "products.html", "products"]];
    tabs.innerHTML = quick.map(function (q) {
      var on = q[0] === current;
      return '<a href="' + q[2] + '"' + (on ? ' class="active" aria-current="page"' : "") + "><span>" + LZ.icon(q[3]) + "</span>" + q[1] + "</a>";
    }).join("") + '<button type="button" data-menu aria-controls="sidebar"><span>' + LZ.icon("menu") + "</span>More</button>";
    document.body.appendChild(tabs);

    function setMenu(open) {
      aside.classList.toggle("open", open);
      scrim.classList.toggle("on", open);
    }
    LZ.$$("[data-menu]").forEach(function (b) { b.addEventListener("click", function () { setMenu(true); }); });
    scrim.addEventListener("click", function () { setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
  }

  /* ---------- Overlays ---------- */
  var overlay, lastFocus;
  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "overlay";
    overlay.addEventListener("click", LZ.closeAll);
    document.body.appendChild(overlay);
    return overlay;
  }
  // Opens a modal or drawer. opts: { id, title, body (html), foot (html), kind: "modal"|"drawer", onMount(el) }
  LZ.open = function (opts) {
    ensureOverlay();
    LZ.closeAll();
    lastFocus = document.activeElement;
    var el = document.getElementById(opts.id || "lz-dialog");
    if (!el) { el = document.createElement("div"); el.id = opts.id || "lz-dialog"; document.body.appendChild(el); }
    var kind = opts.kind || "modal";
    el.className = kind + " on";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-labelledby", el.id + "-title");
    el.innerHTML =
      '<div class="' + kind + '-head"><h2 id="' + el.id + '-title">' + LZ.esc(opts.title) + "</h2>" +
      '<button class="icon-btn plain sm" type="button" data-close aria-label="Close">' + LZ.icon("x") + "</button></div>" +
      '<div class="' + kind + '-body">' + (opts.body || "") + "</div>" +
      (opts.foot ? '<div class="' + kind + '-foot">' + opts.foot + "</div>" : "");
    overlay.classList.add("on");
    LZ.$$("[data-close]", el).forEach(function (b) { b.addEventListener("click", LZ.closeAll); });
    LZ.hydrateIcons(el);
    if (opts.onMount) opts.onMount(el);
    var f = el.querySelector("input, select, textarea, button:not([data-close])") || el.querySelector("button");
    if (f) f.focus();
    return el;
  };
  LZ.closeAll = function () {
    LZ.$$(".modal.on, .drawer.on").forEach(function (m) { m.classList.remove("on"); });
    if (overlay) overlay.classList.remove("on");
    if (lastFocus && lastFocus.focus) { lastFocus.focus(); lastFocus = null; }
  };
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") LZ.closeAll(); });

  var toastEl, toastTimer;
  LZ.toast = function (msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = LZ.icon("check") + "<span>" + LZ.esc(msg) + "</span>";
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("on"); }, 2600);
  };

  /* Save bar: shows when anything inside `form` changes. */
  LZ.saveBar = function (form, onSave, label) {
    var bar = document.createElement("div");
    bar.className = "savebar";
    bar.innerHTML = "<span>" + LZ.esc(label || "Unsaved changes") + '</span><button class="btn" type="button" data-discard>Discard</button><button class="btn btn-brass" type="button" data-save>Save</button>';
    document.body.appendChild(bar);
    function dirty() { bar.classList.add("on"); }
    form.addEventListener("input", dirty);
    form.addEventListener("change", dirty);
    LZ.$("[data-save]", bar).addEventListener("click", function () { bar.classList.remove("on"); if (onSave) onSave(); LZ.toast("Changes saved"); });
    LZ.$("[data-discard]", bar).addEventListener("click", function () { location.reload(); });
    return { dirty: dirty, bar: bar };
  };

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    buildLayout();
    LZ.hydrateIcons();
    var app = LZ.$(".app");
    var page = app && app.getAttribute("data-page");
    if (page && LZ.pages[page]) LZ.pages[page]();
    LZ.hydrateIcons();
  });
})();
