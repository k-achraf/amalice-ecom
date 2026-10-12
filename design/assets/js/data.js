/*
 * Leezil Admin — sample data.
 * Everything here is placeholder data for the design. Replace it with
 * calls to your store's API / database when wiring the dashboard up.
 */
(function () {
  var D = window.LEEZIL_DATA = {};

  // Daily revenue in DA, oldest first (last 30 days and the 30 days before)
  D.revenue = {
    start: "2026-09-12",
    current: [27400, 29200, 35000, 35100, 36100, 40500, 46000, 44400, 43000, 36100, 37500, 33100, 30600, 28800, 29400, 36800, 36800, 38400, 40700, 37500, 41800, 48200, 52200, 55900, 58100, 51400, 57000, 57300, 54700, 49900],
    previous: [29800, 28000, 35200, 34400, 30900, 27500, 30700, 26300, 27300, 26100, 23100, 22900, 25600, 26100, 26200, 29900, 36400, 32400, 34000, 39600, 37000, 38500, 36800, 34200, 37700, 29700, 30200, 27800, 31300, 29200]
  };

  D.statusCounts = { "New": 12, "Confirmed": 28, "Out for delivery": 45, "Delivered": 241, "Returned": 16 };

  /* ---------- Catalogue ---------- */
  D.categories = ["Audio", "Watches", "Chargers", "Phone", "Accessories", "Gifts"];

  D.products = [
    { id: 1, name: "Wireless Buds", sku: "LZ-AUD-014", cat: "Audio", icon: "earbuds", price: 4900, compare: 5900, cost: 2600, stock: 6, sold: 68, status: "Active", variants: 2,
      desc: "Light wireless earbuds with clear sound and a charging case that lasts all day.", tags: ["bestseller", "audio"], attrs: { color: ["Black", "Ivory"] } },
    { id: 2, name: "Studio Headphones", sku: "LZ-AUD-022", cat: "Audio", icon: "headphones", price: 6900, compare: 0, cost: 3800, stock: 34, sold: 22, status: "Active", variants: 1, desc: "Over-ear headphones with soft cushions.", tags: ["audio"], attrs: {} },
    { id: 3, name: "Smartwatch S2", sku: "LZ-WCH-002", cat: "Watches", icon: "smartwatch", price: 9000, compare: 10500, cost: 5200, stock: 18, sold: 31, status: "Active", variants: 4,
      desc: "Track steps, sleep and notifications. Interchangeable straps.", tags: ["new", "watch"], attrs: { color: ["Black", "Sage"], strap: ["Silicone", "Leather"] } },
    { id: 4, name: "Fast Charger 30W", sku: "LZ-CHG-030", cat: "Chargers", icon: "charger", price: 2700, compare: 0, cost: 1300, stock: 3, sold: 47, status: "Active", variants: 1, desc: "USB-C fast charger, 30W.", tags: ["charger"], attrs: {} },
    { id: 5, name: "Clear Phone Case", sku: "LZ-PHN-110", cat: "Phone", icon: "mobile", price: 1600, compare: 0, cost: 450, stock: 142, sold: 59, status: "Active", variants: 6, desc: "Slim transparent case.", tags: ["phone"], attrs: { model: ["iPhone 15", "iPhone 16", "Galaxy S24"] } },
    { id: 6, name: "Sunglasses Classic", sku: "LZ-ACC-207", cat: "Accessories", icon: "sunglasses", price: 3900, compare: 0, cost: 1500, stock: 27, sold: 14, status: "Active", variants: 1, desc: "Classic frame, UV400.", tags: [], attrs: {} },
    { id: 7, name: "Silver Ring", sku: "LZ-ACC-315", cat: "Accessories", icon: "ring", price: 3500, compare: 0, cost: 1400, stock: 0, sold: 9, status: "Active", variants: 3, desc: "925 silver ring.", tags: ["gift"], attrs: { size: ["S", "M", "L"] } },
    { id: 8, name: "Gift Box — Tech Edit", sku: "LZ-GFT-001", cat: "Gifts", icon: "gift", price: 7500, compare: 0, cost: 4100, stock: 12, sold: 11, status: "Active", variants: 1, desc: "A ready-to-gift box with a selection of accessories.", tags: ["gift"], attrs: {} },
    { id: 9, name: "Magnetic Cable 1m", sku: "LZ-CHG-041", cat: "Chargers", icon: "charger", price: 1200, compare: 0, cost: 380, stock: 0, sold: 26, status: "Active", variants: 1, desc: "Magnetic USB-C cable.", tags: [], attrs: {} },
    { id: 10, name: "Leather Strap", sku: "LZ-WCH-110", cat: "Watches", icon: "smartwatch", price: 2400, compare: 0, cost: 900, stock: 40, sold: 8, status: "Draft", variants: 2, desc: "Genuine leather strap for Smartwatch S2.", tags: [], attrs: { color: ["Black", "Brass"] } }
  ];

  D.attributes = [
    { id: "color", name: "Color", type: "color", products: 14, options: [
      { label: "Black", value: "#141414" }, { label: "Ivory", value: "#F1EDE2" }, { label: "Teal", value: "#18403F" }, { label: "Sage", value: "#557A6E" }, { label: "Brass", value: "#C9A35E" } ] },
    { id: "size", name: "Size", type: "text", products: 6, options: [ { label: "S" }, { label: "M" }, { label: "L" }, { label: "XL" } ] },
    { id: "strap", name: "Strap material", type: "text", products: 3, options: [ { label: "Silicone" }, { label: "Leather" }, { label: "Metal" } ] },
    { id: "model", name: "Phone model", type: "select", products: 9, options: [ { label: "iPhone 15" }, { label: "iPhone 16" }, { label: "Galaxy S24" }, { label: "Redmi Note 13" } ] },
    { id: "capacity", name: "Battery capacity", type: "text", products: 4, options: [ { label: "10,000 mAh" }, { label: "20,000 mAh" } ] }
  ];

  /* ---------- Orders ---------- */
  D.orders = [
    { id: "LZ-2481", date: "11 Oct · 10:42", ago: "12 min ago", name: "Yacine Benali", phone: "+213 5•• •• •• 41", wilaya: "Alger", commune: "Bab Ezzouar", address: "Cité 1200 logements, bât. 14", delivery: "Home", carrier: "Yalidine", items: [{ p: 1, qty: 1, variant: "Black" }], status: "New", source: "Facebook ad" },
    { id: "LZ-2480", date: "11 Oct · 10:16", ago: "38 min ago", name: "Sara Hamidi", phone: "+213 6•• •• •• 07", wilaya: "Oran", commune: "Bir El Djir", address: "Stop desk — Bir El Djir", delivery: "Stop desk", carrier: "ZR Express", items: [{ p: 1, qty: 2, variant: "Ivory" }], status: "New", source: "Instagram" },
    { id: "LZ-2479", date: "11 Oct · 09:31", ago: "1 h ago", name: "Karim Boudiaf", phone: "+213 7•• •• •• 63", wilaya: "Constantine", commune: "Ali Mendjeli", address: "UV 7, rue 12", delivery: "Home", carrier: "Yalidine", items: [{ p: 3, qty: 1, variant: "Black / Leather" }, { p: 10, qty: 1, variant: "Brass" }], status: "Confirmed", source: "Website" },
    { id: "LZ-2478", date: "11 Oct · 08:55", ago: "2 h ago", name: "Imane Cherif", phone: "+213 5•• •• •• 19", wilaya: "Sétif", commune: "El Eulma", address: "Stop desk — El Eulma", delivery: "Stop desk", carrier: "Maystro", items: [{ p: 5, qty: 2, variant: "iPhone 15" }], status: "Out for delivery", source: "TikTok" },
    { id: "LZ-2477", date: "10 Oct · 19:20", ago: "yesterday", name: "Amine Lounis", phone: "+213 6•• •• •• 88", wilaya: "Blida", commune: "Ouled Yaïch", address: "Lot. Benachour n°45", delivery: "Home", carrier: "Yalidine", items: [{ p: 2, qty: 1, variant: "" }], status: "Delivered", source: "Website" },
    { id: "LZ-2476", date: "10 Oct · 17:04", ago: "yesterday", name: "Nesrine Taleb", phone: "+213 7•• •• •• 25", wilaya: "Annaba", commune: "El Bouni", address: "Cité Boukhadra 3", delivery: "Home", carrier: "ZR Express", items: [{ p: 4, qty: 1, variant: "" }], status: "Returned", source: "Facebook ad" },
    { id: "LZ-2475", date: "10 Oct · 15:47", ago: "yesterday", name: "Walid Mansouri", phone: "+213 5•• •• •• 92", wilaya: "Tizi Ouzou", commune: "Azazga", address: "Stop desk — Tizi Ouzou centre", delivery: "Stop desk", carrier: "Yalidine", items: [{ p: 6, qty: 1, variant: "" }], status: "Out for delivery", source: "Instagram" },
    { id: "LZ-2474", date: "10 Oct · 14:12", ago: "yesterday", name: "Lina Zerrouki", phone: "+213 6•• •• •• 36", wilaya: "Alger", commune: "Hydra", address: "Rue des Frères Oughlis, n°8", delivery: "Home", carrier: "Yalidine", items: [{ p: 8, qty: 1, variant: "" }, { p: 7, qty: 1, variant: "M" }], status: "Confirmed", source: "Website" },
    { id: "LZ-2473", date: "10 Oct · 11:38", ago: "yesterday", name: "Rania Haddad", phone: "+213 7•• •• •• 54", wilaya: "Béjaïa", commune: "Akbou", address: "Cité 500 logements", delivery: "Home", carrier: "Maystro", items: [{ p: 3, qty: 1, variant: "Sage / Silicone" }], status: "Delivered", source: "TikTok" },
    { id: "LZ-2472", date: "10 Oct · 09:03", ago: "yesterday", name: "Mehdi Saadi", phone: "+213 5•• •• •• 70", wilaya: "Tlemcen", commune: "Mansourah", address: "Stop desk — Tlemcen", delivery: "Stop desk", carrier: "ZR Express", items: [{ p: 1, qty: 1, variant: "Black" }], status: "New", source: "Facebook ad" }
  ];

  /* ---------- Call center queue: unconfirmed orders ---------- */
  D.callQueue = [
    { order: "LZ-2481", attempts: 0, lastCall: "", waiting: "12 min", priority: "High", note: "" },
    { order: "LZ-2480", attempts: 1, lastCall: "10:25 · No answer", waiting: "38 min", priority: "High", note: "" },
    { order: "LZ-2472", attempts: 2, lastCall: "Yesterday 17:40 · No answer", waiting: "1 day", priority: "Normal", note: "Asked to call back after 16:00" },
    { order: "LZ-2470", attempts: 1, lastCall: "Yesterday 15:10 · Busy", waiting: "1 day", priority: "Normal", note: "", extra: { name: "Hichem Belkacem", phone: "+213 6•• •• •• 13", wilaya: "Batna", commune: "Batna", address: "Cité 1000 logements", delivery: "Home", items: [{ p: 3, qty: 1, variant: "Black / Silicone" }], date: "10 Oct · 08:12", source: "Facebook ad" } },
    { order: "LZ-2468", attempts: 3, lastCall: "Yesterday 12:05 · No answer", waiting: "2 days", priority: "Low", note: "Third attempt — cancel if no answer today", extra: { name: "Asma Rahmani", phone: "+213 7•• •• •• 48", wilaya: "Biskra", commune: "Biskra", address: "Stop desk — Biskra", delivery: "Stop desk", items: [{ p: 6, qty: 1, variant: "" }], date: "09 Oct · 21:30", source: "Instagram" } },
    { order: "LZ-2466", attempts: 0, lastCall: "", waiting: "2 days", priority: "Normal", note: "", extra: { name: "Sofiane Kaci", phone: "+213 5•• •• •• 02", wilaya: "Boumerdès", commune: "Boudouaou", address: "Rue principale n°21", delivery: "Home", items: [{ p: 8, qty: 1, variant: "" }], date: "09 Oct · 18:05", source: "Website" } }
  ];
  D.callAgents = [
    { name: "Meriem", calls: 46, confirmed: 31 },
    { name: "Nassim", calls: 38, confirmed: 24 }
  ];

  /* ---------- Abandoned carts ---------- */
  D.carts = [
    { id: "C-9182", name: "Ryad Ferhat", phone: "+213 5•• •• •• 33", wilaya: "Alger", step: "Delivery info", items: [{ p: 3, qty: 1 }], when: "25 min ago", status: "Not contacted", source: "Facebook ad" },
    { id: "C-9180", name: "Khadidja M.", phone: "+213 6•• •• •• 59", wilaya: "Oran", step: "Order summary", items: [{ p: 1, qty: 1 }, { p: 4, qty: 1 }], when: "1 h ago", status: "Message sent", source: "Instagram" },
    { id: "C-9177", name: "Unknown visitor", phone: "", wilaya: "—", step: "Cart", items: [{ p: 6, qty: 1 }], when: "2 h ago", status: "No contact info", source: "Website" },
    { id: "C-9175", name: "Bilal Ait Ali", phone: "+213 7•• •• •• 80", wilaya: "Tizi Ouzou", step: "Delivery info", items: [{ p: 8, qty: 1 }], when: "4 h ago", status: "Recovered", source: "TikTok", order: "LZ-2479" },
    { id: "C-9171", name: "Selma Bouzid", phone: "+213 5•• •• •• 16", wilaya: "Sétif", step: "Order summary", items: [{ p: 2, qty: 1 }], when: "Yesterday", status: "Called", source: "Website" },
    { id: "C-9168", name: "Omar Hadj", phone: "+213 6•• •• •• 72", wilaya: "Blida", step: "Delivery info", items: [{ p: 5, qty: 3 }], when: "Yesterday", status: "Lost", source: "Facebook ad" },
    { id: "C-9163", name: "Ines Larbi", phone: "+213 7•• •• •• 05", wilaya: "Constantine", step: "Order summary", items: [{ p: 3, qty: 1 }, { p: 10, qty: 1 }], when: "2 days ago", status: "Not contacted", source: "Instagram" }
  ];

  /* ---------- Customers ---------- */
  D.customers = [
    { name: "Lina Zerrouki", phone: "+213 6•• •• •• 36", wilaya: "Alger", orders: 9, spent: 52300, last: "10 Oct", segment: "VIP", since: "Mar 2025", delivery: "Home", returns: 0, lastItem: "Gift box, Silver ring", lastTotal: 7500 },
    { name: "Karim Boudiaf", phone: "+213 7•• •• •• 63", wilaya: "Constantine", orders: 6, spent: 38700, last: "11 Oct", segment: "VIP", since: "Jun 2025", delivery: "Home", returns: 1, lastItem: "Smartwatch S2, Leather strap", lastTotal: 12400 },
    { name: "Sara Hamidi", phone: "+213 6•• •• •• 07", wilaya: "Oran", orders: 4, spent: 21500, last: "11 Oct", segment: "Repeat", since: "Jan 2026", delivery: "Stop desk", returns: 0, lastItem: "Wireless Buds ×2", lastTotal: 9800 },
    { name: "Amine Lounis", phone: "+213 6•• •• •• 88", wilaya: "Blida", orders: 3, spent: 16200, last: "10 Oct", segment: "Repeat", since: "Apr 2026", delivery: "Home", returns: 0, lastItem: "Studio Headphones", lastTotal: 6900 },
    { name: "Rania Haddad", phone: "+213 7•• •• •• 54", wilaya: "Béjaïa", orders: 2, spent: 12900, last: "10 Oct", segment: "Repeat", since: "Jul 2026", delivery: "Home", returns: 0, lastItem: "Smartwatch S2", lastTotal: 9000 },
    { name: "Imane Cherif", phone: "+213 5•• •• •• 19", wilaya: "Sétif", orders: 2, spent: 6700, last: "11 Oct", segment: "Repeat", since: "Aug 2026", delivery: "Stop desk", returns: 0, lastItem: "Phone case, Screen guard", lastTotal: 3200 },
    { name: "Yacine Benali", phone: "+213 5•• •• •• 41", wilaya: "Alger", orders: 1, spent: 4900, last: "11 Oct", segment: "New", since: "Oct 2026", delivery: "Home", returns: 0, lastItem: "Wireless Buds", lastTotal: 4900 },
    { name: "Mehdi Saadi", phone: "+213 5•• •• •• 70", wilaya: "Tlemcen", orders: 1, spent: 4900, last: "10 Oct", segment: "New", since: "Oct 2026", delivery: "Stop desk", returns: 0, lastItem: "Wireless Buds", lastTotal: 4900 }
  ];

  D.wilayaShare = [
    { name: "Alger", share: 24 }, { name: "Oran", share: 14 }, { name: "Constantine", share: 9 },
    { name: "Sétif", share: 7 }, { name: "Blida", share: 6 }, { name: "Other wilayas", share: 40 }
  ];

  /* ---------- Team ---------- */
  D.roles = [
    { id: "owner", name: "Owner", desc: "Full access, billing and team management." },
    { id: "manager", name: "Store manager", desc: "Everything except billing and team." },
    { id: "agent", name: "Call center agent", desc: "Confirms orders and recovers carts." },
    { id: "stock", name: "Stock keeper", desc: "Products, stock and shipping." }
  ];
  D.permissions = [
    { area: "Overview & reports", owner: 1, manager: 1, agent: 0, stock: 0 },
    { area: "Orders", owner: 1, manager: 1, agent: 1, stock: 1 },
    { area: "Call center", owner: 1, manager: 1, agent: 1, stock: 0 },
    { area: "Abandoned carts", owner: 1, manager: 1, agent: 1, stock: 0 },
    { area: "Products & attributes", owner: 1, manager: 1, agent: 0, stock: 1 },
    { area: "Customers", owner: 1, manager: 1, agent: 1, stock: 0 },
    { area: "Shipping", owner: 1, manager: 1, agent: 0, stock: 1 },
    { area: "Storefront & apps", owner: 1, manager: 1, agent: 0, stock: 0 },
    { area: "Users & billing", owner: 1, manager: 0, agent: 0, stock: 0 }
  ];
  D.users = [
    { name: "Achraf Khallaf", email: "achraf@leezil.com", role: "owner", status: "Active", last: "Online now", twofa: true },
    { name: "Meriem Bensalem", email: "meriem@leezil.com", role: "agent", status: "Active", last: "5 min ago", twofa: true },
    { name: "Nassim Ouali", email: "nassim@leezil.com", role: "agent", status: "Active", last: "1 h ago", twofa: false },
    { name: "Samir Djebbar", email: "samir@leezil.com", role: "stock", status: "Active", last: "Yesterday", twofa: false },
    { name: "Yasmine Kherbouche", email: "yasmine@leezil.com", role: "manager", status: "Invited", last: "Invitation sent 2 days ago", twofa: false },
    { name: "Farid Hamdi", email: "farid@leezil.com", role: "agent", status: "Suspended", last: "3 weeks ago", twofa: false }
  ];

  /* ---------- Apps ---------- */
  D.apps = [
    { id: "fb-pixel", name: "Facebook Pixel", cat: "Marketing", by: "Meta", short: "fb", color: "#1A4D8F", installed: true, enabled: true,
      desc: "Track visits, add-to-cart and purchases to optimise your Facebook and Instagram ads.",
      settings: [
        { type: "text", key: "pixelId", label: "Pixel ID", value: "1029384756123456", hint: "Find it in Events Manager." },
        { type: "text", key: "token", label: "Conversions API token", value: "", hint: "Optional. Sends events server-side for better accuracy.", secret: true },
        { type: "checks", key: "events", label: "Events to send", options: ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase"], value: ["PageView", "ViewContent", "AddToCart", "Purchase"] },
        { type: "select", key: "purchaseOn", label: "Send Purchase event when", options: ["Order is placed", "Order is confirmed by call center", "Order is delivered"], value: "Order is confirmed by call center" }
      ] },
    { id: "tiktok-pixel", name: "TikTok Pixel", cat: "Marketing", by: "TikTok", short: "Tk", color: "#0E2928", installed: true, enabled: true,
      desc: "Measure TikTok ad results and build audiences from your store visitors.",
      settings: [
        { type: "text", key: "pixelId", label: "Pixel ID", value: "C8K2LZ0000EXAMPLE" },
        { type: "checks", key: "events", label: "Events to send", options: ["ViewContent", "AddToCart", "PlaceAnOrder", "CompletePayment"], value: ["ViewContent", "AddToCart", "PlaceAnOrder"] }
      ] },
    { id: "gsheets", name: "Google Sheets sync", cat: "Productivity", by: "Google", short: "GS", color: "#557A6E", installed: true, enabled: false,
      desc: "Send every new order to a Google Sheet automatically. Useful for your delivery or call team.",
      settings: [
        { type: "text", key: "sheet", label: "Spreadsheet URL", value: "", hint: "The sheet must be shared with the Leezil service account." },
        { type: "text", key: "tab", label: "Sheet tab name", value: "Orders" },
        { type: "select", key: "when", label: "Add a row when", options: ["Order is placed", "Order is confirmed"], value: "Order is placed" },
        { type: "toggle", key: "update", label: "Update the row when the status changes", value: true }
      ] },
    { id: "whatsapp", name: "WhatsApp notifications", cat: "Messaging", by: "Leezil", short: "WA", color: "#18403F", installed: false, enabled: false,
      desc: "Send order confirmations, shipping updates and cart reminders on WhatsApp.",
      settings: [
        { type: "text", key: "number", label: "Business number", value: "+213 ", hint: "The number your customers will see." },
        { type: "toggle", key: "confirm", label: "Order confirmation message", value: true },
        { type: "toggle", key: "shipped", label: "Shipping update with tracking number", value: true },
        { type: "toggle", key: "cart", label: "Abandoned cart reminder (after 1 hour)", value: false },
        { type: "textarea", key: "template", label: "Confirmation template", value: "Salam {name}, merci pour votre commande {order} chez Leezil. Total : {total} DA. Nous vous appellerons bientôt pour confirmer." }
      ] },
    { id: "ga4", name: "Google Analytics 4", cat: "Analytics", by: "Google", short: "GA", color: "#C9A35E", textColor: "#0E2928", installed: false, enabled: false,
      desc: "Understand where your visitors come from and how they move through your store.",
      settings: [ { type: "text", key: "mid", label: "Measurement ID", value: "", hint: "Starts with G-" }, { type: "toggle", key: "ecom", label: "Enhanced e-commerce events", value: true } ] },
    { id: "snap", name: "Snapchat Pixel", cat: "Marketing", by: "Snap", short: "Sc", color: "#C9A35E", textColor: "#0E2928", installed: false, enabled: false,
      desc: "Track conversions from your Snapchat ads.",
      settings: [ { type: "text", key: "pixelId", label: "Pixel ID", value: "" } ] },
    { id: "sms", name: "SMS confirmations", cat: "Messaging", by: "Leezil", short: "SMS", color: "#557A6E", installed: false, enabled: false,
      desc: "Send an SMS with the order summary and the tracking number to customers without WhatsApp.",
      settings: [ { type: "text", key: "sender", label: "Sender name", value: "LEEZIL", hint: "Up to 11 characters." }, { type: "toggle", key: "otp", label: "Verify phone number at checkout (OTP)", value: false } ] },
    { id: "reviews", name: "Product reviews", cat: "Sales", by: "Leezil", short: "Rv", color: "#0E2928", installed: true, enabled: true,
      desc: "Collect reviews from customers after delivery and show them on product pages.",
      settings: [
        { type: "select", key: "delay", label: "Ask for a review", options: ["1 day after delivery", "3 days after delivery", "7 days after delivery"], value: "3 days after delivery" },
        { type: "toggle", key: "approve", label: "Approve reviews before they are published", value: true },
        { type: "toggle", key: "photos", label: "Allow photos in reviews", value: true }
      ] },
    { id: "upsell", name: "Upsell & bundles", cat: "Sales", by: "Leezil", short: "Up", color: "#18403F", installed: false, enabled: false,
      desc: "Offer a matching product before the order is placed, like a case with a phone charger.",
      settings: [ { type: "select", key: "where", label: "Show the offer", options: ["On the product page", "After clicking Order", "On the thank-you page"], value: "After clicking Order" }, { type: "text", key: "discount", label: "Bundle discount (%)", value: "10" } ] }
  ];

  /* ---------- Shipping ---------- */
  // code, name, zone (A = Alger area, B = north, C = high plateaus, D = south, E = far south)
  var W = [
    [1, "Adrar", "E"], [2, "Chlef", "B"], [3, "Laghouat", "D"], [4, "Oum El Bouaghi", "C"], [5, "Batna", "C"], [6, "Béjaïa", "B"], [7, "Biskra", "D"], [8, "Béchar", "E"],
    [9, "Blida", "A"], [10, "Bouira", "B"], [11, "Tamanrasset", "E"], [12, "Tébessa", "C"], [13, "Tlemcen", "B"], [14, "Tiaret", "C"], [15, "Tizi Ouzou", "B"], [16, "Alger", "A"],
    [17, "Djelfa", "C"], [18, "Jijel", "B"], [19, "Sétif", "B"], [20, "Saïda", "C"], [21, "Skikda", "B"], [22, "Sidi Bel Abbès", "B"], [23, "Annaba", "B"], [24, "Guelma", "B"],
    [25, "Constantine", "B"], [26, "Médéa", "B"], [27, "Mostaganem", "B"], [28, "M'Sila", "C"], [29, "Mascara", "B"], [30, "Ouargla", "D"], [31, "Oran", "B"], [32, "El Bayadh", "D"],
    [33, "Illizi", "E"], [34, "Bordj Bou Arréridj", "B"], [35, "Boumerdès", "A"], [36, "El Tarf", "B"], [37, "Tindouf", "E"], [38, "Tissemsilt", "C"], [39, "El Oued", "D"], [40, "Khenchela", "C"],
    [41, "Souk Ahras", "C"], [42, "Tipaza", "A"], [43, "Mila", "B"], [44, "Aïn Defla", "B"], [45, "Naâma", "D"], [46, "Aïn Témouchent", "B"], [47, "Ghardaïa", "D"], [48, "Relizane", "B"],
    [49, "Timimoun", "E"], [50, "Bordj Badji Mokhtar", "E"], [51, "Ouled Djellal", "D"], [52, "Béni Abbès", "E"], [53, "In Salah", "E"], [54, "In Guezzam", "E"], [55, "Touggourt", "D"], [56, "Djanet", "E"],
    [57, "El M'Ghair", "D"], [58, "El Meniaa", "E"]
  ];
  var ZONE = {
    A: { name: "Alger & surroundings", home: 400, desk: 250, days: "1–2" },
    B: { name: "North", home: 600, desk: 400, days: "2–3" },
    C: { name: "High plateaus", home: 700, desk: 450, days: "2–4" },
    D: { name: "South", home: 900, desk: 600, days: "3–5" },
    E: { name: "Far south", home: 1300, desk: 900, days: "5–8" }
  };
  D.zones = ZONE;
  D.wilayas = W.map(function (w) {
    var z = ZONE[w[2]];
    var noDesk = [50, 54, 56].indexOf(w[0]) > -1;
    return { code: w[0], name: w[1], zone: w[2], home: z.home, desk: noDesk ? null : z.desk, days: z.days, enabled: [50, 54].indexOf(w[0]) === -1 };
  });

  D.carriers = [
    { id: "yalidine", name: "Yalidine", short: "Y", color: "#18403F", connected: true, isDefault: true, coverage: 58, deskPoints: 112, rate: 91, avgDays: 2.4, cod: "Weekly", active: 412, keyHint: "API ID + API token", account: "leezil-dz" },
    { id: "zr", name: "ZR Express", short: "ZR", color: "#C9A35E", textColor: "#0E2928", connected: true, isDefault: false, coverage: 58, deskPoints: 70, rate: 88, avgDays: 2.8, cod: "Twice a month", active: 96, keyHint: "Token + secret key", account: "LEEZIL" },
    { id: "maystro", name: "Maystro Delivery", short: "M", color: "#557A6E", connected: true, isDefault: false, coverage: 48, deskPoints: 30, rate: 86, avgDays: 3.1, cod: "Weekly", active: 41, keyHint: "API key", account: "store-8812" },
    { id: "ecotrack", name: "Ecotrack", short: "E", color: "#0E2928", connected: false, coverage: 58, deskPoints: 0, keyHint: "API token + partner URL" },
    { id: "noest", name: "Noest Express", short: "N", color: "#9DB3AA", textColor: "#0E2928", connected: false, coverage: 52, deskPoints: 0, keyHint: "API token + GUID" },
    { id: "own", name: "Own delivery team", short: "L", color: "#F1EDE2", textColor: "#18403F", connected: false, coverage: 0, deskPoints: 0, keyHint: "", manual: true }
  ];

  /* ---------- Storefront themes ---------- */
  D.themes = [
    { id: "ivory", name: "Ivory", desc: "Light and calm. Large product photos, made for small catalogues.", colors: ["#F1EDE2", "#18403F", "#C9A35E", "#FFFFFF"], current: true, version: "2.4" },
    { id: "pine", name: "Pine", desc: "Dark and premium. Suits watches, jewellery and gift boxes.", colors: ["#0E2928", "#F1EDE2", "#C9A35E", "#18403F"], version: "1.8" },
    { id: "landing", name: "One product", desc: "A single-product landing page with the order form on the page. Best for ads.", colors: ["#FFFFFF", "#18403F", "#C9A35E", "#D9E1DC"], version: "3.1" },
    { id: "grid", name: "Market", desc: "Dense product grid with filters. For large catalogues.", colors: ["#FFFFFF", "#0E2928", "#557A6E", "#F1EDE2"], version: "1.2" },
    { id: "mist", name: "Mist", desc: "Soft colours and rounded layout. Made for gifts and accessories.", colors: ["#D9E1DC", "#18403F", "#C9A35E", "#FFFFFF"], version: "1.0", isNew: true }
  ];

  D.findProduct = function (id) { return D.products.filter(function (p) { return p.id === id; })[0]; };
  D.findOrder = function (id) {
    var o = D.orders.filter(function (x) { return x.id === id; })[0];
    if (o) return o;
    var q = D.callQueue.filter(function (x) { return x.order === id && x.extra; })[0];
    if (q) { var e = q.extra; return Object.assign({ id: id, status: "New", carrier: "Yalidine", ago: q.waiting + " ago" }, e); }
    return null;
  };
  D.orderTotals = function (o) {
    var sub = o.items.reduce(function (s, it) { var p = D.findProduct(it.p); return s + (p ? p.price * it.qty : 0); }, 0);
    var w = D.wilayas.filter(function (x) { return x.name === o.wilaya; })[0];
    var ship = w ? (o.delivery === "Stop desk" ? (w.desk || w.home) : w.home) : 600;
    return { sub: sub, ship: ship, total: sub + ship };
  };
})();
