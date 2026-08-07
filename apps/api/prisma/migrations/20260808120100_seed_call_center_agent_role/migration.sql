-- Seed the roles row for the CallCenterAgent enum value added in the
-- previous migration — split into its own migration file because Postgres
-- won't let a newly-added enum value be referenced in the same transaction
-- that added it (ALTER TYPE ... ADD VALUE). roles.name is unique-constrained
-- against AdminRoleName (see Role's Prisma comment). pnpm exec prisma db
-- seed already upserts one row per AdminRoleName value generically, but
-- that's a dev-only script; this migration is what actually creates the row
-- on an existing/production database that never re-runs seed.ts. id is a
-- literal UUID (not gen_random_uuid()) because this repo's id columns are
-- Prisma client-side @default(uuid()), not a DB-level default to reuse here.
INSERT INTO "roles" ("id", "name")
VALUES ('d992ab6d-7d95-4849-b3ea-4d2ac35bacd0', 'CallCenterAgent')
ON CONFLICT ("name") DO NOTHING;
