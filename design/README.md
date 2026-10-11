# Leezil Admin Dashboard

A static HTML/CSS/JS admin dashboard for the Leezil store. It has no build step and no dependencies.

## Run it
Open `index.html` in a browser. You can also serve the folder with any static server, for example:

```
python3 -m http.server 8000
```

## Structure
```
index.html        Overview (KPIs, revenue chart, statuses, recent orders, top products, wilayas)
orders.html       Orders: status filters, search, select all
products.html     Products & stock: category filters, search, stock levels
customers.html    Customers: search, click a row to see details
assets/css/style.css   Brand tokens (Leezil Teal, Ivory, Brass…) and all styles
assets/js/data.js      Sample data. Replace it with your API / database
assets/js/app.js       Shared sidebar and mobile tab bar, icons, and the logic for each page
assets/img/            Logo and icon (SVG)
```

## Notes
- The layout is responsive. Below 860px the sidebar becomes a bottom tab bar.
- All the numbers, names and products in `data.js` and in the HTML are placeholders.
- Font: Outfit, loaded from Google Fonts.
