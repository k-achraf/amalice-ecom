/* Customers */
LZ.page("customers", function () {
  var D = window.LEEZIL_DATA, $ = LZ.$, esc = LZ.esc;
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
        '<span class="initials">' + LZ.initials(c.name) + '</span><span><span class="strong">' + esc(c.name) + '</span><span class="sub">' + esc(c.phone) + "</span></span></button></td>" +
        "<td>" + esc(c.wilaya) + '</td><td class="num">' + c.orders + '</td><td class="num strong">' + LZ.da(c.spent) + "</td>" +
        "<td>" + esc(c.last) + "</td><td>" + LZ.pill(c.segment, SEG[c.segment]) + "</td></tr>";
    }).join("") : '<tr><td colspan="6" class="empty">No customers found.</td></tr>';

    var s = D.customers[state.sel];
    panel.innerHTML =
      '<div style="display:flex;align-items:center;gap:14px"><span class="initials lg">' + LZ.initials(s.name) + "</span>" +
      '<div class="grow"><h2 style="font-size:18px">' + esc(s.name) + '</h2><span class="muted">Customer since ' + esc(s.since) + "</span></div>" + LZ.pill(s.segment, SEG[s.segment]) + "</div>" +
      '<div class="mini-stats"><div><span class="muted">Orders</span><b>' + s.orders + '</b></div><div><span class="muted">Total spent</span><b>' + LZ.money(s.spent) + ' <small style="font-size:12px;font-weight:500">DA</small></b></div></div>' +
      '<dl class="details"><dt>Phone</dt><dd>' + esc(s.phone) + "</dd><dt>Wilaya</dt><dd>" + esc(s.wilaya) + "</dd><dt>Delivery</dt><dd>" + esc(s.delivery) +
      "</dd><dt>Returns</dt><dd>" + (s.returns ? s.returns + " returned parcel" + (s.returns > 1 ? "s" : "") : "None") + "</dd></dl>" +
      '<hr class="divider"><div style="display:flex;flex-direction:column;gap:8px"><h3 style="font-size:14px">Latest order</h3>' +
      '<div style="display:flex;gap:10px"><span class="grow">' + esc(s.lastItem) + "</span><b>" + LZ.da(s.lastTotal) + "</b></div></div>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" type="button" style="flex:1 1 auto">' + LZ.icon("plus") + 'Create order</button>' +
      '<button class="btn" type="button" style="flex:1 1 auto">' + LZ.icon("phone") + "Call</button></div>";
  }
  LZ.on(body, "click", "[data-i]", function (e, b) {
    state.sel = +b.getAttribute("data-i"); draw();
    if (window.matchMedia("(max-width: 1180px)").matches) panel.scrollIntoView({ block: "start" });
  });
  $("#customers-search").addEventListener("input", function (e) { state.q = e.target.value; draw(); });
  draw();
});
