// Icon paths from design/assets/js/app.js (24x24 grid, 1.6 stroke, round caps).
// Navigation and a few key actions use the design's own set so they match exactly;
// every other icon in the admin is lucide at the same stroke weight (see svg.i).
// Re-sync from design/assets/js/app.js (LZ.ICONS) when the design adds icons.
export const DESIGN_ICONS: Record<string, string> = {
  overview: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  orders: '<path d="M5.5 8h13l-1 12.5h-11L5.5 8z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>',
  headset: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3.5" y="13" width="4" height="6" rx="1"/><rect x="16.5" y="13" width="4" height="6" rx="1"/><path d="M18.5 19v.5a2 2 0 0 1-2 2H13"/>',
  cart: '<path d="M3 4h2.5l2.2 11h10.6l2-8H6.6"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  products: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  layers: '<path d="M12 3.5l8.5 4.5L12 12.5 3.5 8 12 3.5z"/><path d="M3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5"/>',
  customers: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c1.8.8 3 2.6 3 4.7"/>',
  rates: '<path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8a1.4 1.4 0 0 1 0 2l-7 7a1.4 1.4 0 0 1-2 0l-8-8z"/><circle cx="8" cy="8" r="1.3"/>',
  delivery: '<path d="M2.5 6.5h12v10h-12z"/><path d="M14.5 10h4l3 3v3.5h-7"/><circle cx="6.5" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/>',
  store: '<path d="M4 9.5V20h16V9.5"/><path d="M3 9.5l1.5-5h15l1.5 5c0 1.4-1.1 2.5-2.5 2.5S16 10.9 16 9.5c0 1.4-1.1 2.5-2.5 2.5h-3C9.1 12 8 10.9 8 9.5 8 10.9 6.9 12 5.5 12S3 10.9 3 9.5z"/><path d="M10 20v-4.5h4V20"/>',
  apps: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M17 3.5v7M13.5 7h7"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.4-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5.1-7.5-9.5V6L12 3z"/><path d="M9 12l2 2 4-4"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  external: '<path d="M7 17L17 7M9 7h8v8"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  logout: '<path d="M10 4.5H5.5v15H10M15 8l4 4-4 4M19 12H9.5"/>'
}
