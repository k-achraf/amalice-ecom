-- Empties every product and order (and everything hanging off them) from the database.
-- KEEPS: admin users/roles, store settings, installed apps, Meta connections, wilayas/communes,
--        shipping rates, shipping companies + tariffs, categories, attributes, google sheets
--        config, page-view analytics, audit log, server logs.
-- IRREVERSIBLE. Take a backup first (see the commands given with this file).
--
-- Run:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/wipe-products-orders.sql
BEGIN;

-- CASCADE follows every foreign key, so this also empties: addresses, order_items, shipments,
-- shipment_events, call_attempts, notifications, order_attributions, cash_reconciliations,
-- ledger_entries, courier_webhook_events, google_sheet_order_rows, product_variants,
-- variant_options, product_images, product_offers, product_upsells, product_attributes,
-- product_landing_pages, funnels, funnel_steps, product_ad_tests, product_google_sheets,
-- stock_adjustments, reviews and the sourcing tables linked to products.
TRUNCATE TABLE orders, products, customers, remittance_batches, courier_webhook_logs RESTART IDENTITY CASCADE;

-- Sanity check: every count below must be 0.
SELECT 'orders' AS "table", count(*) FROM orders
UNION ALL SELECT 'products', count(*) FROM products
UNION ALL SELECT 'customers', count(*) FROM customers
UNION ALL SELECT 'order_items', count(*) FROM order_items
UNION ALL SELECT 'shipments', count(*) FROM shipments
UNION ALL SELECT 'product_variants', count(*) FROM product_variants
UNION ALL SELECT 'funnels', count(*) FROM funnels;

COMMIT;
