// Icon paths from design/assets/js/app.js (24x24 grid, 1.6 stroke, round caps).
// Used for the primary navigation so it matches the design exactly; every other
// icon in the admin comes from lucide at the same stroke weight (see svg.i).
export const DESIGN_ICONS: Record<string, string> = {
  overview: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  orders: '<path d="M5.5 8h13l-1 12.5h-11L5.5 8z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>',
  products: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  customers: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c1.8.8 3 2.6 3 4.7"/>',
  discounts: '<path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8a1.4 1.4 0 0 1 0 2l-7 7a1.4 1.4 0 0 1-2 0l-8-8z"/><circle cx="8" cy="8" r="1.3"/>',
  delivery: '<path d="M2.5 6.5h12v10h-12z"/><path d="M14.5 10h4l3 3v3.5h-7"/><circle cx="6.5" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  external: '<path d="M7 17L17 7M9 7h8v8"/>',
  more: '<circle cx="5.5" cy="12" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="18.5" cy="12" r=".8"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>'
}
