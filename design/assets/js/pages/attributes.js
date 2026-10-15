/* Attributes & options */
LZ.page("attributes", function () {
  var D = window.LEEZIL_DATA, $ = LZ.$, esc = LZ.esc;
  var attrs = JSON.parse(JSON.stringify(D.attributes));
  var sel = 0;
  var form = $("#attr-form");
  var TYPE = { color: "Color swatches", text: "Buttons", select: "Dropdown" };

  function cur() { return attrs[sel]; }

  function drawList() {
    $("#attr-count").textContent = attrs.length;
    $("#attr-list").innerHTML = attrs.map(function (a, i) {
      var sw = a.type === "color"
        ? '<span style="display:flex;gap:2px">' + a.options.slice(0, 4).map(function (o) { return '<span class="sw" style="background:' + esc(o.value) + ';width:12px;height:12px;border:1px solid rgba(14,41,40,.12)"></span>'; }).join("") + "</span>"
        : "";
      return '<button type="button" class="attr-item" data-i="' + i + '" aria-current="' + (i === sel) + '"><span class="thumb">' + LZ.icon("layers") + '</span><span class="meta"><b>' + esc(a.name || "Untitled") +
        "</b><span>" + a.options.length + " options · " + TYPE[a.type] + " · " + a.products + " products</span></span>" + sw + "</button>";
    }).join("");
  }

  function drawEditor() {
    var a = cur();
    $("#a-name").value = a.name;
    $("#a-slug").value = a.id;
    LZ.$$('input[name="atype"]').forEach(function (r) { r.checked = r.value === a.type; });
    $("#attr-used").textContent = a.products ? "Used in " + a.products + " products" : "Not used yet";
    drawOptions();
  }

  function drawOptions() {
    var a = cur();
    $("#opt-list").innerHTML = a.options.length ? a.options.map(function (o, i) {
      return '<div class="opt-row" draggable="true" data-row="' + i + '">' +
        '<span class="handle" aria-hidden="true">' + LZ.icon("drag") + "</span>" +
        (a.type === "color" ? '<input type="color" value="' + esc(o.value || "#18403F") + '" data-oi="' + i + '" data-f="value" aria-label="Colour for ' + esc(o.label) + '">' : '<span class="noswatch" aria-hidden="true"></span>') +
        '<input class="input sm" value="' + esc(o.label) + '" data-oi="' + i + '" data-f="label" aria-label="Option name">' +
        '<span class="muted opt-slug mono" style="font-size:12px">' + esc(LZ.slug(o.label)) + "</span>" +
        '<button class="row-btn" type="button" data-rm="' + i + '" aria-label="Remove ' + esc(o.label) + '">' + LZ.icon("trash") + "</button></div>";
    }).join("") : '<p class="muted">No options yet. Add the first one below.</p>';
    drawPreview();
  }

  function drawPreview() {
    var a = cur();
    var label = '<div style="font-size:13px;font-weight:500;margin-bottom:8px">' + esc(a.name || "Attribute") + ': <span class="muted">' + esc(a.options[0] ? a.options[0].label : "") + "</span></div>";
    var body;
    if (a.type === "color") body = '<div style="display:flex;gap:8px;flex-wrap:wrap">' + a.options.map(function (o, i) {
      return '<span title="' + esc(o.label) + '" style="width:32px;height:32px;border-radius:4px;background:' + esc(o.value) + ";border:1px solid rgba(14,41,40,.15);" + (i === 0 ? "box-shadow:0 0 0 2px var(--ivory),0 0 0 4px var(--teal)" : "") + '"></span>';
    }).join("") + "</div>";
    else if (a.type === "text") body = '<div style="display:flex;gap:8px;flex-wrap:wrap">' + a.options.map(function (o, i) {
      return '<span style="padding:8px 14px;border-radius:4px;font-size:13px;border:1px solid ' + (i === 0 ? "var(--teal);background:var(--teal);color:var(--ivory)" : "var(--line);background:var(--white)") + '">' + esc(o.label) + "</span>";
    }).join("") + "</div>";
    else body = '<select class="select" style="max-width:260px" aria-label="Preview dropdown">' + a.options.map(function (o) { return "<option>" + esc(o.label) + "</option>"; }).join("") + "</select>";
    $("#preview").innerHTML = label + body;
  }

  function addOption() {
    var v = $("#new-opt").value.trim(); if (!v) return;
    cur().options.push({ label: v, value: cur().type === "color" ? "#557A6E" : undefined });
    $("#new-opt").value = ""; drawOptions(); drawList();
  }

  LZ.on($("#attr-list"), "click", "[data-i]", function (e, b) {
    sel = +b.getAttribute("data-i"); drawList(); drawEditor();
    if (window.matchMedia("(max-width: 1180px)").matches) form.scrollIntoView({ block: "start" });
  });
  $("#a-name").addEventListener("input", function (e) { cur().name = e.target.value; drawList(); drawPreview(); });
  $("#a-slug").addEventListener("input", function (e) { cur().id = LZ.slug(e.target.value); });
  LZ.$$('input[name="atype"]').forEach(function (r) {
    r.addEventListener("change", function () {
      cur().type = r.value;
      cur().options.forEach(function (o) { if (r.value === "color" && !o.value) o.value = "#9DB3AA"; });
      drawOptions(); drawList();
    });
  });
  $("#opt-list").addEventListener("input", function (e) {
    var t = e.target; if (!t.dataset.oi) return;
    cur().options[+t.dataset.oi][t.dataset.f] = t.value;
    if (t.dataset.f === "label") t.parentNode.querySelector(".opt-slug").textContent = LZ.slug(t.value);
    drawPreview(); if (t.dataset.f === "value") drawList();
  });
  LZ.on($("#opt-list"), "click", "[data-rm]", function (e, b) { cur().options.splice(+b.getAttribute("data-rm"), 1); drawOptions(); drawList(); });
  $("#add-opt").addEventListener("click", addOption);
  $("#new-opt").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addOption(); } });

  // Drag to reorder options
  var dragFrom = null;
  $("#opt-list").addEventListener("dragstart", function (e) { var r = e.target.closest("[data-row]"); if (r) { dragFrom = +r.dataset.row; e.dataTransfer.effectAllowed = "move"; } });
  $("#opt-list").addEventListener("dragover", function (e) { if (dragFrom !== null) e.preventDefault(); });
  $("#opt-list").addEventListener("drop", function (e) {
    var r = e.target.closest("[data-row]"); if (!r || dragFrom === null) return;
    e.preventDefault();
    var opts = cur().options, to = +r.dataset.row;
    opts.splice(to, 0, opts.splice(dragFrom, 1)[0]);
    dragFrom = null; drawOptions(); drawList();
  });

  $("#add-attr").addEventListener("click", function () {
    attrs.push({ id: "new-attribute", name: "", type: "text", products: 0, options: [] });
    sel = attrs.length - 1; drawList(); drawEditor(); $("#a-name").focus();
  });
  $("#save-attr").addEventListener("click", function () {
    if (!cur().name.trim()) { $("#a-name").focus(); LZ.toast("Give the attribute a name"); return; }
    if (!cur().id || cur().id === "new-attribute") cur().id = LZ.slug(cur().name);
    drawEditor(); LZ.toast(cur().name + " saved");
  });
  $("#del-attr").addEventListener("click", function () {
    var a = cur();
    LZ.open({
      title: "Delete “" + (a.name || "Untitled") + "”?",
      body: '<p style="line-height:1.6">' + (a.products ? "It is used in <b>" + a.products + " products</b>. Their variants will keep their names but lose the link to this attribute." : "It isn't used by any product.") + "</p>",
      foot: '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="del-ok" style="background:var(--danger);border-color:var(--danger)">Delete</button>',
      onMount: function (el) { $("#del-ok", el).addEventListener("click", function () { attrs.splice(sel, 1); sel = 0; LZ.closeAll(); drawList(); if (attrs.length) drawEditor(); LZ.toast("Attribute deleted"); }); }
    });
  });

  drawList(); drawEditor();
});
