-- AlterEnum
-- Splits the single "Cancelled" outcome into a pre-confirmation
-- ("Cancelled", unchanged) and post-confirmation ("CancelledShipping", new)
-- variant — see OrderState's Prisma comment. No data backfill is required:
-- every existing row that was cancelled from Confirmed/OnHold still reads as
-- "Cancelled" (the old, single value) until an admin explicitly cancels it
-- again through the now-split transition, which is an acceptable one-time
-- historical-accuracy gap for existing rows, not a correctness bug going
-- forward.
ALTER TYPE "OrderState" ADD VALUE 'CancelledShipping';
