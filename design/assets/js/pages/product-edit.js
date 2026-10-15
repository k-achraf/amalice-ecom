/* Product create / edit — product-edit.html?id=3 edits, no id creates */
LZ.page("product-edit", function () {
  var D = window.LEEZIL_DATA, $ = LZ.$, esc = LZ.esc;
  var form = $("#product-form");
  var id = +LZ.param("id");
  var p = id ? D.findProduct(id) : null;
  var isNew = !p;

  /* ---------- Header ---------- */
  var name = p ? p.name : "New product";
  document.title = name + " — Leezil Admin";
  $("#crumb-name").textContent = name;
  $("#page-title").innerHTML = esc(name) + (p ? " " + (p.status === "Draft" ? LZ.pill("Draft", "draft") : LZ.pill("Active", "active")) : "");
  $("#head-actions").innerHTML = isNew
    ? '<a class="btn" href="products.html">Cancel</a><button class="btn" type="button" data-save="Draft">Save as draft</button><button class="btn btn-primary" type="button" data-save="Active">' + LZ.icon("check") + "Publish</button>"
    : '<button class="btn hide-sm" type="button" id="preview-btn">' + LZ.icon("eye") + 'Preview</button><button class="btn hide-sm" type="button" id="dup-btn">' + LZ.icon("copy") + 'Duplicate</button><button class="btn btn-danger" type="button" id="del-btn">' + LZ.icon("trash") + "Delete</button>";

  /* ---------- Fill fields ---------- */
  $("#p-cat").innerHTML = '<option value="">Choose a category</option>' + D.categories.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("");
  if (p) {
    form.name.value = p.name; form.desc.value = p.desc; form.price.value = p.price; form.compare.value = p.compare || "";
    form.cost.value = p.cost; form.sku.value = p.sku; form.stock.value = p.stock; form.status.value = p.status; form.cat.value = p.cat;
    form.seoTitle.value = p.name + " — Leezil"; form.seoDesc.value = p.desc; form.slug.value = LZ.slug(p.name);
    $("#perf-card").hidden = false;
    $("#pf-sold").textContent = p.sold;
    $("#pf-rev").textContent = LZ.da(p.sold * p.price);
  }

  /* ---------- Pricing calc ---------- */
  function num(v) { return parseFloat(String(v).replace(/[^\d.]/g, "")) || 0; }
  function calc() {
    var price = num(form.price.value), cost = num(form.cost.value), cmp = num(form.compare.value);
    $("#calc-profit").textContent = price ? LZ.da(price - cost) : "—";
    $("#calc-margin").textContent = price ? Math.round((price - cost) / price * 100) + "%" : "—";
    $("#calc-discount").textContent = cmp > price && price ? "−" + Math.round((1 - price / cmp) * 100) + "%" : "—";
  }
  ["price", "cost", "compare"].forEach(function (k) { form[k].addEventListener("input", calc); });
  calc();

  /* ---------- SEO preview ---------- */
  var slugTouched = !isNew;
  function seo() {
    var t = form.seoTitle.value || form.name.value || "Product title";
    var d = form.seoDesc.value || form.desc.value || "Product description";
    if (!slugTouched) form.slug.value = LZ.slug(form.name.value);
    $("#seo-title").textContent = t;
    $("#seo-desc").textContent = d.length > 160 ? d.slice(0, 157) + "…" : d;
    $("#seo-url").textContent = "leezil.com/products/" + (form.slug.value || "");
    $("#seo-title-count").textContent = form.seoTitle.value.length;
    $("#seo-desc-count").textContent = form.seoDesc.value.length;
  }
  form.slug.addEventListener("input", function () { slugTouched = true; });
  ["name", "desc", "seoTitle", "seoDesc", "slug"].forEach(function (k) { form[k].addEventListener("input", seo); });
  seo();

  /* ---------- Tags ---------- */
  var tags = p ? p.tags.slice() : [];
  var tagBox = $("#tag-box"), tagInput = $("#tag-input");
  function drawTags() {
    LZ.$$(".tag", tagBox).forEach(function (t) { t.remove(); });
    tags.forEach(function (t, i) {
      var el = document.createElement("span");
      el.className = "tag";
      el.innerHTML = esc(t) + '<button type="button" data-rm="' + i + '" aria-label="Remove tag ' + esc(t) + '">' + LZ.icon("x", ' style="width:12px;height:12px"') + "</button>";
      tagBox.insertBefore(el, tagInput);
    });
  }
  tagInput.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === ",") && tagInput.value.trim()) {
      e.preventDefault(); tags.push(tagInput.value.trim().replace(/,$/, "")); tagInput.value = ""; drawTags(); bar.dirty();
    } else if (e.key === "Backspace" && !tagInput.value && tags.length) { tags.pop(); drawTags(); bar.dirty(); }
  });
  LZ.on(tagBox, "click", "[data-rm]", function (e, b) { tags.splice(+b.getAttribute("data-rm"), 1); drawTags(); bar.dirty(); });
  drawTags();

  /* ---------- Media ---------- */
  var media = p ? [{ icon: p.icon }, { icon: p.icon }] : [];
  var grid = $("#media-grid");
  function drawMedia() {
    grid.innerHTML = media.map(function (m, i) {
      return '<div class="media">' + (m.url ? '<img src="' + m.url + '" alt="">' : LZ.icon(m.icon)) + (i === 0 ? '<span class="main-tag">Main</span>' : "") +
        '<button class="rm" type="button" data-rm="' + i + '" aria-label="Remove image ' + (i + 1) + '">' + LZ.icon("x") + "</button></div>";
    }).join("");
    grid.style.display = media.length ? "" : "none";
  }
  function addFiles(files) {
    Array.prototype.forEach.call(files, function (f) { if (/^image\//.test(f.type)) media.push({ url: URL.createObjectURL(f) }); });
    drawMedia(); bar.dirty();
  }
  $("#media-input").addEventListener("change", function (e) { addFiles(e.target.files); e.target.value = ""; });
  var dz = $("#dropzone");
  ["dragenter", "dragover"].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (ev) { dz.addEventListener(ev, function () { dz.classList.remove("over"); }); });
  dz.addEventListener("drop", function (e) { e.preventDefault(); addFiles(e.dataTransfer.files); });
  LZ.on(grid, "click", "[data-rm]", function (e, b) { media.splice(+b.getAttribute("data-rm"), 1); drawMedia(); bar.dirty(); });
  drawMedia();

  /* ---------- Variants ---------- */
  var chosen = {};                     // attrId -> [option labels]
  if (p) Object.keys(p.attrs).forEach(function (k) { chosen[k] = p.attrs[k].slice(); });
  var variantData = {};                // combo key -> {price, stock, sku}
  var pickers = $("#attr-pickers"), vwrap = $("#variants-wrap");

  function drawPickers() {
    pickers.innerHTML = D.attributes.map(function (a) {
      var on = !!chosen[a.id];
      return '<div style="border:1px solid var(--line-soft);border-radius:var(--r);padding:12px">' +
        '<label class="check"><input type="checkbox" data-attr="' + a.id + '"' + (on ? " checked" : "") + "><span><b>" + esc(a.name) + '</b><span class="sub">' + a.options.length + " options</span></span></label>" +
        (on ? '<div class="tags" style="margin-top:10px;padding-left:26px">' + a.options.map(function (o) {
          var sel = chosen[a.id].indexOf(o.label) > -1;
          return '<button type="button" class="tag" data-opt="' + a.id + '" data-label="' + esc(o.label) + '" aria-pressed="' + sel + '" style="cursor:pointer;' +
            (sel ? "background:var(--teal);color:var(--ivory);border-color:var(--teal)" : "") + '">' + (o.value ? '<span class="sw" style="background:' + o.value + '"></span>' : "") + esc(o.label) + "</button>";
        }).join("") + "</div>" : "") + "</div>";
    }).join("");
  }
  function combos() {
    var keys = Object.keys(chosen).filter(function (k) { return chosen[k].length; });
    if (!keys.length) return [];
    return keys.reduce(function (acc, k) {
      var out = [];
      acc.forEach(function (a) { chosen[k].forEach(function (v) { out.push(a.concat(v)); }); });
      return out;
    }, [[]]);
  }
  function drawVariants() {
    var list = combos();
    $("#stock-hint").textContent = list.length ? "Stock is set per variant below." : "Used when the product has no variants.";
    form.stock.disabled = !!list.length;
    if (!list.length) { vwrap.innerHTML = ""; return; }
    var base = num(form.price.value), sku = form.sku.value || "LZ";
    vwrap.innerHTML = '<div class="table-wrap"><table style="min-width:560px"><thead><tr><th>Variant</th><th>Price (DA)</th><th>Stock</th><th>SKU</th></tr></thead><tbody>' +
      list.map(function (c, i) {
        var key = c.join(" / ");
        var v = variantData[key] || (variantData[key] = { price: base || "", stock: p ? Math.max(0, Math.round(p.stock / list.length)) : 0, sku: sku + "-" + (i + 1) });
        return '<tr><td class="strong">' + esc(key) + "</td>" +
          '<td><input class="input sm" style="width:110px" data-v="' + esc(key) + '" data-f="price" value="' + esc(v.price) + '" aria-label="Price for ' + esc(key) + '"></td>' +
          '<td><input class="input sm" style="width:80px" data-v="' + esc(key) + '" data-f="stock" value="' + esc(v.stock) + '" aria-label="Stock for ' + esc(key) + '"></td>' +
          '<td><input class="input sm" style="width:150px" data-v="' + esc(key) + '" data-f="sku" value="' + esc(v.sku) + '" aria-label="SKU for ' + esc(key) + '"></td></tr>';
      }).join("") + '</tbody></table></div><p class="muted" style="margin-top:8px">' + list.length + " variant" + (list.length > 1 ? "s" : "") + "</p>";
  }
  LZ.on(pickers, "change", "[data-attr]", function (e, cb) {
    var a = cb.getAttribute("data-attr");
    if (cb.checked) chosen[a] = []; else delete chosen[a];
    drawPickers(); drawVariants();
  });
  LZ.on(pickers, "click", "[data-opt]", function (e, b) {
    var a = b.getAttribute("data-opt"), l = b.getAttribute("data-label"), arr = chosen[a], i = arr.indexOf(l);
    if (i > -1) arr.splice(i, 1); else arr.push(l);
    drawPickers(); drawVariants(); bar.dirty();
  });
  vwrap.addEventListener("input", function (e) {
    var t = e.target; if (!t.dataset.v) return;
    variantData[t.dataset.v][t.dataset.f] = t.value;
  });
  drawPickers(); drawVariants();

  /* ---------- Quantity offers ---------- */
  var offers = p && p.id === 1 ? [{ qty: 2, off: 10 }, { qty: 3, off: 15 }] : [];
  var offersEl = $("#offers");
  function drawOffers() {
    offersEl.innerHTML = offers.length ? offers.map(function (o, i) {
      return '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
        '<span class="muted">Buy</span><input class="input sm" style="width:70px" data-o="' + i + '" data-f="qty" value="' + o.qty + '" aria-label="Quantity">' +
        '<span class="muted">save</span><div class="input-group" style="width:100px"><input class="input sm" data-o="' + i + '" data-f="off" value="' + o.off + '" aria-label="Discount percent"><span class="addon">%</span></div>' +
        '<span class="grow muted" style="font-size:12px">→ ' + LZ.da(Math.round(num(form.price.value) * o.qty * (1 - o.off / 100))) + " total</span>" +
        '<button class="row-btn" type="button" data-rmo="' + i + '" aria-label="Remove offer">' + LZ.icon("trash") + "</button></div>";
    }).join("") : '<p class="muted">No offers yet.</p>';
  }
  $("#add-offer").addEventListener("click", function () { offers.push({ qty: offers.length + 2, off: 10 }); drawOffers(); bar.dirty(); });
  offersEl.addEventListener("change", function (e) { var t = e.target; if (t.dataset.o) { offers[+t.dataset.o][t.dataset.f] = num(t.value); drawOffers(); } });
  LZ.on(offersEl, "click", "[data-rmo]", function (e, b) { offers.splice(+b.getAttribute("data-rmo"), 1); drawOffers(); bar.dirty(); });
  form.price.addEventListener("input", function () { drawOffers(); });
  drawOffers();

  /* ---------- Save / actions ---------- */
  function validate() {
    if (!form.name.value.trim()) { form.name.focus(); form.name.setAttribute("aria-invalid", "true"); LZ.toast("Add a product name first"); return false; }
    form.name.removeAttribute("aria-invalid");
    return true;
  }
  var bar = LZ.saveBar(form, null, isNew ? "New product — not saved yet" : "Unsaved changes");
  LZ.$("[data-save]", bar.bar).addEventListener("click", function (e) { if (!validate()) e.stopImmediatePropagation(); }, true);
  LZ.$$("[data-save]", $("#head-actions")).forEach(function (b) {
    b.addEventListener("click", function () {
      if (!validate()) return;
      bar.bar.classList.remove("on");
      LZ.toast(b.getAttribute("data-save") === "Draft" ? "Saved as draft" : "Product published");
    });
  });
  if (!isNew) {
    $("#preview-btn").addEventListener("click", function () { LZ.toast("Opening the product page on leezil.com"); });
    $("#dup-btn").addEventListener("click", function () { LZ.toast("Copy created as draft"); });
    $("#del-btn").addEventListener("click", function () {
      LZ.open({
        title: "Delete " + p.name + "?",
        body: '<p style="line-height:1.6">The product and its ' + p.variants + " variant" + (p.variants > 1 ? "s" : "") + " will be removed from the store. Past orders keep their details.</p>",
        foot: '<button class="btn" type="button" data-close>Cancel</button><a class="btn btn-primary" href="products.html" style="background:var(--danger);border-color:var(--danger)">Delete product</a>'
      });
    });
  }
});
