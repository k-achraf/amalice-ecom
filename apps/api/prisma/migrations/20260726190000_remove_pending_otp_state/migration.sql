-- Remove OTP verification: orders no longer pass through PendingOTP before
-- call-center confirmation. Move any existing PendingOTP rows to
-- PendingCallCenter (the state they'd have reached after OTP verification
-- anyway) before dropping the enum value — Postgres can't drop an enum
-- value in place, so the type is recreated.

UPDATE "orders" SET "state" = 'PendingCallCenter' WHERE "state" = 'PendingOTP';

ALTER TABLE "orders" ALTER COLUMN "state" DROP DEFAULT;

CREATE TYPE "OrderState_new" AS ENUM (
  'PendingCallCenter',
  'CallCenterNoAnswer',
  'Cancelled',
  'Confirmed',
  'Packed',
  'HandedToCourier',
  'OutForDelivery',
  'DeliveryFailed',
  'Delivered',
  'ReturnedToOrigin',
  'Restocked',
  'CashCollected',
  'Reconciled',
  'Settled'
);

ALTER TABLE "orders" ALTER COLUMN "state" TYPE "OrderState_new" USING ("state"::text::"OrderState_new");

DROP TYPE "OrderState";
ALTER TYPE "OrderState_new" RENAME TO "OrderState";

ALTER TABLE "orders" ALTER COLUMN "state" SET DEFAULT 'PendingCallCenter';
