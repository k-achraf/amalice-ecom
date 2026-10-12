/* Storefront — themes, store settings, order form */
LZ.page("storefront", function () {
  var D = window.LEEZIL_DATA, $ = LZ.$, esc = LZ.esc;
  var themes = JSON.parse(JSON.stringify(D.themes));

  /* Tabs (remember the last one in the URL hash) */
  function showTab(k) {
    LZ.$$(".tabs [data-tab]").forEach(function (t) { t.setAttribute("aria-selected", t.getAttribute("data-tab") === k); });
    ["themes", "settings", "checkout"].forEach(function (x) { $("#panel-" + x).hidden = x !== k; });
  }
  LZ.on($(".tabs"), "click", "[data-tab]", function (e, b) { var k = b.getAttribute("data-tab"); showTab(k); history.replaceState(null, "", "#" + k); });
  if (/^#(settings|checkout)$/.test(location.hash)) showTab(location.hash.slice(1));

  /* Theme mock preview built from the theme's colours */
  function mock(t, big) {
    var c = t.colors, bg = c[0], ink = c[1], acc = c[2], card = c[3];
    var hero, prods;
    if (t.id === "landing") {
      hero = '<div class="hero" style="flex:1 1 70%;background:' + ink + ';flex-direction:column;align-items:flex-start;justify-content:center">' +
        '<i style="width:40%;background:' + bg + '"></i><i style="width:28%;background:' + bg + ';opacity:.6"></i><i style="width:22%;height:10px;background:' + acc + ';margin-top:4px"></i></div>';
      prods = '<div class="prods" style="grid-template-columns:repeat(3,1fr);flex:1 1 20%">' + [0, 1, 2].map(function () { return '<i style="background:' + card + '"></i>'; }).join("") + "</div>";
    } else if (t.id === "grid") {
      hero = '<div class="hero" style="flex:0 0 22%;background:' + card + '"><i style="width:30%;background:' + ink + '"></i></div>';
      prods = '<div class="prods" style="flex:1 1 60%;grid-template-columns:repeat(5,1fr)">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(function () { return '<i style="background:' + card + ";border:1px solid " + ink + '22"></i>'; }).join("") + "</div>";
    } else {
      hero = '<div class="hero" style="background:' + (t.id === "pine" ? card : ink) + '"><i style="width:34%;background:' + (t.id === "pine" ? bg : bg) + '"></i><i style="width:14%;height:8px;background:' + acc + '"></i></div>';
      prods = '<div class="prods">' + [0, 1, 2, 3].map(function () { return '<i style="background:' + (t.id === "pine" ? card : card) + ";border:1px solid " + ink + '1a"></i>'; }).join("") + "</div>";
    }
    return '<div class="theme-prev" style="background:' + bg + (big ? ";aspect-ratio:auto;height:100%;min-height:220px" : "") + '" aria-hidden="true">' +
      '<div class="tb"><i style="background:' + ink + '"></i><i style="background:' + ink + ';opacity:.5"></i><i style="background:' + ink + ';opacity:.5"></i><i style="background:' + acc + '"></i></div>' + hero + prods + "</div>";
  }
  function palette(t) { return '<span class="palette" aria-label="Theme colours">' + t.colors.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("") + "</span>"; }

  function drawThemes() {
    var cur = themes.filter(function (t) { return t.current; })[0];
    $("#current-theme").innerHTML =
      '<div style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:24px;align-items:stretch" class="cur-grid">' +
        '<div style="border:1px solid var(--line-soft);border-radius:var(--r);overflow:hidden">' + mock(cur, true) + "</div>" +
        '<div class="stack" style="gap:14px;justify-content:center">' +
          '<div>' + LZ.pill("Main theme", "solid") + '</div><h2 id="cur-h" style="font-size:24px">' + esc(cur.name) + '</h2><p class="muted" style="font-size:14px;line-height:1.6">' + esc(cur.desc) + "</p>" +
          '<dl class="details" style="font-size:13px"><dt>Version</dt><dd>' + esc(cur.version) + "</dd><dt>Last edited</dt><dd>Today, 09:40 by Achraf</dd><dt>Colours</dt><dd>" + palette(cur) + "</dd></dl>" +
          '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" type="button" id="customize">' + LZ.icon("palette") + 'Customize</button><button class="btn" type="button" data-preview="' + cur.id + '">' + LZ.icon("eye") + "Preview</button>" +
          '<button class="btn btn-ghost" type="button" id="theme-more">' + LZ.icon("download") + "Download backup</button></div>" +
        "</div></div>";
    $("#theme-grid").innerHTML = themes.filter(function (t) { return !t.current; }).map(function (t) {
      return '<article class="theme-card">' + mock(t) + '<div class="info"><div class="row1"><h3>' + esc(t.name) + "</h3>" + (t.isNew ? LZ.pill("New", "new") : "") + palette(t) + "</div><p>" + esc(t.desc) + "</p>" +
        '<div class="acts"><button class="btn btn-sm" type="button" data-preview="' + t.id + '">' + LZ.icon("eye") + 'Preview</button><button class="btn btn-sm btn-primary" type="button" data-use="' + t.id + '">Set as main theme</button></div></div></article>';
    }).join("");
    $("#customize").addEventListener("click", function () { showTab("settings"); $("#panel-settings").scrollIntoView({ block: "start" }); });
    $("#theme-more").addEventListener("click", function () { LZ.toast("Theme backup downloaded"); });
  }
  function find(id) { return themes.filter(function (t) { return t.id === id; })[0]; }

  LZ.on($("#panel-themes"), "click", "[data-preview]", function (e, b) {
    var t = find(b.getAttribute("data-preview"));
    LZ.open({
      title: "Preview — " + t.name,
      body: '<div style="border:1px solid var(--line-soft);border-radius:var(--r);overflow:hidden">' + mock(t, true) + '</div><p class="muted" style="font-size:14px;line-height:1.6">' + esc(t.desc) + "</p>",
      foot: '<button class="btn" type="button" data-close>Close</button>' + (t.current ? "" : '<button class="btn btn-primary" type="button" data-use-modal="' + t.id + '">Set as main theme</button>'),
      onMount: function (el) { var u = $("[data-use-modal]", el); if (u) u.addEventListener("click", function () { confirmUse(t); }); }
    });
  });
  LZ.on($("#panel-themes"), "click", "[data-use]", function (e, b) { confirmUse(find(b.getAttribute("data-use"))); });
  function confirmUse(t) {
    LZ.open({
      title: "Use " + t.name + " as the main theme?",
      body: '<p style="line-height:1.6">Visitors will see <b>' + esc(t.name) + "</b> right away. Your products, pages and order form stay the same; colours and layout change.</p>" +
        '<label class="check"><input type="checkbox" checked id="keep-colors"><span>Keep my brand colours (Teal, Ivory, Brass)</span></label>',
      foot: '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="use-ok">Publish theme</button>',
      onMount: function (el) {
        $("#use-ok", el).addEventListener("click", function () {
          themes.forEach(function (x) { x.current = x.id === t.id; });
          LZ.closeAll(); drawThemes(); window.scrollTo({ top: 0 }); LZ.toast(t.name + " is now live on leezil.com");
        });
      }
    });
  }

  /* Store settings */
  var bar = LZ.saveBar($("#panel-settings"), null, "Store settings changed");
  LZ.$$("[data-mirror]").forEach(function (txt) {
    var picker = $("#" + txt.getAttribute("data-mirror"));
    picker.addEventListener("input", function () { txt.value = picker.value.toUpperCase(); annPreview(); });
    txt.addEventListener("input", function () { if (/^#[0-9a-f]{6}$/i.test(txt.value)) { picker.value = txt.value; annPreview(); } });
  });
  function annPreview() {
    var styles = { Teal: [$("#c-primary").value, "#F1EDE2"], Brass: [$("#c-accent").value, "#0E2928"], Pine: ["#0E2928", "#F1EDE2"] }[$("#an-style").value];
    var p = $("#an-preview");
    p.style.display = $("#an-on").checked ? "" : "none";
    p.style.background = styles[0]; p.style.color = styles[1];
    p.textContent = $("#an-text").value;
  }
  ["#an-text", "#an-style", "#an-on"].forEach(function (s) { $(s).addEventListener("input", annPreview); $(s).addEventListener("change", annPreview); });
  annPreview();

  /* Order form fields */
  var fields = [
    { label: "Full name", shown: true, req: true, lock: true },
    { label: "Phone number", shown: true, req: true, lock: true },
    { label: "Second phone number", shown: true, req: false },
    { label: "Wilaya", shown: true, req: true, lock: true },
    { label: "Commune", shown: true, req: true },
    { label: "Address", shown: true, req: false },
    { label: "Home / stop desk choice", shown: true, req: true },
    { label: "Email", shown: false, req: false },
    { label: "Note for the order", shown: true, req: false }
  ];
  var form2 = $("#panel-checkout");
  LZ.saveBar(form2, null, "Order form changed");
  function drawFields() {
    $("#fields-body").innerHTML = fields.map(function (f, i) {
      return "<tr><td>" + esc(f.label) + (f.lock ? ' <span class="muted">(always)</span>' : "") + "</td>" +
        '<td><input type="checkbox" data-i="' + i + '" data-k="shown"' + (f.shown ? " checked" : "") + (f.lock ? " disabled" : "") + ' aria-label="Show ' + esc(f.label) + '"></td>' +
        '<td><input type="checkbox" data-i="' + i + '" data-k="req"' + (f.req ? " checked" : "") + (f.lock || !f.shown ? " disabled" : "") + ' aria-label="Require ' + esc(f.label) + '"></td></tr>';
    }).join("");
    $("#form-preview").innerHTML = '<b style="font-weight:600">Commander maintenant — paiement à la livraison</b>' + fields.filter(function (f) { return f.shown; }).map(function (f) {
      var isChoice = /stop desk/.test(f.label);
      return isChoice
        ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><span style="border:1px solid var(--teal);background:var(--white);border-radius:4px;padding:10px;font-size:13px;text-align:center">À domicile</span><span style="border:1px solid var(--line);background:var(--white);border-radius:4px;padding:10px;font-size:13px;text-align:center">Stop desk</span></div>'
        : '<span style="border:1px solid var(--line);background:var(--white);border-radius:4px;padding:10px;font-size:13px;color:var(--text-2)">' + esc(f.label) + (f.req ? " *" : "") + "</span>";
    }).join("") + '<span style="background:var(--teal);color:var(--ivory);text-align:center;padding:12px;border-radius:4px;font-weight:600">Confirmer la commande</span>';
  }
  $("#fields-body").addEventListener("change", function (e) {
    var t = e.target, f = fields[+t.dataset.i];
    f[t.dataset.k] = t.checked; if (!f.shown) f.req = false; drawFields();
  });
  $("#view-store").addEventListener("click", function (e) { e.preventDefault(); LZ.toast("Opening leezil.com"); });

  drawThemes(); drawFields();
});
