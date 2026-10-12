/* Order details — order.html?id=LZ-2479 */
LZ.page("order", function () {
  var D = window.LEEZIL_DATA, $ = LZ.$, esc = LZ.esc;
  var id = LZ.param("id") || D.orders[2].id;
  var o = D.findOrder(id) || D.orders[2];
  var FLOW = ["New", "Confirmed", "Out for delivery", "Delivered"];
  var t = D.orderTotals(o);

  var timeline = buildTimeline();

  /* Header */
  document.title = "#" + o.id + " — Leezil Admin";
  $("#crumb-id").textContent = "#" + o.id;
  $("#order-sub").textContent = o.date + " · " + o.items.reduce(function (s, i) { return s + i.qty; }, 0) + " item(s) · Cash on delivery";
  var idx = D.orders.indexOf(o);
  $("#prev-order").href = "order.html?id=" + (D.orders[idx - 1] || D.orders[D.orders.length - 1]).id;
  $("#next-order").href = "order.html?id=" + (D.orders[idx + 1] || D.orders[0]).id;

  /* Items */
  $("#items").innerHTML = o.items.map(function (it) {
    var p = D.findProduct(it.p);
    return '<tr><td style="padding-left:20px"><div class="prod"><span class="thumb">' + LZ.icon(p.icon) + '</span><span><a class="link-cell" href="product-edit.html?id=' + p.id + '">' + esc(p.name) + "</a>" +
      '<span class="sub">' + esc(it.variant || "Default") + " · SKU " + esc(p.sku) + "</span></span></div></td>" +
      '<td class="num">' + LZ.da(p.price) + '</td><td class="num">× ' + it.qty + '</td><td class="num strong" style="padding-right:20px">' + LZ.da(p.price * it.qty) + "</td></tr>";
  }).join("");
  $("#totals").innerHTML =
    "<div><span>Subtotal</span><span>" + LZ.da(t.sub) + "</span></div>" +
    "<div><span>Delivery · " + esc(o.delivery) + " · " + esc(o.wilaya) + "</span><span>" + LZ.da(t.ship) + "</span></div>" +
    '<div class="grand"><span>To collect on delivery</span><span>' + LZ.da(t.total) + "</span></div>";

  /* Delivery */
  $("#carrier").innerHTML = D.carriers.filter(function (c) { return c.connected; }).map(function (c) {
    return "<option" + (c.name === o.carrier || (o.carrier === "Maystro" && c.id === "maystro") ? " selected" : "") + ">" + esc(c.name) + "</option>";
  }).join("");
  $("#dtype").value = o.delivery;

  /* Customer */
  $("#cu-ini").textContent = LZ.initials(o.name);
  $("#cu-name").textContent = o.name;
  var cust = D.customers.filter(function (c) { return c.name === o.name; })[0];
  $("#cu-meta").textContent = cust ? cust.orders + " orders · " + LZ.da(cust.spent) + " spent" : "First order";
  $("#cu-phone").textContent = o.phone;
  $("#risk").innerHTML = cust && cust.returns
    ? '<div class="notice warn">' + LZ.icon("alert") + "<span><b>" + cust.returns + " returned parcel</b> in the past. Confirm the address carefully.</span></div>"
    : '<div class="notice">' + LZ.icon("shield") + "<span>No returns from this phone number.</span></div>";
  $("#address").innerHTML = "<dt>Wilaya</dt><dd>" + esc(o.wilaya) + "</dd><dt>Commune</dt><dd>" + esc(o.commune) + "</dd><dt>Address</dt><dd>" + esc(o.address) + "</dd><dt>Type</dt><dd>" + esc(o.delivery) + "</dd>";
  $("#source").innerHTML = "<dt>Channel</dt><dd>" + esc(o.source) + "</dd><dt>Device</dt><dd>Mobile</dd><dt>Landing</dt><dd>/products/" + esc(LZ.slug(D.findProduct(o.items[0].p).name)) + "</dd>";

  /* Status & actions */
  function draw() {
    var pos = FLOW.indexOf(o.status);
    $("#order-title").innerHTML = "#" + esc(o.id) + " " + LZ.statusPill(o.status);
    $("#steps").innerHTML = o.status === "Returned" || o.status === "Cancelled"
      ? FLOW.map(function (s, i) { return '<div class="' + (i < 3 ? "done" : "") + '">' + esc(s) + "</div>"; }).join("").replace("Delivered</div>", esc(o.status) + "</div>")
      : FLOW.map(function (s, i) { return '<div class="' + (i < pos ? "done" : i === pos ? "current" : "") + '">' + esc(s) + "</div>"; }).join("");

    var next = { "New": ["Confirm order", "check", "Confirmed", "Call the customer first to check the address and the product."],
      "Confirmed": ["Send to shipping company", "delivery", "Out for delivery", "A tracking number is created with " + $("#carrier").value + "."],
      "Out for delivery": ["Mark as delivered", "check", "Delivered", "Do this when the courier confirms payment was collected."] }[o.status];
    var acts = "";
    if (next) {
      acts += '<p class="muted" style="line-height:1.5">' + esc(next[3]) + "</p>" +
        '<button class="btn btn-primary btn-block" type="button" data-next="' + next[2] + '">' + LZ.icon(next[1]) + esc(next[0]) + "</button>";
      if (o.status === "New") acts += '<a class="btn btn-block" href="call-center.html?order=' + o.id + '">' + LZ.icon("headset") + "Open in call center</a>";
      if (o.status === "Out for delivery") acts += '<button class="btn btn-block" type="button" data-next="Returned">' + LZ.icon("refresh") + "Mark as returned</button>";
      if (o.status !== "Out for delivery") acts += '<button class="btn btn-block btn-danger" type="button" data-cancel>' + LZ.icon("x") + "Cancel order</button>";
    } else {
      acts = '<div class="notice' + (o.status === "Delivered" ? "" : " danger") + '">' + LZ.icon(o.status === "Delivered" ? "check" : "info") + "<span>" +
        (o.status === "Delivered" ? "Delivered and paid. " + LZ.da(t.total) + " will be in the next payout from the shipping company." : "This order is " + o.status.toLowerCase() + ". Stock was put back.") + "</span></div>" +
        '<button class="btn btn-block" type="button" id="reorder">' + LZ.icon("copy") + "Create a new order from this one</button>";
    }
    $("#actions").innerHTML = acts;
    var hasTracking = pos >= 2 || o.status === "Returned";
    $("#tracking").value = hasTracking ? "YAL-" + o.id.replace("LZ-", "") + "-7731" : "";
    $("#tracking-pill").innerHTML = hasTracking ? LZ.pill("Tracking active", "connected") : "";
    $("#timeline").innerHTML = timeline.map(function (e) {
      return '<li class="' + (e.cls || "done") + '"><span class="dot"></span><div><b>' + esc(e.title) + "</b><span>" + esc(e.when) + (e.by ? " · " + esc(e.by) : "") + "</span>" + (e.text ? "<p>" + esc(e.text) + "</p>" : "") + "</div></li>";
    }).join("");
  }
  LZ.on($("#actions"), "click", "[data-next]", function (e, b) {
    o.status = b.getAttribute("data-next");
    timeline.unshift({ title: "Status changed to " + o.status, when: "Just now", by: "Achraf", cls: "current" });
    timeline.forEach(function (x, i) { if (i) x.cls = "done"; });
    draw(); LZ.toast("Order marked as " + o.status.toLowerCase());
  });
  LZ.on($("#actions"), "click", "[data-cancel]", function () {
    LZ.open({
      title: "Cancel order #" + o.id + "?",
      body: '<div class="field"><label for="reason">Reason</label><select class="select" id="reason"><option>Customer changed their mind</option><option>No answer after 3 calls</option><option>Fake order</option><option>Product out of stock</option><option>Other</option></select></div>' +
        '<label class="check"><input type="checkbox" checked><span>Put the items back in stock</span></label>',
      foot: '<button class="btn" type="button" data-close>Keep order</button><button class="btn btn-primary" type="button" id="do-cancel" style="background:var(--danger);border-color:var(--danger)">Cancel order</button>',
      onMount: function (el) {
        $("#do-cancel", el).addEventListener("click", function () {
          o.status = "Cancelled";
          timeline.unshift({ title: "Order cancelled", when: "Just now", by: "Achraf", text: $("#reason", el).value, cls: "current" });
          LZ.closeAll(); draw(); LZ.toast("Order cancelled");
        });
      }
    });
  });
  $("#note-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("#note").value.trim(); if (!v) return;
    timeline.unshift({ title: "Note", when: "Just now", by: "Achraf", text: v, cls: "done" });
    $("#note").value = ""; draw();
  });
  $("#print-btn").addEventListener("click", function () { window.print(); });
  $("#edit-items").addEventListener("click", function () { LZ.toast("Item editing opens here"); });
  $("#edit-addr").addEventListener("click", function () {
    LZ.open({
      title: "Edit shipping address",
      body: '<div class="grid-2"><div class="field"><label for="a-w">Wilaya</label><select class="select" id="a-w">' + D.wilayas.map(function (w) {
        return "<option" + (w.name === o.wilaya ? " selected" : "") + ">" + String(w.code).padStart(2, "0") + " — " + esc(w.name) + "</option>";
      }).join("") + '</select></div><div class="field"><label for="a-c">Commune</label><input class="input" id="a-c" value="' + esc(o.commune) + '"></div></div>' +
        '<div class="field"><label for="a-a">Address</label><input class="input" id="a-a" value="' + esc(o.address) + '"></div>',
      foot: '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" data-close>Save address</button>'
    });
  });

  function buildTimeline() {
    var base = [{ title: "Order placed", when: o.date, by: "Customer", text: "From " + o.source + " · " + o.delivery + " delivery" }];
    var pos = FLOW.indexOf(o.status);
    if (pos >= 1 || o.status === "Returned") base.unshift({ title: "Confirmed by phone", when: o.date.replace(/\d\d:\d\d/, "11:05"), by: "Meriem", text: "Customer confirmed address and colour." });
    if (pos >= 2 || o.status === "Returned") base.unshift({ title: "Sent to " + o.carrier, when: "Next day · 09:30", by: "Samir" });
    if (pos >= 3) base.unshift({ title: "Delivered and paid", when: "2 days later · 14:20", by: o.carrier });
    if (o.status === "Returned") base.unshift({ title: "Returned to sender", when: "3 days later", by: o.carrier, text: "Customer did not answer the courier." });
    base[0].cls = o.status === "Delivered" ? "done" : "current";
    return base;
  }
  draw();
});
