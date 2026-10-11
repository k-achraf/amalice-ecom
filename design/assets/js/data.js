/*
 * Leezil Admin — sample data.
 * Everything here is placeholder data for the design. Replace it with
 * calls to your store's API / database when wiring the dashboard up.
 */
window.LEEZIL_DATA = {
  // Daily revenue in DA, oldest first (last 30 days and the 30 days before)
  revenue: {
    start: "2026-09-12",
    current: [27400, 29200, 35000, 35100, 36100, 40500, 46000, 44400, 43000, 36100, 37500, 33100, 30600, 28800, 29400, 36800, 36800, 38400, 40700, 37500, 41800, 48200, 52200, 55900, 58100, 51400, 57000, 57300, 54700, 49900],
    previous: [29800, 28000, 35200, 34400, 30900, 27500, 30700, 26300, 27300, 26100, 23100, 22900, 25600, 26100, 26200, 29900, 36400, 32400, 34000, 39600, 37000, 38500, 36800, 34200, 37700, 29700, 30200, 27800, 31300, 29200]
  },

  statusCounts: { "New": 12, "Confirmed": 28, "Out for delivery": 45, "Delivered": 241, "Returned": 16 },

  orders: [
    { id: "#LZ-2481", date: "11 Oct · 10:42", ago: "12 min ago", name: "Yacine Benali", phone: "+213 5•• •• •• 41", wilaya: "Alger", delivery: "Home", items: "Wireless Buds", total: 4900, status: "New" },
    { id: "#LZ-2480", date: "11 Oct · 10:16", ago: "38 min ago", name: "Sara Hamidi", phone: "+213 6•• •• •• 07", wilaya: "Oran", delivery: "Stop desk", items: "Wireless Buds ×2", total: 9800, status: "New" },
    { id: "#LZ-2479", date: "11 Oct · 09:31", ago: "1 h ago", name: "Karim Boudiaf", phone: "+213 7•• •• •• 63", wilaya: "Constantine", delivery: "Home", items: "Smartwatch S2, Leather strap", total: 12400, status: "Confirmed" },
    { id: "#LZ-2478", date: "11 Oct · 08:55", ago: "2 h ago", name: "Imane Cherif", phone: "+213 5•• •• •• 19", wilaya: "Sétif", delivery: "Stop desk", items: "Phone case, Screen guard", total: 3200, status: "Out for delivery" },
    { id: "#LZ-2477", date: "10 Oct · 19:20", ago: "3 h ago", name: "Amine Lounis", phone: "+213 6•• •• •• 88", wilaya: "Blida", delivery: "Home", items: "Studio Headphones", total: 6900, status: "Delivered" },
    { id: "#LZ-2476", date: "10 Oct · 17:04", ago: "5 h ago", name: "Nesrine Taleb", phone: "+213 7•• •• •• 25", wilaya: "Annaba", delivery: "Home", items: "Fast Charger 30W", total: 2700, status: "Returned" },
    { id: "#LZ-2475", date: "10 Oct · 15:47", ago: "yesterday", name: "Walid Mansouri", phone: "+213 5•• •• •• 92", wilaya: "Tizi Ouzou", delivery: "Stop desk", items: "Sunglasses Classic", total: 3900, status: "Out for delivery" },
    { id: "#LZ-2474", date: "10 Oct · 14:12", ago: "yesterday", name: "Lina Zerrouki", phone: "+213 6•• •• •• 36", wilaya: "Alger", delivery: "Home", items: "Gift box, Silver ring", total: 7500, status: "Confirmed" },
    { id: "#LZ-2473", date: "10 Oct · 11:38", ago: "yesterday", name: "Rania Haddad", phone: "+213 7•• •• •• 54", wilaya: "Béjaïa", delivery: "Home", items: "Smartwatch S2", total: 9000, status: "Delivered" },
    { id: "#LZ-2472", date: "10 Oct · 09:03", ago: "yesterday", name: "Mehdi Saadi", phone: "+213 5•• •• •• 70", wilaya: "Tlemcen", delivery: "Stop desk", items: "Wireless Buds", total: 4900, status: "New" }
  ],

  products: [
    { name: "Wireless Buds", sku: "LZ-AUD-014", cat: "Audio", icon: "earbuds", price: 4900, stock: 6, sold: 68 },
    { name: "Studio Headphones", sku: "LZ-AUD-022", cat: "Audio", icon: "headphones", price: 6900, stock: 34, sold: 22 },
    { name: "Smartwatch S2", sku: "LZ-WCH-002", cat: "Watches", icon: "smartwatch", price: 9000, stock: 18, sold: 31 },
    { name: "Fast Charger 30W", sku: "LZ-CHG-030", cat: "Chargers", icon: "charger", price: 2700, stock: 3, sold: 47 },
    { name: "Clear Phone Case", sku: "LZ-PHN-110", cat: "Phone", icon: "phone", price: 1600, stock: 142, sold: 59 },
    { name: "Sunglasses Classic", sku: "LZ-ACC-207", cat: "Accessories", icon: "sunglasses", price: 3900, stock: 27, sold: 14 },
    { name: "Silver Ring", sku: "LZ-ACC-315", cat: "Accessories", icon: "ring", price: 3500, stock: 0, sold: 9 },
    { name: "Gift Box — Tech Edit", sku: "LZ-GFT-001", cat: "Gifts", icon: "gift", price: 7500, stock: 12, sold: 11 },
    { name: "Magnetic Cable 1m", sku: "LZ-CHG-041", cat: "Chargers", icon: "charger", price: 1200, stock: 0, sold: 26 }
  ],

  customers: [
    { name: "Lina Zerrouki", phone: "+213 6•• •• •• 36", wilaya: "Alger", orders: 9, spent: 52300, last: "10 Oct", segment: "VIP", since: "Mar 2025", delivery: "Home", returns: 0, lastItem: "Gift box, Silver ring", lastTotal: 7500 },
    { name: "Karim Boudiaf", phone: "+213 7•• •• •• 63", wilaya: "Constantine", orders: 6, spent: 38700, last: "11 Oct", segment: "VIP", since: "Jun 2025", delivery: "Home", returns: 1, lastItem: "Smartwatch S2, Leather strap", lastTotal: 12400 },
    { name: "Sara Hamidi", phone: "+213 6•• •• •• 07", wilaya: "Oran", orders: 4, spent: 21500, last: "11 Oct", segment: "Repeat", since: "Jan 2026", delivery: "Stop desk", returns: 0, lastItem: "Wireless Buds ×2", lastTotal: 9800 },
    { name: "Amine Lounis", phone: "+213 6•• •• •• 88", wilaya: "Blida", orders: 3, spent: 16200, last: "10 Oct", segment: "Repeat", since: "Apr 2026", delivery: "Home", returns: 0, lastItem: "Studio Headphones", lastTotal: 6900 },
    { name: "Rania Haddad", phone: "+213 7•• •• •• 54", wilaya: "Béjaïa", orders: 2, spent: 12900, last: "10 Oct", segment: "Repeat", since: "Jul 2026", delivery: "Home", returns: 0, lastItem: "Smartwatch S2", lastTotal: 9000 },
    { name: "Imane Cherif", phone: "+213 5•• •• •• 19", wilaya: "Sétif", orders: 2, spent: 6700, last: "11 Oct", segment: "Repeat", since: "Aug 2026", delivery: "Stop desk", returns: 0, lastItem: "Phone case, Screen guard", lastTotal: 3200 },
    { name: "Yacine Benali", phone: "+213 5•• •• •• 41", wilaya: "Alger", orders: 1, spent: 4900, last: "11 Oct", segment: "New", since: "Oct 2026", delivery: "Home", returns: 0, lastItem: "Wireless Buds", lastTotal: 4900 },
    { name: "Mehdi Saadi", phone: "+213 5•• •• •• 70", wilaya: "Tlemcen", orders: 1, spent: 4900, last: "10 Oct", segment: "New", since: "Oct 2026", delivery: "Stop desk", returns: 0, lastItem: "Wireless Buds", lastTotal: 4900 }
  ],

  wilayas: [
    { name: "Alger", share: 24 }, { name: "Oran", share: 14 }, { name: "Constantine", share: 9 },
    { name: "Sétif", share: 7 }, { name: "Blida", share: 6 }, { name: "Other wilayas", share: 40 }
  ]
};
