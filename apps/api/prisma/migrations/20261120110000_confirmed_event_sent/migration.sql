-- AlterTable
ALTER TABLE "orders" ADD COLUMN "confirmed_event_sent_at" TIMESTAMP(3);

-- Orders that were confirmed before this feature existed must not all be sent as new "Confirmed" events:
-- mark everything already past the call center as sent.
UPDATE "orders" SET "confirmed_event_sent_at" = NOW()
WHERE "state" NOT IN ('PendingCallCenter', 'CallCenterNoAnswer', 'WrongNumber', 'Postponed', 'Cancelled');
