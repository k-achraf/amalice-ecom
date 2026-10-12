/* Shipping companies */
LZ.page("shipping-companies", function () {
  var D = window.LEEZIL_DATA, $ = LZ.$, esc = LZ.esc;
  var carriers = JSON.parse(JSON.stringify(D.carriers));

  function logo(c, big) {
    return '<span class="app-logo" style="background:' + c.color + ";color:" + (c.textColor || "#F1EDE2") + (c.color === "#F1EDE2" ? ";border:1px solid var(--line)" : "") + (big ? "" : ";width:40px;height:40px") + '" aria-hidden="true">' + esc(c.short) + "</span>";
  }

  function drawKpis() {
    var con = carriers.filter(function (c) { return c.connected; });
    var active = con.reduce(function (s, c) { return s + (c.active || 0); }, 0);
    $("#sc-kpis").innerHTML =
      '<div class="kpi dark"><span class="label">Parcels with companies</span><span class="value">' + active + '</span><span class="meta">45 out for delivery today</span></div>' +
      '<div class="kpi"><span class="label">Delivery success</span><span class="value">89%</span><span class="meta">Last 30 days, all companies</span></div>' +
      '<div class="kpi"><span class="label">Cash to receive</span><span class="value">412,600 <small>DA</small></span><span class="meta">Collected, not paid out yet</span></div>' +
      '<div class="kpi"><span class="label">Connected</span><span class="value">' + con.length + '</span><span class="meta">of ' + carriers.length + " companies</span></div>";
  }

  function draw() {
    $("#connected").innerHTML = carriers.filter(function (c) { return c.connected; }).map(function (c) {
      var i = carriers.indexOf(c);
      return '<article class="carrier' + (c.isDefault ? " is-default" : "") + '">' +
        '<div class="head">' + logo(c) + '<div class="grow"><h3 style="font-size:15px">' + esc(c.name) + '</h3><span class="muted">' + (c.manual ? "Manual delivery" : "Account " + esc(c.account)) + "</span></div>" +
        (c.isDefault ? LZ.pill("Default", "solid") : LZ.pill("Connected", "connected")) + "</div>" +
        '<div class="body"><div class="stats">' +
          "<div><span>Success</span><b>" + (c.rate ? c.rate + "%" : "—") + "</b></div>" +
          "<div><span>Avg delay</span><b>" + (c.avgDays ? c.avgDays + " d" : "—") + "</b></div>" +
          "<div><span>Active</span><b>" + (c.active || 0) + "</b></div></div>" +
          '<dl class="details" style="font-size:13px"><dt>Coverage</dt><dd>' + c.coverage + " wilayas · " + c.deskPoints + " stop desks</dd><dt>Cash payout</dt><dd>" + esc(c.cod || "—") + "</dd></dl></div>" +
        '<div class="foot"><button class="btn btn-sm" type="button" data-set="' + i + '">' + LZ.icon("settings") + "Settings</button>" +
        (c.isDefault ? "" : '<button class="btn btn-sm btn-ghost" type="button" data-default="' + i + '">Make default</button>') + "</div></article>";
    }).join("");
    $("#available").innerHTML = carriers.filter(function (c) { return !c.connected; }).map(function (c) {
      var i = carriers.indexOf(c);
      return '<article class="carrier"><div class="head">' + logo(c) + '<div class="grow"><h3 style="font-size:15px">' + esc(c.name) + '</h3><span class="muted">' +
        (c.manual ? "Use your own couriers" : c.coverage + " wilayas covered") + "</span></div></div>" +
        '<div class="body"><p class="muted" style="line-height:1.55">' + (c.manual ? "Assign orders to your own delivery people and track cash collected by each one." : "Create parcels, print labels and get tracking updates automatically.") + "</p></div>" +
        '<div class="foot"><button class="btn btn-sm btn-primary" type="button" data-connect="' + i + '">' + LZ.icon("link") + (c.manual ? "Set up" : "Connect") + "</button></div></article>";
    }).join("");
    drawRules();
  }

  var rules = { A: ["Yalidine", "Yalidine", "ZR Express"], B: ["Yalidine", "ZR Express", "Maystro Delivery"], C: ["Yalidine", "Yalidine", "ZR Express"], D: ["ZR Express", "Yalidine", "Yalidine"], E: ["Yalidine", "Yalidine", "None"] };
  function drawRules() {
    var opts = carriers.filter(function (c) { return c.connected; }).map(function (c) { return c.name; });
    function sel(z, i, label) {
      var list = i === 2 ? ["None"].concat(opts) : opts;
      return '<select class="select sm" data-z="' + z + '" data-k="' + i + '" aria-label="' + esc(label) + '">' + list.map(function (o) { return "<option" + (o === rules[z][i] ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select>";
    }
    $("#rules-body").innerHTML = Object.keys(D.zones).map(function (z) {
      return '<tr><td style="padding-left:20px"><b style="font-weight:600">Zone ' + z + '</b><span class="sub">' + esc(D.zones[z].name) + "</span></td>" +
        "<td>" + sel(z, 0, "Home delivery company for zone " + z) + "</td><td>" + sel(z, 1, "Stop desk company for zone " + z) + "</td><td>" + sel(z, 2, "Backup company for zone " + z) + "</td></tr>";
    }).join("");
  }
  $("#rules-body").addEventListener("change", function (e) { var t = e.target; rules[t.dataset.z][+t.dataset.k] = t.value; });
  $("#save-rules").addEventListener("click", function () { LZ.toast("Assignment saved"); });

  function openSettings(c, connecting) {
    var creds = c.manual
      ? '<div class="field"><label for="m-names">Delivery people</label><textarea class="textarea" id="m-names" style="min-height:80px" placeholder="One name per line"></textarea></div>' +
        '<div class="field"><label for="m-w">Wilayas you deliver to</label><select class="select" id="m-w"><option>Alger only</option><option>Alger, Blida, Boumerdès, Tipaza</option></select></div>'
      : '<div class="field"><label for="k1">' + esc(c.keyHint.split(" + ")[0]) + '</label><input class="input mono" id="k1" value="' + (connecting ? "" : "••••••••••••3f9a") + '"></div>' +
        (c.keyHint.indexOf("+") > -1 ? '<div class="field"><label for="k2">' + esc(c.keyHint.split(" + ")[1]) + '</label><input class="input mono" id="k2" type="password" value="' + (connecting ? "" : "secretsecret") + '"></div>' : "") +
        '<span class="hint">Find these in your ' + esc(c.name) + " dashboard, under API or Developers.</span>";
    LZ.open({
      kind: "drawer", title: (connecting ? "Connect " : "") + c.name,
      body: '<div class="prod">' + logo(c, true) + '<div class="grow"><b style="font-weight:600">' + esc(c.name) + '</b><span class="sub">' + (c.connected ? "Connected" : "Not connected") + "</span></div></div>" +
        '<div class="stack" style="gap:14px"><h3 style="font-size:14px">' + (c.manual ? "Team" : "API access") + "</h3>" + creds + "</div>" +
        '<hr class="divider">' +
        '<div class="stack" style="gap:14px"><h3 style="font-size:14px">Pickup</h3>' +
          '<div class="field"><label for="p-a">Pickup address</label><input class="input" id="p-a" value="Leezil — Bab Ezzouar, Alger"></div>' +
          '<div class="grid-2"><div class="field"><label for="p-d">Drop-off</label><select class="select" id="p-d"><option>They pick up from us</option><option>We drop at their agency</option></select></div>' +
          '<div class="field"><label for="p-t">Pickup time</label><select class="select" id="p-t"><option>Every day 10:00</option><option>Every day 15:00</option><option>On request</option></select></div></div></div>' +
        '<hr class="divider">' +
        '<div><h3 style="font-size:14px;margin-bottom:6px">Parcel options</h3>' +
          '<div class="setting"><div class="text"><b>Customer can open the parcel</b><span>Fewer returns, the customer checks before paying.</span></div>' + LZ.toggle("", true, "Customer can open the parcel") + "</div>" +
          '<div class="setting"><div class="text"><b>Fragile by default</b></div>' + LZ.toggle("", false, "Fragile by default") + "</div>" +
          '<div class="setting"><div class="text"><b>Declare the product price for insurance</b></div>' + LZ.toggle("", true, "Declare the product price") + "</div>" +
          '<div class="setting"><div class="text"><b>Sync tracking every 30 minutes</b><span>Updates the order status automatically.</span></div>' + LZ.toggle("", true, "Sync tracking") + "</div></div>" +
        (c.connected && !c.manual ? '<hr class="divider"><button class="btn btn-danger" type="button" id="disc">' + LZ.icon("x") + "Disconnect</button>" : ""),
      foot: '<button class="btn" type="button" data-close>Cancel</button>' + (c.manual ? "" : '<button class="btn" type="button" id="test">Test connection</button>') +
        '<button class="btn btn-primary" type="button" id="save">' + (connecting ? "Connect" : "Save") + "</button>",
      onMount: function (el) {
        var t = $("#test", el); if (t) t.addEventListener("click", function () { LZ.toast("Connection works"); });
        $("#save", el).addEventListener("click", function () {
          if (connecting && !c.manual && !$("#k1", el).value.trim()) { $("#k1", el).focus(); LZ.toast("Add your API key first"); return; }
          if (connecting) { c.connected = true; c.account = c.manual ? "" : "leezil"; c.active = 0; c.cod = c.manual ? "Daily (cash in hand)" : "Weekly"; }
          LZ.closeAll(); drawKpis(); draw(); LZ.toast(connecting ? c.name + " connected" : "Settings saved");
        });
        var d = $("#disc", el);
        if (d) d.addEventListener("click", function () {
          if (c.isDefault) { LZ.toast("Choose another default company first"); return; }
          c.connected = false; LZ.closeAll(); drawKpis(); draw(); LZ.toast(c.name + " disconnected");
        });
      }
    });
  }

  LZ.on(document.body, "click", "[data-set]", function (e, b) { openSettings(carriers[+b.getAttribute("data-set")], false); });
  LZ.on(document.body, "click", "[data-connect]", function (e, b) { openSettings(carriers[+b.getAttribute("data-connect")], true); });
  LZ.on(document.body, "click", "[data-default]", function (e, b) {
    carriers.forEach(function (c) { c.isDefault = false; });
    var c = carriers[+b.getAttribute("data-default")]; c.isDefault = true; draw(); LZ.toast(c.name + " is now the default");
  });
  drawKpis(); draw();
});
