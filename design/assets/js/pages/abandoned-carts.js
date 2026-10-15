/* Abandoned carts */
LZ.page("abandoned-carts", function () {
  var D = window.LEEZIL_DATA, $ = LZ.$, esc = LZ.esc;
  var carts = D.carts.map(function (c) { return Object.assign({}, c); });
  var CLS = { "Not contacted": "new", "Message sent": "contacted", "Called": "contacted", "Recovered": "recovered", "Lost": "lost", "No contact info": "outline" };
  var state = { tab: "All", q: "" };

  function value(c) { return c.items.reduce(function (s, it) { return s + D.findProduct(it.p).price * it.qty; }, 0); }

  function drawKpis() {
    var total = carts.reduce(function (s, c) { return s + value(c); }, 0);
    var rec = carts.filter(function (c) { return c.status === "Recovered"; });
    var recVal = rec.reduce(function (s, c) { return s + value(c); }, 0);
    $("#cart-kpis").innerHTML =
      '<div class="kpi"><span class="label">Abandoned carts</span><span class="value">' + carts.length + '</span><span class="meta">Last 7 days</span></div>' +
      '<div class="kpi"><span class="label">Value left in carts</span><span class="value">' + LZ.money(total) + ' <small>DA</small></span><span class="meta">Without delivery</span></div>' +
      '<div class="kpi dark"><span class="label">Recovered</span><span class="value">' + LZ.money(recVal) + ' <small>DA</small></span><span class="meta">' + rec.length + " cart(s) turned into orders</span></div>" +
      '<div class="kpi"><span class="label">Recovery rate</span><span class="value">' + Math.round(rec.length / carts.length * 100) + '%</span><span class="meta">With phone: ' + carts.filter(function (c) { return c.phone; }).length + " of " + carts.length + "</span></div>";
  }

  function draw() {
    var tabs = ["All", "Not contacted", "Message sent", "Called", "Recovered", "Lost"];
    $("#cart-tabs").innerHTML = tabs.map(function (k) {
      var n = k === "All" ? carts.length : carts.filter(function (c) { return c.status === k; }).length;
      return '<button class="chip-btn" type="button" role="tab" data-t="' + esc(k) + '" aria-selected="' + (k === state.tab) + '">' + esc(k) + '<span class="count">' + n + "</span></button>";
    }).join("");
    var q = state.q.toLowerCase();
    var list = carts.filter(function (c) { return (state.tab === "All" || c.status === state.tab) && (!q || (c.name + " " + c.phone).toLowerCase().indexOf(q) > -1); });
    $("#cart-body").innerHTML = list.length ? list.map(function (c) {
      var items = c.items.map(function (it) { var p = D.findProduct(it.p); return '<span class="thumb" title="' + esc(p.name) + '" style="width:32px;height:32px">' + LZ.icon(p.icon, ' style="width:16px;height:16px"') + "</span>"; }).join("");
      var names = c.items.map(function (it) { return D.findProduct(it.p).name + (it.qty > 1 ? " ×" + it.qty : ""); }).join(", ");
      var acts;
      if (c.status === "Recovered") acts = '<a class="btn btn-sm" href="order.html?id=' + c.order + '">View order</a>';
      else if (c.status === "Lost" || !c.phone) acts = '<span class="muted">—</span>';
      else acts = '<button class="row-btn" type="button" data-act="msg" data-id="' + c.id + '" aria-label="Send WhatsApp reminder to ' + esc(c.name) + '">' + LZ.icon("message") + "</button>" +
        '<button class="row-btn" type="button" data-act="call" data-id="' + c.id + '" aria-label="Call ' + esc(c.name) + '">' + LZ.icon("phone") + "</button>" +
        '<button class="btn btn-sm" type="button" data-act="convert" data-id="' + c.id + '">Create order</button>';
      return "<tr><td><span class=\"strong\">" + esc(c.name) + '</span><span class="sub">' + (c.phone ? esc(c.phone) + " · " + esc(c.wilaya) : "No phone") + "</span></td>" +
        '<td><div style="display:flex;gap:8px;align-items:center"><div style="display:flex;gap:4px">' + items + '</div><span class="muted" style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(names) + "</span></div></td>" +
        '<td class="num strong">' + LZ.da(value(c)) + "</td>" +
        "<td>" + esc(c.step) + '<span class="sub">' + esc(c.when) + " · " + esc(c.source) + "</span></td>" +
        "<td>" + LZ.pill(c.status, CLS[c.status]) + '</td><td class="num" style="white-space:nowrap">' + acts + "</td></tr>";
    }).join("") : '<tr><td colspan="6" class="empty">No carts here.</td></tr>';
  }

  // Funnel: where visitors stopped
  var steps = [["Viewed product", 2140], ["Opened order form", 486], ["Filled delivery info", 212], ["Placed order", 142]];
  $("#funnel").innerHTML = steps.map(function (s, i) {
    var pct = Math.round(s[1] / steps[0][1] * 100);
    return '<div class="bar-item"><div class="top"><span>' + esc(s[0]) + "</span><b>" + LZ.money(s[1]) + '</b></div><div class="track" style="height:8px"><div style="width:' + Math.max(pct, 2) + "%" +
      (i === steps.length - 1 ? ";background:#C9A35E" : "") + '"></div></div>' + (i ? '<span class="muted" style="font-size:12px">' + Math.round(s[1] / steps[i - 1][1] * 100) + "% continued</span>" : "") + "</div>";
  }).join("");

  function find(id) { return carts.filter(function (c) { return c.id === id; })[0]; }
  LZ.on($("#cart-tabs"), "click", "[data-t]", function (e, b) { state.tab = b.getAttribute("data-t"); draw(); });
  $("#cart-search").addEventListener("input", function (e) { state.q = e.target.value; draw(); });
  LZ.on($("#cart-body"), "click", "[data-act]", function (e, b) {
    var c = find(b.getAttribute("data-id")), act = b.getAttribute("data-act");
    if (act === "msg") { c.status = "Message sent"; LZ.toast("Reminder sent to " + c.name); }
    if (act === "call") { c.status = "Called"; location.href = "tel:" + c.phone.replace(/[^\d+]/g, ""); }
    if (act === "convert") {
      LZ.open({
        title: "Create order from cart " + c.id,
        body: '<p class="muted" style="font-size:14px;line-height:1.6">The order goes to the call center queue for confirmation.</p>' +
          '<div class="totals"><div><span>' + esc(c.name) + "</span><span>" + esc(c.phone) + '</span></div><div><span>Products</span><span>' + LZ.da(value(c)) + "</span></div></div>" +
          '<label class="check"><input type="checkbox" checked><span>Apply free delivery as a thank-you</span></label>',
        foot: '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="conv-ok">Create order</button>',
        onMount: function (el) { $("#conv-ok", el).addEventListener("click", function () { c.status = "Recovered"; c.order = "LZ-2482"; LZ.closeAll(); drawKpis(); draw(); LZ.toast("Order #LZ-2482 created and sent to the call center"); }); }
      });
      return;
    }
    drawKpis(); draw();
  });
  $("#auto-on").addEventListener("change", function (e) {
    LZ.$$("#reminder-card .select, #reminder-card .textarea, #save-reminder").forEach(function (el) { el.disabled = !e.target.checked; });
  });
  $("#save-reminder").addEventListener("click", function () { LZ.toast("Reminder settings saved"); });
  $("#export-btn").addEventListener("click", function () { LZ.toast("Export started"); });
  drawKpis(); draw();
});
