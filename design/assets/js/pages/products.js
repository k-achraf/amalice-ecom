/* Products list */
LZ.page("products", function () {
  var D = window.LEEZIL_DATA, $ = LZ.$, esc = LZ.esc;
  var state = { cat: "All", status: "", q: "" };
  var cats = ["All"].concat(D.categories);
  var tabsEl = $("#cat-tabs"), body = $("#products-body"), bulk = $("#bulkbar");

  function stockInfo(s) {
    if (s === 0) return { label: "Out of stock", cls: "out", color: "#B4533A", key: "out" };
    if (s < 10) return { label: "Low stock", cls: "low", color: "#C9A35E", key: "low" };
    return { label: "In stock", cls: "instock", color: "#18403F", key: "ok" };
  }

  var units = D.products.reduce(function (s, p) { return s + p.stock; }, 0);
  var value = D.products.reduce(function (s, p) { return s + p.stock * p.cost; }, 0);
  $("#product-kpis").innerHTML =
    '<div class="kpi"><span class="label">Products</span><span class="value">' + D.products.length + '</span><span class="meta">' + D.products.filter(function (p) { return p.status === "Draft"; }).length + " draft</span></div>" +
    '<div class="kpi"><span class="label">Units in stock</span><span class="value">' + LZ.money(units) + '</span><span class="meta">Stock value at cost ' + LZ.da(value) + "</span></div>" +
    '<div class="kpi warn"><span class="label">Low stock</span><span class="value">' + D.products.filter(function (p) { return p.stock > 0 && p.stock < 10; }).length + '</span><span class="meta">Fewer than 10 units</span></div>' +
    '<div class="kpi danger"><span class="label">Out of stock</span><span class="value">' + D.products.filter(function (p) { return p.stock === 0; }).length + '</span><span class="meta">Hidden from the store</span></div>';

  function draw() {
    tabsEl.innerHTML = cats.map(function (c) {
      return '<button class="chip-btn" type="button" role="tab" data-cat="' + esc(c) + '" aria-selected="' + (c === state.cat) + '">' + esc(c) + "</button>";
    }).join("");
    var q = state.q.toLowerCase();
    var rows = D.products.filter(function (p) {
      var s = stockInfo(p.stock).key;
      var okStatus = !state.status || p.status === state.status || s === state.status;
      return (state.cat === "All" || p.cat === state.cat) && okStatus && (!q || (p.name + " " + p.sku).toLowerCase().indexOf(q) > -1);
    });
    body.innerHTML = rows.length ? rows.map(function (p) {
      var s = stockInfo(p.stock), pct = Math.min(100, Math.round(p.stock / 150 * 100));
      var href = "product-edit.html?id=" + p.id;
      return '<tr class="clickable" data-href="' + href + '"><td><input type="checkbox" class="sel" aria-label="Select ' + esc(p.name) + '"></td>' +
        '<td><div class="prod"><span class="thumb">' + LZ.icon(p.icon) + '</span><span><a class="link-cell" href="' + href + '">' + esc(p.name) +
        '</a><span class="sub">SKU ' + esc(p.sku) + "</span></span></div></td>" +
        "<td>" + esc(p.cat) + '</td><td class="num"><span class="strong">' + LZ.da(p.price) + "</span>" + (p.compare ? '<span class="sub"><s>' + LZ.da(p.compare) + "</s></span>" : "") + "</td>" +
        '<td><div class="stock"><div class="track"><div style="width:' + (p.stock ? Math.max(pct, 4) : 0) + "%;background:" + s.color + '"></div></div><span>' + p.stock + " units</span></div></td>" +
        '<td class="num">' + p.variants + '</td><td class="num">' + p.sold + "</td>" +
        "<td>" + (p.status === "Draft" ? LZ.pill("Draft", "draft") : LZ.pill(s.label, s.cls)) + "</td>" +
        '<td class="num" style="white-space:nowrap"><a class="row-btn" href="' + href + '" aria-label="Edit ' + esc(p.name) + '">' + LZ.icon("edit") + "</a>" +
        '<button class="row-btn" type="button" data-dup="' + p.id + '" aria-label="Duplicate ' + esc(p.name) + '">' + LZ.icon("copy") + "</button></td></tr>";
    }).join("") : '<tr><td colspan="9" class="empty">No products found.</td></tr>';
    $("#products-foot").textContent = rows.length + " of " + D.products.length + " products";
    updateBulk();
  }
  function updateBulk() {
    var n = LZ.$$(".sel:checked", body).length;
    bulk.classList.toggle("on", n > 0);
    $("#bulk-count").textContent = n + " selected";
  }
  LZ.on(tabsEl, "click", "[data-cat]", function (e, b) { state.cat = b.getAttribute("data-cat"); draw(); });
  LZ.on(body, "click", "tr[data-href]", function (e, tr) { if (!e.target.closest("a, input, button")) location.href = tr.getAttribute("data-href"); });
  LZ.on(body, "click", "[data-dup]", function () { LZ.toast("Product duplicated as draft"); });
  body.addEventListener("change", updateBulk);
  $("#select-all").addEventListener("change", function (e) { LZ.$$(".sel", body).forEach(function (c) { c.checked = e.target.checked; }); updateBulk(); });
  $("#status-filter").addEventListener("change", function (e) { state.status = e.target.value; draw(); });
  $("#products-search").addEventListener("input", function (e) { state.q = e.target.value; draw(); });
  LZ.$$("[data-bulk]", bulk).forEach(function (b) { b.addEventListener("click", function () { LZ.toast(b.getAttribute("data-bulk")); }); });

  $("#import-btn").addEventListener("click", function () {
    LZ.open({
      title: "Import products",
      body: '<p class="muted" style="font-size:14px;line-height:1.6">Upload a CSV file with one product per row. Columns: name, sku, category, price, compare_price, cost, stock, status.</p>' +
        '<label class="dropzone"><svg data-icon="upload" style="width:28px;height:28px"></svg><b>Choose a CSV file</b><span class="muted">or drag it here</span><input type="file" accept=".csv" class="sr"></label>' +
        '<label class="check"><input type="checkbox" checked><span>Update products that already exist (matched by SKU)</span></label>',
      foot: '<a class="btn btn-ghost" href="#">Download template</a><button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-close>Import</button>'
    });
  });
  $("#export-btn").addEventListener("click", function () { LZ.toast("Export started — you'll get the CSV by email"); });
  draw();
});
