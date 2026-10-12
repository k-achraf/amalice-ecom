/* Call center — unconfirmed orders queue */
LZ.page("call-center", function () {
  var D = window.LEEZIL_DATA, $ = LZ.$, esc = LZ.esc;
  var queue = D.callQueue.map(function (q) { return Object.assign({}, q, { o: JSON.parse(JSON.stringify(D.findOrder(q.order))) }); });
  var stats = { confirmed: 19, cancelled: 3, calls: 84 };
  var FILTERS = {
    "All": function () { return true; },
    "Not called": function (q) { return q.attempts === 0; },
    "Call back": function (q) { return q.attempts > 0 && q.attempts < 3; },
    "3+ attempts": function (q) { return q.attempts >= 3; }
  };
  var state = { filter: "All", sel: queue.length ? queue[0].order : null };
  var pre = LZ.param("order");
  if (pre && queue.some(function (q) { return q.order === pre; })) state.sel = pre;

  function current() { return queue.filter(function (q) { return q.order === state.sel; })[0]; }

  function drawKpis() {
    var rate = Math.round(stats.confirmed / (stats.confirmed + stats.cancelled) * 100);
    $("#cc-kpis").innerHTML =
      '<div class="kpi dark"><span class="label">Waiting in queue</span><span class="value">' + queue.length + '</span><span class="meta">Oldest: ' + (queue.length ? esc(queue[queue.length - 1].waiting) : "—") + "</span></div>" +
      '<div class="kpi"><span class="label">Confirmed today</span><span class="value">' + stats.confirmed + '</span><span class="meta">' + stats.cancelled + " cancelled</span></div>" +
      '<div class="kpi"><span class="label">Confirmation rate</span><span class="value">' + rate + '%</span><span class="meta">Target 80%</span></div>' +
      '<div class="kpi"><span class="label">Calls made today</span><span class="value">' + stats.calls + '</span><span class="meta">' + D.callAgents.map(function (a) { return esc(a.name) + " " + a.calls; }).join(" · ") + "</span></div>";
  }

  function drawQueue() {
    $("#q-tabs").innerHTML = Object.keys(FILTERS).map(function (k) {
      var n = queue.filter(FILTERS[k]).length;
      return '<button class="chip-btn" type="button" role="tab" data-f="' + esc(k) + '" aria-selected="' + (k === state.filter) + '">' + esc(k) + '<span class="count">' + n + "</span></button>";
    }).join("");
    var list = queue.filter(FILTERS[state.filter]);
    $("#q-count").textContent = queue.length + " orders";
    $("#queue").innerHTML = list.length ? list.map(function (q) {
      var t = D.orderTotals(q.o);
      var dots = [0, 1, 2].map(function (i) { return '<i class="' + (i < q.attempts ? "on" : "") + '"></i>'; }).join("");
      return '<button type="button" class="queue-item" role="listitem" data-o="' + q.order + '" aria-current="' + (q.order === state.sel) + '">' +
        '<span class="initials">' + LZ.initials(q.o.name) + "</span>" +
        '<span class="meta"><b>' + esc(q.o.name) + "</b><span>#" + esc(q.order) + " · " + esc(q.o.wilaya) + " · " + LZ.da(t.total) + "</span>" +
        "<span>" + (q.lastCall ? esc(q.lastCall) : "Not called yet") + "</span></span>" +
        '<span class="side"><span class="muted">' + esc(q.waiting) + '</span><span class="attempts" title="' + q.attempts + ' call attempts">' + dots + "</span>" +
        (q.priority === "High" ? LZ.pill("High", "new") : "") + "</span></button>";
    }).join("") : '<p class="empty">Nothing here. Good job.</p>';
  }

  function drawWorkspace() {
    var ws = $("#workspace");
    var q = current();
    if (!q) {
      ws.innerHTML = '<div class="empty" style="padding:60px 20px">' + LZ.icon("check", ' style="width:32px;height:32px;color:var(--teal)"') + '<h2 style="font-size:18px;margin-top:10px;color:var(--pine)">Queue is empty</h2><p>Every order has been called.</p></div>';
      return;
    }
    var o = q.o, t = D.orderTotals(o);
    var tel = o.phone.replace(/[^\d+]/g, "");
    ws.innerHTML =
      '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' +
        '<span class="initials lg">' + LZ.initials(o.name) + "</span>" +
        '<div class="grow"><h2 style="font-size:20px">' + esc(o.name) + '</h2><span class="muted">Order <a href="order.html?id=' + o.id + '">#' + esc(o.id) + "</a> · " + esc(o.date) + " · " + esc(o.source) + "</span></div>" +
        '<div style="text-align:right"><div class="phone-big mono">' + esc(o.phone) + '</div><span class="muted">Attempt ' + (q.attempts + 1) + " of 3</span></div>" +
      "</div>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn-primary" href="tel:' + tel + '">' + LZ.icon("phone") + 'Call now</a><a class="btn" href="#">' + LZ.icon("message") + "WhatsApp</a>" +
      '<button class="btn" type="button" id="copy-phone">' + LZ.icon("copy") + "Copy number</button></div>" +
      (q.note ? '<div class="notice warn">' + LZ.icon("note") + "<span>" + esc(q.note) + "</span></div>" : "") +

      '<div class="grid-2" style="align-items:start">' +
        '<div class="stack" style="gap:12px"><h3 style="font-size:14px">Order</h3><div id="ws-items" class="stack" style="gap:10px"></div>' +
        '<div class="totals" id="ws-totals"></div></div>' +
        '<div class="stack" style="gap:12px"><h3 style="font-size:14px">Check the delivery details</h3>' +
          '<div class="field"><label for="ws-w">Wilaya</label><select class="select" id="ws-w">' + D.wilayas.map(function (w) {
            return '<option value="' + esc(w.name) + '"' + (w.name === o.wilaya ? " selected" : "") + ">" + String(w.code).padStart(2, "0") + " — " + esc(w.name) + "</option>";
          }).join("") + "</select></div>" +
          '<div class="grid-2"><div class="field"><label for="ws-c">Commune</label><input class="input" id="ws-c" value="' + esc(o.commune) + '"></div>' +
          '<div class="field"><label for="ws-d">Delivery</label><select class="select" id="ws-d"><option' + (o.delivery === "Home" ? " selected" : "") + ">Home</option><option" + (o.delivery === "Stop desk" ? " selected" : "") + ">Stop desk</option></select></div></div>" +
          '<div class="field"><label for="ws-a">Address</label><input class="input" id="ws-a" value="' + esc(o.address) + '"></div>' +
        "</div>" +
      "</div>" +

      '<details><summary style="cursor:pointer;font-weight:500">Call script</summary><div class="script-box" style="margin-top:10px">' +
        "<b>1.</b> Salam, ici Leezil. Vous avez commandé <b>" + esc(D.findProduct(o.items[0].p).name) + "</b> — c'est bien vous ?<br>" +
        "<b>2.</b> Confirm the colour / size and the quantity.<br>" +
        "<b>3.</b> Confirm the wilaya, commune and address. Home or stop desk?<br>" +
        "<b>4.</b> The total is <b>" + LZ.da(t.total) + "</b>, paid on delivery. Delivery in " + esc((D.wilayas.filter(function (w) { return w.name === o.wilaya; })[0] || { days: "2–3" }).days) + " days.</div></details>" +

      '<div class="field"><label for="ws-note">Call note</label><input class="input" id="ws-note" placeholder="e.g. Wants delivery after 17:00"></div>' +
      '<div class="outcomes" role="group" aria-label="Call result">' +
        '<button class="outcome ok" type="button" data-out="confirmed">' + LZ.icon("check") + "Confirmed</button>" +
        '<button class="outcome" type="button" data-out="noanswer">' + LZ.icon("phoneoff") + "No answer</button>" +
        '<button class="outcome" type="button" data-out="later">' + LZ.icon("clock") + "Call back later</button>" +
        '<button class="outcome bad" type="button" data-out="cancel">' + LZ.icon("x") + "Cancelled</button>" +
      "</div>";
    drawItems();
    ["#ws-w", "#ws-d"].forEach(function (s) { $(s, ws).addEventListener("change", function () { o.wilaya = $("#ws-w").value; o.delivery = $("#ws-d").value; drawItems(); drawQueue(); }); });
    $("#copy-phone", ws).addEventListener("click", function () {
      if (navigator.clipboard) navigator.clipboard.writeText(o.phone).catch(function () {});
      LZ.toast("Number copied");
    });
  }

  function drawItems() {
    var o = current().o, t = D.orderTotals(o);
    $("#ws-items").innerHTML = o.items.map(function (it, i) {
      var p = D.findProduct(it.p);
      return '<div class="prod"><span class="thumb">' + LZ.icon(p.icon) + '</span><span class="grow">' + esc(p.name) + '<span class="sub muted" style="display:block;font-size:12px">' + esc(it.variant || "Default") + " · " + LZ.da(p.price) + "</span></span>" +
        '<span style="display:flex;align-items:center;gap:4px"><button class="icon-btn sm" type="button" data-q="' + i + '" data-d="-1" aria-label="Less">−</button><b style="min-width:20px;text-align:center">' + it.qty +
        '</b><button class="icon-btn sm" type="button" data-q="' + i + '" data-d="1" aria-label="More">+</button></span></div>';
    }).join("");
    $("#ws-totals").innerHTML = "<div><span>Subtotal</span><span>" + LZ.da(t.sub) + "</span></div><div><span>Delivery (" + esc(o.delivery) + ")</span><span>" + LZ.da(t.ship) + '</span></div><div class="grand"><span>To collect</span><span>' + LZ.da(t.total) + "</span></div>";
  }

  function outcome(kind) {
    var q = current(); if (!q) return;
    var note = $("#ws-note").value.trim();
    var i = queue.indexOf(q);
    stats.calls++;
    if (kind === "confirmed" || kind === "cancel") {
      queue.splice(i, 1);
      if (kind === "confirmed") stats.confirmed++; else stats.cancelled++;
      LZ.toast(kind === "confirmed" ? "#" + q.order + " confirmed — ready to ship" : "#" + q.order + " cancelled");
    } else {
      q.attempts++;
      q.lastCall = "Just now · " + (kind === "noanswer" ? "No answer" : "Call back later");
      if (note) q.note = note;
      queue.push(queue.splice(i, 1)[0]); // move to the end
      LZ.toast(kind === "noanswer" ? "No answer — moved to the end of the queue" : "Reminder set — moved to the end of the queue");
    }
    var next = queue.filter(FILTERS[state.filter])[0] || queue[0];
    state.sel = next ? next.order : null;
    drawAll();
  }

  function drawAll() { drawKpis(); drawQueue(); drawWorkspace(); }

  LZ.on($("#q-tabs"), "click", "[data-f]", function (e, b) { state.filter = b.getAttribute("data-f"); drawQueue(); });
  LZ.on($("#queue"), "click", "[data-o]", function (e, b) {
    state.sel = b.getAttribute("data-o"); drawQueue(); drawWorkspace();
    if (window.matchMedia("(max-width: 1180px)").matches) $("#workspace").scrollIntoView({ block: "start" });
  });
  LZ.on($("#workspace"), "click", "[data-out]", function (e, b) {
    var k = b.getAttribute("data-out");
    if (k === "cancel") {
      LZ.open({
        title: "Cancel order #" + current().order + "?",
        body: '<div class="field"><label for="c-r">Reason</label><select class="select" id="c-r"><option>Customer changed their mind</option><option>Fake or test order</option><option>Wrong number</option><option>Price too high</option><option>Ordered twice</option></select></div>',
        foot: '<button class="btn" type="button" data-close>Back</button><button class="btn btn-primary" type="button" id="c-ok" style="background:var(--danger);border-color:var(--danger)">Cancel order</button>',
        onMount: function (el) { $("#c-ok", el).addEventListener("click", function () { LZ.closeAll(); outcome("cancel"); }); }
      });
    } else outcome(k);
  });
  LZ.on($("#workspace"), "click", "[data-q]", function (e, b) {
    var it = current().o.items[+b.getAttribute("data-q")];
    it.qty = Math.max(1, it.qty + (+b.getAttribute("data-d")));
    drawItems();
  });
  $("#auto-next").addEventListener("click", function () {
    var first = queue.filter(function (q) { return q.attempts === 0; })[0] || queue[0];
    if (first) { state.sel = first.order; drawQueue(); drawWorkspace(); $("#workspace").scrollIntoView({ block: "start" }); }
  });
  drawAll();
});
