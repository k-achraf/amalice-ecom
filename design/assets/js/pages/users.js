/* Users & roles */
LZ.page("users", function () {
  var D = window.LEEZIL_DATA, $ = LZ.$, esc = LZ.esc;
  var users = D.users.map(function (u) { return Object.assign({}, u); });
  var perms = D.permissions.map(function (p) { return Object.assign({}, p); });
  var roleName = {}; D.roles.forEach(function (r) { roleName[r.id] = r.name; });
  var state = { role: "all", q: "" };
  var SCLS = { Active: "active", Invited: "invited", Suspended: "suspended" };

  /* Tabs */
  LZ.on($(".tabs"), "click", "[data-tab]", function (e, b) {
    LZ.$$(".tabs [data-tab]").forEach(function (t) { t.setAttribute("aria-selected", t === b); });
    ["users", "roles", "security"].forEach(function (k) { $("#panel-" + k).hidden = k !== b.getAttribute("data-tab"); });
  });

  function drawKpis() {
    $("#user-kpis").innerHTML =
      '<div class="kpi"><span class="label">Users</span><span class="value">' + users.length + '</span><span class="meta">Plan limit: 10</span></div>' +
      '<div class="kpi"><span class="label">Active now</span><span class="value">2</span><span class="meta">Achraf, Meriem</span></div>' +
      '<div class="kpi warn"><span class="label">Pending invitations</span><span class="value">' + users.filter(function (u) { return u.status === "Invited"; }).length + '</span><span class="meta">Expire after 7 days</span></div>' +
      '<div class="kpi"><span class="label">Two-step login on</span><span class="value">' + users.filter(function (u) { return u.twofa; }).length + "/" + users.length + '</span><span class="meta">Turn it on in Security</span></div>';
  }
  function drawUsers() {
    var roles = [["all", "All"]].concat(D.roles.map(function (r) { return [r.id, r.name]; }));
    $("#role-filter").innerHTML = roles.map(function (r) {
      var n = r[0] === "all" ? users.length : users.filter(function (u) { return u.role === r[0]; }).length;
      return '<button class="chip-btn" type="button" role="tab" data-r="' + r[0] + '" aria-selected="' + (r[0] === state.role) + '">' + esc(r[1]) + '<span class="count">' + n + "</span></button>";
    }).join("");
    var q = state.q.toLowerCase();
    var list = users.filter(function (u) { return (state.role === "all" || u.role === state.role) && (!q || (u.name + u.email).toLowerCase().indexOf(q) > -1); });
    $("#user-body").innerHTML = list.length ? list.map(function (u) {
      var i = users.indexOf(u);
      return '<tr><td><div class="prod"><span class="initials' + (u.role === "owner" ? " dark" : "") + '">' + LZ.initials(u.name) + '</span><span><span class="strong">' + esc(u.name) + (u.role === "owner" ? ' <span class="muted">(you)</span>' : "") + '</span><span class="sub">' + esc(u.email) + "</span></span></div></td>" +
        "<td>" + esc(roleName[u.role]) + "</td><td>" + LZ.pill(u.status, SCLS[u.status]) + "</td>" +
        "<td>" + (u.twofa ? '<span style="display:inline-flex;gap:6px;align-items:center;color:var(--teal)">' + LZ.icon("check", ' style="width:16px;height:16px"') + "On</span>" : '<span class="muted">Off</span>') + "</td>" +
        '<td class="muted">' + esc(u.last) + '</td><td class="num">' + (u.role === "owner" ? "" : '<button class="btn btn-sm" type="button" data-edit="' + i + '">Manage</button>') + "</td></tr>";
    }).join("") : '<tr><td colspan="6" class="empty">No users found.</td></tr>';
  }
  function drawRoles() {
    $("#role-cards").innerHTML = D.roles.map(function (r) {
      var n = users.filter(function (u) { return u.role === r.id; }).length;
      var areas = perms.filter(function (p) { return p[r.id]; }).length;
      return '<div class="card" style="gap:10px"><div class="card-head"><h2>' + esc(r.name) + "</h2>" + LZ.pill(n + " user" + (n === 1 ? "" : "s"), "neutral") + '</div><p class="muted" style="line-height:1.5">' + esc(r.desc) + '</p><span class="muted">' + areas + " of " + perms.length + " areas</span></div>";
    }).join("");
    $("#perm-table").innerHTML = "<thead><tr><th>Area</th>" + D.roles.map(function (r) { return "<th>" + esc(r.name) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      perms.map(function (p, i) {
        return "<tr><td>" + esc(p.area) + "</td>" + D.roles.map(function (r) {
          var locked = r.id === "owner";
          return '<td><input type="checkbox" data-p="' + i + '" data-role="' + r.id + '"' + (p[r.id] ? " checked" : "") + (locked ? " disabled" : "") + ' aria-label="' + esc(r.name + " — " + p.area) + '"></td>';
        }).join("") + "</tr>";
      }).join("") + "</tbody>";
  }
  LZ.on($("#role-filter"), "click", "[data-r]", function (e, b) { state.role = b.getAttribute("data-r"); drawUsers(); });
  $("#user-search").addEventListener("input", function (e) { state.q = e.target.value; drawUsers(); });
  $("#perm-table").addEventListener("change", function (e) {
    var t = e.target; perms[+t.dataset.p][t.dataset.role] = t.checked ? 1 : 0; drawRoles(); LZ.toast("Permission updated");
  });

  function roleOptions(sel) {
    return D.roles.filter(function (r) { return r.id !== "owner"; }).map(function (r) {
      return '<label class="check" style="border:1px solid var(--line);border-radius:var(--r);padding:10px 12px"><input type="radio" name="role" value="' + r.id + '"' + (r.id === sel ? " checked" : "") + "><span><b style=\"font-weight:500\">" + esc(r.name) + '</b><span class="sub">' + esc(r.desc) + "</span></span></label>";
    }).join("");
  }

  $("#invite-btn").addEventListener("click", function () {
    LZ.open({
      title: "Invite a user",
      body: '<div class="grid-2"><div class="field"><label for="i-name">Full name</label><input class="input" id="i-name"></div><div class="field"><label for="i-mail">Email</label><input class="input" id="i-mail" type="email" placeholder="name@leezil.com"></div></div>' +
        '<fieldset style="border:0;padding:0;margin:0" class="stack"><legend class="strong" style="font-size:13px;margin-bottom:8px">Role</legend><div class="stack" style="gap:8px">' + roleOptions("agent") + "</div></fieldset>",
      foot: '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="i-send">' + LZ.icon("send") + "Send invitation</button>",
      onMount: function (el) {
        $("#i-send", el).addEventListener("click", function () {
          var n = $("#i-name", el).value.trim(), m = $("#i-mail", el).value.trim();
          if (!n || !/@/.test(m)) { LZ.toast("Add a name and a valid email"); return; }
          users.push({ name: n, email: m, role: $('input[name="role"]:checked', el).value, status: "Invited", last: "Invitation sent just now", twofa: false });
          LZ.closeAll(); drawKpis(); drawUsers(); drawRoles(); LZ.toast("Invitation sent to " + m);
        });
      }
    });
  });

  LZ.on($("#user-body"), "click", "[data-edit]", function (e, b) {
    var u = users[+b.getAttribute("data-edit")];
    LZ.open({
      kind: "drawer", title: u.name,
      body: '<div class="prod"><span class="initials lg">' + LZ.initials(u.name) + '</span><span><b style="font-weight:600">' + esc(u.name) + '</b><span class="sub">' + esc(u.email) + "</span></span></div>" +
        '<fieldset style="border:0;padding:0;margin:0"><legend class="strong" style="font-size:13px;margin-bottom:8px">Role</legend><div class="stack" style="gap:8px">' + roleOptions(u.role) + "</div></fieldset>" +
        '<div class="setting"><div class="text"><b>Account active</b><span>Turn off to block sign-in without deleting the user.</span></div><label class="switch"><input type="checkbox" id="d-active"' + (u.status !== "Suspended" ? " checked" : "") + ' aria-label="Account active"><span></span></label></div>' +
        '<div class="stack" style="gap:8px">' + (u.status === "Invited" ? '<button class="btn" type="button" id="d-resend">' + LZ.icon("send") + "Resend invitation</button>" : '<button class="btn" type="button" id="d-reset">' + LZ.icon("mail") + "Send password reset</button>") +
        '<button class="btn btn-danger" type="button" id="d-remove">' + LZ.icon("trash") + "Remove from team</button></div>",
      foot: '<button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="d-save">Save</button>',
      onMount: function (el) {
        $("#d-save", el).addEventListener("click", function () {
          u.role = $('input[name="role"]:checked', el).value;
          if (u.status !== "Invited") u.status = $("#d-active", el).checked ? "Active" : "Suspended";
          LZ.closeAll(); drawUsers(); drawRoles(); LZ.toast("User updated");
        });
        $("#d-remove", el).addEventListener("click", function () { users.splice(users.indexOf(u), 1); LZ.closeAll(); drawKpis(); drawUsers(); drawRoles(); LZ.toast(u.name + " removed"); });
        var r = $("#d-reset", el) || $("#d-resend", el);
        r.addEventListener("click", function () { LZ.toast("Email sent to " + u.email); });
      }
    });
  });

  drawKpis(); drawUsers(); drawRoles();
});
