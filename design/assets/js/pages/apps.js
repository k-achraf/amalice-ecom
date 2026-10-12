/* Apps — catalogue + per-app settings drawer */
LZ.page("apps", function () {
  var D = window.LEEZIL_DATA, $ = LZ.$, esc = LZ.esc;
  var apps = JSON.parse(JSON.stringify(D.apps));
  var state = { view: "all", cat: "All", q: "" };
  var cats = ["All"].concat(apps.map(function (a) { return a.cat; }).filter(function (c, i, arr) { return arr.indexOf(c) === i; }));

  function logo(a) { return '<span class="app-logo" style="background:' + a.color + ";color:" + (a.textColor || "#F1EDE2") + '" aria-hidden="true">' + esc(a.short) + "</span>"; }

  function draw() {
    $("#installed-tab").innerHTML = "Installed <span class=\"pill neutral\" style=\"margin-left:4px\">" + apps.filter(function (a) { return a.installed; }).length + "</span>";
    $("#app-cats").innerHTML = cats.map(function (c) {
      return '<button class="chip-btn" type="button" role="tab" data-c="' + esc(c) + '" aria-selected="' + (c === state.cat) + '">' + esc(c) + "</button>";
    }).join("");
    var q = state.q.toLowerCase();
    var list = apps.filter(function (a) {
      return (state.view === "all" || a.installed) && (state.cat === "All" || a.cat === state.cat) && (!q || (a.name + " " + a.desc).toLowerCase().indexOf(q) > -1);
    });
    $("#app-grid").innerHTML = list.length ? list.map(function (a) {
      var foot = a.installed
        ? '<label class="switch"><input type="checkbox" data-enable="' + a.id + '"' + (a.enabled ? " checked" : "") + ' aria-label="Enable ' + esc(a.name) + '"><span></span></label>' +
          '<span class="grow muted">' + (a.enabled ? "On" : "Off") + "</span>" +
          '<button class="btn btn-sm" type="button" data-settings="' + a.id + '">' + LZ.icon("settings") + "Settings</button>"
        : '<span class="grow muted">Free</span><button class="btn btn-sm btn-primary" type="button" data-install="' + a.id + '">' + LZ.icon("plus") + "Install</button>";
      return '<article class="app-card"><div class="top">' + logo(a) + '<div class="grow"><h3>' + esc(a.name) + '</h3><span class="by">by ' + esc(a.by) + "</span></div>" +
        (a.installed ? LZ.pill("Installed", "installed") : LZ.pill(a.cat, "outline")) + "</div><p>" + esc(a.desc) + '</p><div class="foot">' + foot + "</div></article>";
    }).join("") : '<p class="empty" style="grid-column:1/-1">No apps match your search.</p>';
  }

  function field(s, i) {
    var id = "s-" + i;
    if (s.type === "text") return '<div class="field"><label for="' + id + '">' + esc(s.label) + '</label><input class="input" id="' + id + '" data-k="' + s.key + '" type="' + (s.secret ? "password" : "text") + '" value="' + esc(s.value) + '">' + (s.hint ? '<span class="hint">' + esc(s.hint) + "</span>" : "") + "</div>";
    if (s.type === "textarea") return '<div class="field"><label for="' + id + '">' + esc(s.label) + '</label><textarea class="textarea" id="' + id + '" data-k="' + s.key + '">' + esc(s.value) + "</textarea></div>";
    if (s.type === "select") return '<div class="field"><label for="' + id + '">' + esc(s.label) + '</label><select class="select" id="' + id + '" data-k="' + s.key + '">' + s.options.map(function (o) { return "<option" + (o === s.value ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select></div>";
    if (s.type === "toggle") return '<div class="setting"><div class="text"><b>' + esc(s.label) + '</b></div><label class="switch"><input type="checkbox" data-k="' + s.key + '"' + (s.value ? " checked" : "") + ' aria-label="' + esc(s.label) + '"><span></span></label></div>';
    if (s.type === "checks") return '<fieldset style="border:0;padding:0;margin:0"><legend class="strong" style="font-size:13px;margin-bottom:8px">' + esc(s.label) + '</legend><div class="grid-2" style="gap:8px">' +
      s.options.map(function (o) { return '<label class="check"><input type="checkbox" data-k="' + s.key + '" value="' + esc(o) + '"' + (s.value.indexOf(o) > -1 ? " checked" : "") + "><span>" + esc(o) + "</span></label>"; }).join("") + "</div></fieldset>";
    return "";
  }

  function openSettings(a, justInstalled) {
    LZ.open({
      kind: "drawer", id: "app-drawer", title: a.name,
      body: '<div class="prod">' + logo(a) + '<div class="grow"><b style="font-weight:600">' + esc(a.name) + '</b><span class="sub">by ' + esc(a.by) + " · " + esc(a.cat) + "</span></div></div>" +
        (justInstalled ? '<div class="notice">' + LZ.icon("check") + "<span><b>Installed.</b> Fill in the settings below to start using it.</span></div>" : "") +
        '<p class="muted" style="line-height:1.6;font-size:14px">' + esc(a.desc) + "</p>" +
        '<div class="setting"><div class="text"><b>App enabled</b><span>Turn off to pause it without losing the settings.</span></div><label class="switch"><input type="checkbox" id="app-on"' + (a.enabled ? " checked" : "") + ' aria-label="App enabled"><span></span></label></div>' +
        '<hr class="divider">' +
        '<div class="stack" style="gap:14px" id="app-fields">' + a.settings.map(field).join("") + "</div>" +
        '<hr class="divider"><button class="btn btn-danger" type="button" id="uninstall">' + LZ.icon("trash") + "Uninstall app</button>",
      foot: '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="app-save">Save settings</button>',
      onMount: function (el) {
        $("#app-save", el).addEventListener("click", function () {
          a.settings.forEach(function (s) {
            if (s.type === "checks") s.value = LZ.$$('input[data-k="' + s.key + '"]:checked', el).map(function (c) { return c.value; });
            else if (s.type === "toggle") s.value = $('[data-k="' + s.key + '"]', el).checked;
            else s.value = $('[data-k="' + s.key + '"]', el).value;
          });
          a.enabled = $("#app-on", el).checked;
          LZ.closeAll(); draw(); LZ.toast(a.name + " settings saved");
        });
        $("#uninstall", el).addEventListener("click", function () { a.installed = false; a.enabled = false; LZ.closeAll(); draw(); LZ.toast(a.name + " uninstalled"); });
      }
    });
  }

  function find(id) { return apps.filter(function (a) { return a.id === id; })[0]; }
  LZ.on($(".tabs"), "click", "[data-view]", function (e, b) {
    LZ.$$(".tabs [data-view]").forEach(function (t) { t.setAttribute("aria-selected", t === b); });
    state.view = b.getAttribute("data-view"); draw();
  });
  LZ.on($("#app-cats"), "click", "[data-c]", function (e, b) { state.cat = b.getAttribute("data-c"); draw(); });
  $("#app-search").addEventListener("input", function (e) { state.q = e.target.value; draw(); });
  LZ.on($("#app-grid"), "click", "[data-settings]", function (e, b) { openSettings(find(b.getAttribute("data-settings"))); });
  LZ.on($("#app-grid"), "click", "[data-install]", function (e, b) {
    var a = find(b.getAttribute("data-install")); a.installed = true; a.enabled = true; draw(); openSettings(a, true);
  });
  $("#app-grid").addEventListener("change", function (e) {
    var id = e.target.getAttribute("data-enable"); if (!id) return;
    var a = find(id); a.enabled = e.target.checked; draw(); LZ.toast(a.name + (a.enabled ? " turned on" : " turned off"));
  });
  draw();
});
