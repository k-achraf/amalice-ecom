/* Shipping rates by wilaya */
LZ.page("shipping-rates", function () {
  var D = window.LEEZIL_DATA, $ = LZ.$, esc = LZ.esc;
  var rows = D.wilayas.map(function (w) { return Object.assign({}, w); });
  var zones = JSON.parse(JSON.stringify(D.zones));
  var state = { zone: "all", q: "" };
  var form = $("#rates-form");
  var bar = LZ.saveBar(form, null, "Shipping rates changed");

  function num(v) { return parseInt(String(v).replace(/[^\d]/g, ""), 10) || 0; }

  function drawZones() {
    $("#zone-cards").innerHTML = Object.keys(zones).map(function (k) {
      var z = zones[k], n = rows.filter(function (r) { return r.zone === k; }).length;
      return '<div class="kpi"><span class="label">Zone ' + k + " · " + esc(z.name) + '</span><span class="value" style="font-size:22px">' + LZ.money(z.home) + ' <small>DA</small></span>' +
        '<span class="meta">Desk ' + LZ.money(z.desk) + " DA · " + n + ' wilayas</span><button class="btn btn-sm" type="button" data-zone-edit="' + k + '" style="align-self:flex-start">Edit zone</button></div>';
    }).join("");
  }

  function draw() {
    var tabs = [["all", "All 58"]].concat(Object.keys(zones).map(function (k) { return [k, "Zone " + k]; }));
    $("#zone-tabs").innerHTML = tabs.map(function (t) {
      return '<button class="chip-btn" type="button" role="tab" data-z="' + t[0] + '" aria-selected="' + (t[0] === state.zone) + '">' + t[1] + "</button>";
    }).join("");
    var q = state.q.toLowerCase();
    var list = rows.filter(function (r) { return (state.zone === "all" || r.zone === state.zone) && (!q || (r.name + " " + r.code).toLowerCase().indexOf(q) > -1); });
    $("#rates-body").innerHTML = list.map(function (r) {
      var i = rows.indexOf(r);
      return "<tr" + (r.enabled ? "" : ' style="opacity:.55"') + '><td><input type="checkbox" class="sel" data-i="' + i + '" aria-label="Select ' + esc(r.name) + '"></td>' +
        '<td><span class="strong mono">' + String(r.code).padStart(2, "0") + "</span> " + esc(r.name) + "</td>" +
        "<td>" + LZ.pill("Zone " + r.zone, "outline") + "</td>" +
        '<td><div class="input-group" style="width:130px"><input class="input sm" data-i="' + i + '" data-f="home" value="' + r.home + '" aria-label="Home delivery price for ' + esc(r.name) + '"><span class="addon">DA</span></div></td>' +
        "<td>" + (r.desk === null
          ? '<button class="btn btn-sm btn-ghost" type="button" data-adddesk="' + i + '">' + LZ.icon("plus") + "Add</button>"
          : '<div class="input-group" style="width:130px"><input class="input sm" data-i="' + i + '" data-f="desk" value="' + r.desk + '" aria-label="Stop desk price for ' + esc(r.name) + '"><span class="addon">DA</span></div>') + "</td>" +
        '<td><input class="input sm" style="width:80px" data-i="' + i + '" data-f="days" value="' + esc(r.days) + '" aria-label="Delay in days for ' + esc(r.name) + '"> <span class="muted">days</span></td>' +
        "<td>" + LZ.toggle("", r.enabled, "Deliver to " + r.name).replace("<input", '<input data-i="' + i + '" data-f="enabled"') + "</td></tr>";
    }).join("");
    $("#select-all").checked = false;
    updateBulk();
  }

  function updateBulk() {
    var n = LZ.$$(".sel:checked").length;
    $("#bulkbar").classList.toggle("on", n > 0);
    $("#bulk-count").textContent = n + " selected";
  }

  function preview() {
    var w = rows[+$("#pv-w").value], total = num($("#pv-t").value);
    var free = $("#free-on").checked && total >= num($("#free-min").value);
    var home = free ? 0 : w.home, desk = w.desk === null ? null : (free ? 0 : w.desk);
    $("#pv-out").innerHTML = !w.enabled ? '<div class="notice danger">' + LZ.icon("info") + "<span>Delivery to " + esc(w.name) + " is turned off.</span></div>"
      : "<div><span>Home delivery</span><b>" + (home ? LZ.da(home) : "Free") + "</b></div><div><span>Stop desk</span><b>" + (desk === null ? "Not available" : desk ? LZ.da(desk) : "Free") + '</b></div><div><span class="muted">Delay</span><span class="muted">' + esc(w.days) + " days</span></div>";
  }
  $("#pv-w").innerHTML = rows.map(function (r, i) { return '<option value="' + i + '"' + (r.name === "Oran" ? " selected" : "") + ">" + String(r.code).padStart(2, "0") + " — " + esc(r.name) + "</option>"; }).join("");
  ["#pv-w", "#pv-t", "#free-on", "#free-min"].forEach(function (s) { $(s).addEventListener("input", preview); $(s).addEventListener("change", preview); });

  $("#rates-body").addEventListener("change", function (e) {
    var t = e.target; if (t.classList.contains("sel")) { updateBulk(); return; }
    if (!t.dataset.f) return;
    var r = rows[+t.dataset.i];
    if (t.dataset.f === "enabled") { r.enabled = t.checked; draw(); }
    else if (t.dataset.f === "days") r.days = t.value;
    else r[t.dataset.f] = num(t.value);
    preview();
  });
  LZ.on($("#rates-body"), "click", "[data-adddesk]", function (e, b) { var r = rows[+b.getAttribute("data-adddesk")]; r.desk = zones[r.zone].desk; draw(); bar.dirty(); });
  LZ.on($("#zone-tabs"), "click", "[data-z]", function (e, b) { state.zone = b.getAttribute("data-z"); draw(); });
  $("#w-search").addEventListener("input", function (e) { state.q = e.target.value; draw(); });
  $("#select-all").addEventListener("change", function (e) { LZ.$$(".sel").forEach(function (c) { c.checked = e.target.checked; }); updateBulk(); });
  $("#bulk-apply").addEventListener("click", function () {
    var h = num($("#bulk-home").value), d = num($("#bulk-desk").value);
    LZ.$$(".sel:checked").forEach(function (c) { var r = rows[+c.dataset.i]; if (h) r.home = h; if (d && r.desk !== null) r.desk = d; });
    draw(); bar.dirty(); preview(); LZ.toast("Prices updated");
  });
  $("#bulk-off").addEventListener("click", function () { LZ.$$(".sel:checked").forEach(function (c) { rows[+c.dataset.i].enabled = false; }); draw(); bar.dirty(); });

  LZ.on($("#zone-cards"), "click", "[data-zone-edit]", function (e, b) {
    var k = b.getAttribute("data-zone-edit"), z = zones[k];
    LZ.open({
      title: "Zone " + k + " — " + z.name,
      body: '<p class="muted" style="font-size:14px;line-height:1.6">New prices apply to every wilaya in this zone. Wilayas you changed by hand are overwritten.</p>' +
        '<div class="grid-2"><div class="field"><label for="z-h">Home delivery</label><div class="input-group"><input class="input" id="z-h" value="' + z.home + '"><span class="addon">DA</span></div></div>' +
        '<div class="field"><label for="z-d">Stop desk</label><div class="input-group"><input class="input" id="z-d" value="' + z.desk + '"><span class="addon">DA</span></div></div></div>' +
        '<div class="field"><label for="z-t">Delay</label><div class="input-group"><input class="input" id="z-t" value="' + esc(z.days) + '"><span class="addon">days</span></div></div>',
      foot: '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="z-ok">Apply to zone</button>',
      onMount: function (el) {
        $("#z-ok", el).addEventListener("click", function () {
          z.home = num($("#z-h", el).value); z.desk = num($("#z-d", el).value); z.days = $("#z-t", el).value;
          rows.forEach(function (r) { if (r.zone === k) { r.home = z.home; if (r.desk !== null) r.desk = z.desk; r.days = z.days; } });
          LZ.closeAll(); drawZones(); draw(); preview(); bar.dirty(); LZ.toast("Zone " + k + " updated");
        });
      }
    });
  });
  $("#import-rates").addEventListener("click", function () {
    LZ.open({
      title: "Copy rates from a shipping company",
      body: '<p class="muted" style="font-size:14px;line-height:1.6">Use the company’s own prices as your delivery prices. You can add a margin on top.</p>' +
        '<div class="field"><label for="c-c">Company</label><select class="select" id="c-c">' + D.carriers.filter(function (c) { return c.connected; }).map(function (c) { return "<option>" + esc(c.name) + "</option>"; }).join("") + "</select></div>" +
        '<div class="field"><label for="c-m">Add a margin</label><div class="input-group"><input class="input" id="c-m" value="0"><span class="addon">DA</span></div></div>',
      foot: '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="c-ok">Copy rates</button>',
      onMount: function (el) { $("#c-ok", el).addEventListener("click", function () { LZ.closeAll(); bar.dirty(); LZ.toast("Rates copied from " + $("#c-c", el).value); }); }
    });
  });

  drawZones(); draw(); preview();
});
