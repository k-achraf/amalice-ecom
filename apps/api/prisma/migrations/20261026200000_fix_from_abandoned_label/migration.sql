-- Orders the customer submitted themselves went through an abandoned-cart capture first (the form saves
-- as soon as the phone is typed) and were labelled "abandoned" for good. Only carts an agent confirmed
-- (their audit row says so) or that are still unsubmitted keep the label.
UPDATE "orders" SET "from_abandoned" = false
WHERE "from_abandoned" = true
  AND "is_abandoned" = false
  AND "id" NOT IN (
    SELECT "entity_id" FROM "audit_logs"
    WHERE "entity" = 'Order' AND ("metadata"->>'convertedFromAbandoned') = 'true'
  );
