/* Leezil Admin — shared layout, icons and page logic (vanilla JS, no build step) */
(function () {
  "use strict";
  var D = window.LEEZIL_DATA;

  /* ---------- Helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n) { return n.toLocaleString("en-US"); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function initials(name) { return name.split(" ").map(function (p) { return p[0]; }).join("").slice(0, 2).toUpperCase(); }

  /* ---------- Icons (24×24 grid, 1.6 stroke, round caps — per brand guide) ---------- */
  var ICONS = {
    overview: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    orders: '<path d="M5.5 8h13l-1 12.5h-11L5.5 8z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>',
    products: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    customers: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c1.8.8 3 2.6 3 4.7"/>',
    discounts: '<path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8a1.4 1.4 0 0 1 0 2l-7 7a1.4 1.4 0 0 1-2 0l-8-8z"/><circle cx="8" cy="8" r="1.3"/>',
    delivery: '<path d="M2.5 6.5h12v10h-12z"/><path d="M14.5 10h4l3 3v3.5h-7"/><circle cx="6.5" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/>',
    settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    external: '<path d="M7 17L17 7M9 7h8v8"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M4.5 19.5h15"/>',
    upload: '<path d="M12 20V9M7.5 13.5L12 9l4.5 4.5M4.5 4.5h15"/>',
    print: '<path d="M7 8V3.5h10V8M7 17H4.5V9.5a1.5 1.5 0 0 1 1.5-1.5h12a1.5 1.5 0 0 1 1.5 1.5V17H17"/><rect x="7" y="14" width="10" height="6.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    more: '<circle cx="5.5" cy="12" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="18.5" cy="12" r=".8"/>',
    alert: '<path d="M12 3.5l9 16H3l9-16z"/><path d="M12 10v4.5M12 17.2v.1"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    earbuds: '<circle cx="7" cy="7" r="3"/><path d="M7 10v10"/><circle cx="17" cy="7" r="3"/><path d="M17 10v10"/>',
    smartwatch: '<rect x="6.5" y="6.5" width="11" height="11" rx="3"/><path d="M9 6.5L9.5 3h5l.5 3.5M9 17.5l.5 3.5h5l.5-3.5M12 9.5V12l1.5 1.5"/>',
    headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3.5" y="14" width="4" height="6.5" rx="1.5"/><rect x="16.5" y="14" width="4" height="6.5" rx="1.5"/>',
    charger: '<path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0V7zM12 16v5"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>',
    sunglasses: '<path d="M3 9h18M4 9c0 3 1.5 5 3.5 5S11 12 11 9M13 9c0 3 1.5 5 3.5 5S20 12 20 9"/>',
    ring: '<circle cx="12" cy="15" r="6"/><path d="M10 5l2-2 2 2-2 2.5z"/>',
    gift: '<rect x="4" y="9" width="16" height="4" rx="1"/><path d="M5 13v7.5h14V13M12 9v11.5M12 9C10 9 8 8 8 6.5S10 4 12 9zM12 9c2 0 4-1 4-2.5S14 4 12 9z"/>'
  };
  function icon(name, extra) {
    return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"' + (extra || "") + '>' + (ICONS[name] || "") + "</svg>";
  }
  function hydrateIcons(root) {
    (root || document).querySelectorAll("svg[data-icon]").forEach(function (el) {
      el.setAttribute("viewBox", "0 0 24 24");
      el.setAttribute("aria-hidden", "true");
      el.classList.add("i");
      el.innerHTML = ICONS[el.getAttribute("data-icon")] || "";
    });
  }

  /* ---------- Shared layout: sidebar, mobile bar, bottom tabs ---------- */
  var PAGES = [
    { key: "overview", label: "Overview", href: "index.html" },
    { key: "orders", label: "Orders", href: "orders.html", badge: D.statusCounts["New"] },
    { key: "products", label: "Products & stock", short: "Products", href: "products.html" },
    { key: "customers", label: "Customers", href: "customers.html" }
  ];
  var MANAGE = [
    { key: "discounts", label: "Discounts" },
    { key: "delivery", label: "Delivery" },
    { key: "settings", label: "Settings" }
  ];

  function buildLayout() {
    var app = $(".app");
    if (!app) return;
    var current = app.getAttribute("data-page");

    var nav = PAGES.map(function (p) {
      var on = p.key === current;
      return '<a href="' + p.href + '"' + (on ? ' class="active" aria-current="page"' : "") + ">" + icon(p.key) +
        "<span>" + esc(p.label) + "</span>" + (p.badge ? '<span class="badge">' + p.badge + "</span>" : "") + "</a>";
    }).join("");
    var manage = MANAGE.map(function (p) { return '<a href="#">' + icon(p.key) + "<span>" + p.label + "</span></a>"; }).join("");

    var aside = document.createElement("aside");
    aside.className = "sidebar";
    aside.innerHTML =
      '<a href="index.html" aria-label="Leezil admin home"><img class="logo" src="assets/img/leezil-logo-ivory.svg" alt="Leezil"></a>' +
      '<nav class="nav" aria-label="Main"><span class="nav-label">Store</span>' + nav +
      '<span class="nav-label">Manage</span>' + manage + "</nav>" +
      '<div class="store-card"><div style="font-size:13px"><span class="dot"></span>Store is online</div>' +
      '<div style="font-size:16px;font-weight:600">leezil.com</div>' +
      '<a href="#" target="_blank" rel="noopener">View storefront' + icon("external", ' style="width:14px;height:14px"') + "</a></div>";
    app.insertBefore(aside, app.firstChild);

    var bar = document.createElement("div");
    bar.className = "mobile-bar";
    bar.innerHTML = '<img src="assets/img/leezil-icon-teal.svg" alt="Leezil"><span class="grow">Leezil Admin</span>' +
      '<button class="icon-btn" type="button" aria-label="Notifications, 3 new">' + icon("bell") + '<span class="ping"></span></button>';
    var main = $(".main", app);
    app.insertBefore(bar, main);

    var tabs = document.createElement("nav");
    tabs.className = "tabbar";
    tabs.setAttribute("aria-label", "Main");
    tabs.innerHTML = PAGES.map(function (p) {
      var on = p.key === current;
      return '<a href="' + p.href + '"' + (on ? ' class="active" aria-current="page"' : "") + "><span>" + icon(p.key) + "</span>" + esc(p.short || p.label) + "</a>";
    }).join("");
    document.body.appendChild(tabs);
  }

  /* ---------- Status pills ---------- */
  var STATUS_CLASS = { "New": "new", "Confirmed": "confirmed", "Out for delivery": "shipping", "Delivered": "delivered", "Returned": "returned" };
  function statusPill(s) { return '<span class="pill ' + STATUS_CLASS[s] + '">' + esc(s) + "</span>"; }

  /* ---------- Overview ---------- */
  function renderOverview() {
    var cur = D.revenue.current, prev = D.revenue.previous;
    var total = cur.reduce(function (a, b) { return a + b; }, 0);
    var prevTotal = prev.reduce(function (a, b) { return a + b; }, 0);
    var delta = ((total / prevTotal - 1) * 100).toFixed(1);
    $("#kpi-revenue").textContent = money(total);
    $("#kpi-revenue-delta").textContent = (delta >= 0 ? "+" : "") + delta + "%";

    renderChart($("#revenue-chart"), cur, prev, D.revenue.start);

    // Orders by status
    var counts = D.statusCounts, sum = 0;
    Object.keys(counts).forEach(function (k) { sum += counts[k]; });
    var colors = { "New": "#C9A35E", "Confirmed": "#9DB3AA", "Out for delivery": "#557A6E", "Delivered": "#18403F", "Returned": "#B4533A" };
    var labels = { "New": "New — to confirm" };
    $("#status-bar").innerHTML = Object.keys(counts).map(function (k) {
      return '<span style="width:' + (counts[k] / sum * 100) + "%;background:" + colors[k] + '"></span>';
    }).join("");
    $("#status-list").innerHTML = Object.keys(counts).map(function (k) {
      return '<li><span class="sw" style="background:' + colors[k] + '"></span><span class="grow">' + esc(labels[k] || k) + "</span><b>" + counts[k] + "</b></li>";
    }).join("");

    // Recent orders
    $("#recent-orders").innerHTML = D.orders.slice(0, 6).map(function (o) {
      return "<tr><td class=\"strong\">" + esc(o.id) + "</td><td>" + esc(o.name) + '<span class="sub">' + esc(o.ago) + "</span></td><td>" +
        esc(o.wilaya) + '</td><td class="num strong">' + money(o.total) + " DA</td><td>" + statusPill(o.status) + "</td></tr>";
    }).join("");

    // Top products
    var top = D.products.slice().sort(function (a, b) { return b.sold * b.price - a.sold * a.price; }).slice(0, 3);
    $("#top-products").innerHTML = top.map(function (p) {
      return '<div class="prod"><span class="thumb">' + icon(p.icon) + '</span><span class="grow">' + esc(p.name) +
        '<span class="sub muted" style="display:block;font-size:12px">' + p.sold + " sold</span></span><b>" + money(p.sold * p.price) + " DA</b></div>";
    }).join("");

    // Low stock
    var low = D.products.filter(function (p) { return p.stock > 0 && p.stock < 10; });
    $("#low-stock-tags").innerHTML = low.map(function (p) { return '<span class="tag">' + esc(p.name) + " · " + p.stock + " left</span>"; }).join("");

    // Wilayas
    $("#wilaya-bars").innerHTML = D.wilayas.map(function (w, i) {
      return '<div class="bar-item"><div class="top"><span>' + esc(w.name) + "</span><b>" + w.share + '%</b></div><div class="track"><div style="width:' +
        w.share + "%" + (i === D.wilayas.length - 1 ? ";background:#9DB3AA" : "") + '"></div></div></div>';
    }).join("");
  }

  function renderChart(el, cur, prev, start) {
    if (!el) return;
    var W = 600, H = 200, max = 70000, n = cur.length;
    function x(i) { return (i * W / (n - 1)).toFixed(1); }
    function y(v) { return (H - v / max * H).toFixed(1); }
    function line(a) { return a.map(function (v, i) { return (i ? "L" : "M") + x(i) + "," + y(v); }).join(" "); }
    var startDate = new Date(start + "T00:00:00");
    function dayLabel(i) {
      var d = new Date(startDate); d.setDate(d.getDate() + i);
      return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    }
    var grid = [20000, 40000, 60000].map(function (v) { return "M0 " + y(v) + "H" + W; }).join("");
    el.innerHTML =
      '<div class="y" aria-hidden="true"><span>60k</span><span>40k</span><span>20k</span><span>0</span></div>' +
      '<div class="plot"><svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img" aria-label="Daily revenue for the last 30 days compared with the previous 30 days">' +
      '<path d="' + grid + '" stroke="#ECE8DD" fill="none" vector-effect="non-scaling-stroke"/>' +
      '<path d="M0 ' + H + "H" + W + '" stroke="#DCD6C6" fill="none" vector-effect="non-scaling-stroke"/>' +
      '<path d="' + line(cur) + " L" + W + "," + H + " L0," + H + 'Z" fill="#18403F" fill-opacity="0.08"/>' +
      '<path d="' + line(prev) + '" fill="none" stroke="#9DB3AA" stroke-width="2" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/>' +
      '<path d="' + line(cur) + '" fill="none" stroke="#18403F" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      '</svg><div class="hover-line"></div><div class="marker"></div><div class="tip"></div></div>';

    var plot = $(".plot", el), hl = $(".hover-line", el), mk = $(".marker", el), tip = $(".tip", el);
    function show(i) {
      var left = (i / (n - 1) * 100) + "%";
      hl.style.left = mk.style.left = tip.style.left = left;
      mk.style.top = (100 - cur[i] / max * 100) + "%";
      tip.innerHTML = "<b>" + money(cur[i]) + " DA</b> · " + dayLabel(i);
      var f = i / (n - 1);
      tip.style.transform = "translate(" + (f > 0.8 ? "-100%" : f < 0.2 ? "0" : "-50%") + ", -110%)";
    }
    var peak = cur.indexOf(Math.max.apply(null, cur));
    show(peak);
    plot.addEventListener("mousemove", function (e) {
      var r = plot.getBoundingClientRect();
      var i = Math.round((e.clientX - r.left) / r.width * (n - 1));
      show(Math.max(0, Math.min(n - 1, i)));
    });
    plot.addEventListener("mouseleave", function () { show(peak); });
  }

  /* ---------- Orders ---------- */
  function renderOrders() {
    var state = { status: "All", q: "" };
    var counts = Object.assign({ "All": Object.keys(D.statusCounts).reduce(function (a, k) { return a + D.statusCounts[k]; }, 0) }, D.statusCounts);
    var tabsEl = $("#order-tabs"), body = $("#orders-body"), foot = $("#orders-foot");

    function draw() {
      tabsEl.innerHTML = Object.keys(counts).map(function (k) {
        return '<button class="chip-btn" type="button" role="tab" data-status="' + esc(k) + '" aria-selected="' + (k === state.status) + '">' +
          esc(k) + '<span class="count">' + counts[k] + "</span></button>";
      }).join("");
      var q = state.q.toLowerCase();
      var rows = D.orders.filter(function (o) {
        return (state.status === "All" || o.status === state.status) &&
          (!q || (o.id + " " + o.name + " " + o.phone + " " + o.wilaya).toLowerCase().indexOf(q) > -1);
      });
      body.innerHTML = rows.length ? rows.map(function (o) {
        return '<tr><td><input type="checkbox" aria-label="Select order ' + esc(o.id) + '"></td>' +
          '<td><span class="strong">' + esc(o.id) + '</span><span class="sub">' + esc(o.date) + "</span></td>" +
          "<td>" + esc(o.name) + '<span class="sub">' + esc(o.phone) + "</span></td>" +
          "<td>" + esc(o.wilaya) + "</td><td>" + esc(o.delivery) + '</td><td class="muted">' + esc(o.items) + "</td>" +
          '<td class="num"><span class="strong">' + money(o.total) + ' DA</span><span class="sub">Cash on delivery</span></td>' +
          "<td>" + statusPill(o.status) + '</td><td class="num"><button class="row-btn" type="button" aria-label="More actions for ' + esc(o.id) + '">' + icon("more") + "</button></td></tr>";
      }).join("") : '<tr><td colspan="9" class="empty">No orders match this filter.</td></tr>';
      foot.textContent = "Showing " + rows.length + " of " + counts[state.status] + " orders";
    }
    tabsEl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-status]"); if (!b) return;
      state.status = b.getAttribute("data-status"); draw();
    });
    $("#orders-search").addEventListener("input", function (e) { state.q = e.target.value; draw(); });
    $("#select-all").addEventListener("change", function (e) {
      body.querySelectorAll('input[type="checkbox"]').forEach(function (c) { c.checked = e.target.checked; });
    });
    draw();
  }

  /* ---------- Products ---------- */
  function renderProducts() {
    var state = { cat: "All", q: "" };
    var cats = ["All"].concat(D.products.map(function (p) { return p.cat; }).filter(function (c, i, a) { return a.indexOf(c) === i; }));
    var tabsEl = $("#cat-tabs"), body = $("#products-body");
    function stockInfo(s) {
      if (s === 0) return { label: "Out of stock", cls: "out", color: "#B4533A" };
      if (s < 10) return { label: "Low stock", cls: "low", color: "#C9A35E" };
      return { label: "In stock", cls: "instock", color: "#18403F" };
    }
    function draw() {
      tabsEl.innerHTML = cats.map(function (c) {
        return '<button class="chip-btn" type="button" role="tab" data-cat="' + esc(c) + '" aria-selected="' + (c === state.cat) + '">' + esc(c) + "</button>";
      }).join("");
      var q = state.q.toLowerCase();
      var rows = D.products.filter(function (p) {
        return (state.cat === "All" || p.cat === state.cat) && (!q || (p.name + " " + p.sku).toLowerCase().indexOf(q) > -1);
      });
      body.innerHTML = rows.length ? rows.map(function (p) {
        var s = stockInfo(p.stock), pct = Math.min(100, Math.round(p.stock / 150 * 100));
        return '<tr><td><div class="prod"><span class="thumb">' + icon(p.icon) + '</span><span><span class="strong">' + esc(p.name) +
          '</span><span class="sub">SKU ' + esc(p.sku) + "</span></span></div></td>" +
          "<td>" + esc(p.cat) + '</td><td class="num strong">' + money(p.price) + " DA</td>" +
          '<td><div class="stock"><div class="track"><div style="width:' + (p.stock ? Math.max(pct, 4) : 0) + "%;background:" + s.color + '"></div></div><span>' + p.stock + " units</span></div></td>" +
          '<td class="num">' + p.sold + '</td><td><span class="pill ' + s.cls + '">' + s.label + "</span></td>" +
          '<td class="num"><button class="btn btn-sm" type="button">Edit</button></td></tr>';
      }).join("") : '<tr><td colspan="7" class="empty">No products found.</td></tr>';
    }
    tabsEl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cat]"); if (!b) return;
      state.cat = b.getAttribute("data-cat"); draw();
    });
    $("#products-search").addEventListener("input", function (e) { state.q = e.target.value; draw(); });
    draw();
  }

  /* ---------- Customers ---------- */
  function renderCustomers() {
    var state = { sel: 0, q: "" };
    var SEG = { "VIP": "vip", "Repeat": "repeat", "New": "newcust" };
    var body = $("#customers-body"), panel = $("#customer-panel");
    function draw() {
      var q = state.q.toLowerCase();
      var list = D.customers.map(function (c, i) { return { c: c, i: i }; }).filter(function (x) {
        return !q || (x.c.name + " " + x.c.phone + " " + x.c.wilaya).toLowerCase().indexOf(q) > -1;
      });
      body.innerHTML = list.length ? list.map(function (x) {
        var c = x.c, on = x.i === state.sel;
        return "<tr" + (on ? ' class="selected"' : "") + '><td><button class="cust-btn" type="button" data-i="' + x.i + '" aria-pressed="' + on + '">' +
          '<span class="initials">' + initials(c.name) + '</span><span><span class="strong">' + esc(c.name) + '</span><span class="sub">' + esc(c.phone) + "</span></span></button></td>" +
          "<td>" + esc(c.wilaya) + '</td><td class="num">' + c.orders + '</td><td class="num strong">' + money(c.spent) + " DA</td>" +
          "<td>" + esc(c.last) + '</td><td><span class="pill ' + SEG[c.segment] + '">' + esc(c.segment) + "</span></td></tr>";
      }).join("") : '<tr><td colspan="6" class="empty">No customers found.</td></tr>';

      var s = D.customers[state.sel];
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:14px"><span class="initials lg">' + initials(s.name) + "</span>" +
        '<div style="flex-grow:1"><h2 style="font-size:20px">' + esc(s.name) + '</h2><span class="muted">Customer since ' + esc(s.since) + "</span></div>" +
        '<span class="pill ' + SEG[s.segment] + '">' + esc(s.segment) + "</span></div>" +
        '<div class="mini-stats"><div><span class="muted">Orders</span><b>' + s.orders + '</b></div><div><span class="muted">Total spent</span><b>' + money(s.spent) + ' <small style="font-size:13px;font-weight:500">DA</small></b></div></div>' +
        '<dl class="details"><dt>Phone</dt><dd>' + esc(s.phone) + "</dd><dt>Wilaya</dt><dd>" + esc(s.wilaya) + "</dd><dt>Delivery</dt><dd>" + esc(s.delivery) +
        "</dd><dt>Returns</dt><dd>" + (s.returns ? s.returns + " returned parcel" + (s.returns > 1 ? "s" : "") : "None") + "</dd></dl>" +
        '<div style="border-top:1px solid #ECE8DD;padding-top:16px;display:flex;flex-direction:column;gap:10px"><h3 style="font-size:14px">Latest order</h3>' +
        '<div style="display:flex;gap:10px;font-size:14px"><span style="flex-grow:1">' + esc(s.lastItem) + "</span><b>" + money(s.lastTotal) + " DA</b></div></div>" +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" type="button" style="flex:1 1 auto">Create order</button>' +
        '<button class="btn" type="button" style="flex:1 1 auto">Call customer</button></div>';
    }
    body.addEventListener("click", function (e) {
      var b = e.target.closest("[data-i]"); if (!b) return;
      state.sel = +b.getAttribute("data-i"); draw();
      if (window.matchMedia("(max-width: 860px)").matches) panel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("#customers-search").addEventListener("input", function (e) { state.q = e.target.value; draw(); });
    draw();
  }

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    buildLayout();
    hydrateIcons();
    var page = ($(".app") || {}).getAttribute && $(".app").getAttribute("data-page");
    if (page === "overview") renderOverview();
    if (page === "orders") renderOrders();
    if (page === "products") renderProducts();
    if (page === "customers") renderCustomers();
  });
})();
