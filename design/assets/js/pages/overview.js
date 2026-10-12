/* Overview page */
LZ.page("overview", function () {
  var D = window.LEEZIL_DATA, $ = LZ.$, esc = LZ.esc;
  var cur = D.revenue.current, prev = D.revenue.previous;
  var total = cur.reduce(function (a, b) { return a + b; }, 0);
  var prevTotal = prev.reduce(function (a, b) { return a + b; }, 0);
  var delta = ((total / prevTotal - 1) * 100).toFixed(1);
  $("#kpi-revenue").textContent = LZ.money(total);
  $("#kpi-revenue-delta").textContent = (delta >= 0 ? "+" : "") + delta + "%";
  $("#confirm-cta").textContent = "Confirm " + D.callQueue.length + " new orders";

  renderChart($("#revenue-chart"), cur, prev, D.revenue.start);

  // Orders by status
  var counts = D.statusCounts, sum = 0;
  Object.keys(counts).forEach(function (k) { sum += counts[k]; });
  var colors = { "New": "#C9A35E", "Confirmed": "#9DB3AA", "Out for delivery": "#557A6E", "Delivered": "#18403F", "Returned": "#B4533A" };
  $("#status-bar").innerHTML = Object.keys(counts).map(function (k) {
    return '<span style="width:' + (counts[k] / sum * 100) + "%;background:" + colors[k] + '"></span>';
  }).join("");
  $("#status-list").innerHTML = Object.keys(counts).map(function (k) {
    return '<li><span class="sw" style="background:' + colors[k] + '"></span><span class="grow">' + esc(k === "New" ? "New — to confirm" : k) + "</span><b>" + counts[k] + "</b></li>";
  }).join("");

  // Recent orders
  $("#recent-orders").innerHTML = D.orders.slice(0, 6).map(function (o) {
    return '<tr class="clickable" data-href="order.html?id=' + o.id + '"><td><a class="link-cell" href="order.html?id=' + o.id + '">#' + esc(o.id) + "</a></td><td>" + esc(o.name) + '<span class="sub">' + esc(o.ago) + "</span></td><td>" +
      esc(o.wilaya) + '</td><td class="num strong">' + LZ.da(D.orderTotals(o).total) + "</td><td>" + LZ.statusPill(o.status) + "</td></tr>";
  }).join("");
  LZ.on($("#recent-orders"), "click", "tr[data-href]", function (e, tr) { if (!e.target.closest("a")) location.href = tr.getAttribute("data-href"); });

  // Top products
  var top = D.products.slice().sort(function (a, b) { return b.sold * b.price - a.sold * a.price; }).slice(0, 3);
  $("#top-products").innerHTML = top.map(function (p) {
    return '<a class="prod" href="product-edit.html?id=' + p.id + '" style="text-decoration:none;color:inherit"><span class="thumb">' + LZ.icon(p.icon) + '</span><span class="grow">' + esc(p.name) +
      '<span class="muted" style="display:block;font-size:12px">' + p.sold + " sold</span></span><b>" + LZ.da(p.sold * p.price) + "</b></a>";
  }).join("");

  // Low stock
  var low = D.products.filter(function (p) { return p.stock > 0 && p.stock < 10; });
  $("#low-stock-tags").innerHTML = low.map(function (p) { return '<span class="tag">' + esc(p.name) + " · " + p.stock + " left</span>"; }).join("");

  // Wilayas
  $("#wilaya-bars").innerHTML = D.wilayaShare.map(function (w, i) {
    return '<div class="bar-item"><div class="top"><span>' + esc(w.name) + "</span><b>" + w.share + '%</b></div><div class="track"><div style="width:' +
      w.share + "%" + (i === D.wilayaShare.length - 1 ? ";background:#9DB3AA" : "") + '"></div></div></div>';
  }).join("");

  function renderChart(el, cur, prev, start) {
    var W = 600, H = 200, max = 70000, n = cur.length;
    function x(i) { return (i * W / (n - 1)).toFixed(1); }
    function y(v) { return (H - v / max * H).toFixed(1); }
    function line(a) { return a.map(function (v, i) { return (i ? "L" : "M") + x(i) + "," + y(v); }).join(" "); }
    var startDate = new Date(start + "T00:00:00");
    function dayLabel(i) {
      var d = new Date(startDate); d.setDate(d.getDate() + i);
      return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    }
    var grid = [20000, 40000, 60000].map(function (v) { return "M0 " + y(v) + "H" + W; }).join("");
    el.innerHTML =
      '<div class="y" aria-hidden="true"><span>60k</span><span>40k</span><span>20k</span><span>0</span></div>' +
      '<div class="plot"><svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img" aria-label="Daily revenue for the last 30 days compared with the previous 30 days">' +
      '<path d="' + grid + '" stroke="#ECE8DD" fill="none" vector-effect="non-scaling-stroke"/>' +
      '<path d="M0 ' + H + "H" + W + '" stroke="#DCD6C6" fill="none" vector-effect="non-scaling-stroke"/>' +
      '<path d="' + line(cur) + " L" + W + "," + H + " L0," + H + 'Z" fill="#18403F" fill-opacity="0.08"/>' +
      '<path d="' + line(prev) + '" fill="none" stroke="#9DB3AA" stroke-width="2" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/>' +
      '<path d="' + line(cur) + '" fill="none" stroke="#18403F" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      '</svg><div class="hover-line"></div><div class="marker"></div><div class="tip"></div></div>';
    var plot = $(".plot", el), hl = $(".hover-line", el), mk = $(".marker", el), tip = $(".tip", el);
    function show(i) {
      var f = i / (n - 1);
      hl.style.left = mk.style.left = tip.style.left = (f * 100) + "%";
      mk.style.top = (100 - cur[i] / max * 100) + "%";
      tip.innerHTML = "<b>" + LZ.money(cur[i]) + " DA</b> · " + dayLabel(i);
      tip.style.transform = "translate(" + (f > 0.8 ? "-100%" : f < 0.2 ? "0" : "-50%") + ", -110%)";
    }
    var peak = cur.indexOf(Math.max.apply(null, cur));
    show(peak);
    plot.addEventListener("mousemove", function (e) {
      var r = plot.getBoundingClientRect();
      show(Math.max(0, Math.min(n - 1, Math.round((e.clientX - r.left) / r.width * (n - 1)))));
    });
    plot.addEventListener("mouseleave", function () { show(peak); });
  }
});
