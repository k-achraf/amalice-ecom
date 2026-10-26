-- Orders an agent confirmed from an abandoned cart never got their funnel (the capture did not carry it),
-- so they were missing from the funnel's stats. Tie them back through the page they were captured on.
UPDATE "orders" o
SET "funnel_id" = f."id"
FROM "order_attributions" a, "funnels" f
WHERE a."order_id" = o."id"
  AND o."funnel_id" IS NULL
  AND a."channel" = 'funnel'
  AND (a."page_url" ~ ('/f/' || f."slug" || '([/?#]|$)') OR a."landing_url" ~ ('/f/' || f."slug" || '([/?#]|$)'));
