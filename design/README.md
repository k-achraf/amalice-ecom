# Leezil Admin Dashboard

A static HTML/CSS/JS admin dashboard for the Leezil store. It has no build step and no dependencies. Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

## Pages
| File | Page |
|---|---|
| `index.html` | Overview |
| `orders.html` | Orders list (filters, search, bulk actions) |
| `order.html?id=LZ-2479` | Order details (status flow, delivery, activity, cancel) |
| `call-center.html` | Call center: unconfirmed orders queue and call workspace |
| `abandoned-carts.html` | Abandoned carts, funnel, automatic reminder |
| `customers.html` | Customers |
| `products.html` | Products list |
| `product-edit.html` / `product-edit.html?id=3` | Create / edit a product (media, pricing, variants, offers, SEO) |
| `attributes.html` | Attributes & options (color swatches, buttons, dropdown) |
| `shipping-rates.html` | Delivery prices per wilaya (58), zones, free delivery |
| `shipping-companies.html` | Shipping companies, settings, automatic assignment |
| `storefront.html` | Themes (choose the main theme), store settings, order form |
| `apps.html` | Apps catalogue with per-app settings |
| `users.html` | Team users, roles & permissions, security |

## Structure
```
assets/css/style.css     Brand tokens and all styles (small radii, square markers)
assets/js/data.js        Sample data. Replace it with your API / database
assets/js/app.js         Shared: icons, sidebar & mobile menu, modal/drawer, toast, save bar
assets/js/pages/*.js     One script per page
assets/img/              Logo and icon (SVG)
```

## Notes
- The layout is responsive. Below 860px the sidebar becomes a slide-out menu with a bottom tab bar.
- All data is placeholder data, and actions (save, confirm, install...) only update the page in memory.
- Fonts: Outfit, loaded from Google Fonts.
