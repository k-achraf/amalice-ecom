/* Orders list */
LZ.page("orders", function () {
  var D = window.LEEZIL_DATA, $ = LZ.$, esc = LZ.esc;
  var state = { status: "All", q: "" };
  var counts = Object.assign({ "All": Object.keys(D.statusCounts).reduce(function (a, k) { return a + D.statusCounts[k]; }, 0) }, D.statusCounts);
  var tabsEl = $("#order-tabs"), body = $("#orders-body"), foot = $("#orders-foot"), bulk = $("#bulkbar");

  function itemsText(o) {
    return o.items.map(function (it) { var p = D.findProduct(it.p); return (p ? p.name : "") + (it.qty > 1 ? " ×" + it.qty : ""); }).join(", ");
  }
  function draw() {
    tabsEl.innerHTML = Object.keys(counts).map(function (k) {
      return '<button class="chip-btn" type="button" role="tab" data-status="' + esc(k) + '" aria-selected="' + (k === state.status) + '">' + esc(k) + '<span class="count">' + counts[k] + "</span></button>";
    }).join("");
    var q = state.q.toLowerCase();
    var rows = D.orders.filter(function (o) {
      return (state.status === "All" || o.status === state.status) && (!q || (o.id + " " + o.name + " " + o.phone + " " + o.wilaya).toLowerCase().indexOf(q) > -1);
    });
    body.innerHTML = rows.length ? rows.map(function (o) {
      var t = D.orderTotals(o);
      return '<tr class="clickable" data-href="order.html?id=' + o.id + '"><td><input type="checkbox" class="sel" aria-label="Select order ' + esc(o.id) + '"></td>' +
        '<td><a class="link-cell" href="order.html?id=' + o.id + '">#' + esc(o.id) + '</a><span class="sub">' + esc(o.date) + "</span></td>" +
        "<td>" + esc(o.name) + '<span class="sub">' + esc(o.phone) + "</span></td>" +
        "<td>" + esc(o.wilaya) + '<span class="sub">' + esc(o.delivery) + "</span></td><td>" + esc(o.carrier) + '</td><td class="muted">' + esc(itemsText(o)) + "</td>" +
        '<td class="num"><span class="strong">' + LZ.da(t.total) + '</span><span class="sub">Cash on delivery</span></td>' +
        "<td>" + LZ.statusPill(o.status) + '</td><td class="num"><a class="row-btn" href="order.html?id=' + o.id + '" aria-label="Open order ' + esc(o.id) + '">' + LZ.icon("chevron") + "</a></td></tr>";
    }).join("") : '<tr><td colspan="9" class="empty">No orders match this filter.</td></tr>';
    foot.textContent = "Showing " + rows.length + " of " + counts[state.status] + " orders";
    updateBulk();
  }
  function updateBulk() {
    var n = LZ.$$(".sel:checked", body).length;
    bulk.classList.toggle("on", n > 0);
    $("#bulk-count").textContent = n + " selected";
  }
  LZ.on(tabsEl, "click", "[data-status]", function (e, b) { state.status = b.getAttribute("data-status"); draw(); });
  LZ.on(body, "click", "tr[data-href]", function (e, tr) {
    if (e.target.closest("a, input, button")) return;
    location.href = tr.getAttribute("data-href");
  });
  body.addEventListener("change", updateBulk);
  $("#orders-search").addEventListener("input", function (e) { state.q = e.target.value; draw(); });
  $("#select-all").addEventListener("change", function (e) {
    LZ.$$(".sel", body).forEach(function (c) { c.checked = e.target.checked; });
    updateBulk();
  });
  LZ.$$("[data-bulk]", bulk).forEach(function (b) {
    b.addEventListener("click", function () { LZ.toast(b.getAttribute("data-bulk")); });
  });
  draw();
});
