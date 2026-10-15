-- Shipments that already progressed past "created" (or were recorded manually)
-- were necessarily accepted by the courier: mark them confirmed so the new
-- "awaiting courier confirmation" state only applies to genuinely unconfirmed parcels.
UPDATE "shipments"
SET "carrier_confirmed_at" = "created_at"
WHERE "carrier_confirmed_at" IS NULL
  AND ("courier_status" IS NULL OR "courier_status" <> 'created');
