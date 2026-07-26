#!/usr/bin/env bash
# Starts the full Amalice dev stack in one shot:
#   1. Docker services (Postgres, Redis, Meilisearch)
#   2. Dependencies (pnpm install)
#   3. Database migrations + seed data
#   4. All three apps (storefront :3000, admin :3001, api :3333)
#
# Works as-is on Linux/macOS bash and on Windows via Git Bash (the bash
# that ships with Git for Windows — the same shell used throughout this
# project's own tooling). Run it with:
#   ./start.sh        (Linux/macOS, or Git Bash on Windows)
#   bash start.sh      (if it isn't marked executable)
#
# Re-running is safe: env files are only created if missing, migrations are
# idempotent, and seeding is upsert-based (never creates duplicates).
set -euo pipefail
cd "$(dirname "$0")"

echo "==> Checking prerequisites"
command -v docker >/dev/null 2>&1 || {
  echo "Docker is required — install Docker Desktop (or Docker Engine) first." >&2
  exit 1
}
command -v pnpm >/dev/null 2>&1 || {
  echo "pnpm is required — see https://pnpm.io/installation" >&2
  exit 1
}

echo "==> Setting up env files (skipped for any that already exist)"
[ -f .env ] || cp .env.example .env
[ -f apps/api/.env ] || cp apps/api/.env.example apps/api/.env
[ -f apps/storefront/.env ] || cp apps/storefront/.env.example apps/storefront/.env
[ -f apps/admin/.env ] || cp apps/admin/.env.example apps/admin/.env

echo "==> Starting Postgres, Redis, Meilisearch (Docker) and waiting for them to be healthy"
# If this hangs or fails: something else is likely already listening on
# 5432/6379/7700 on the host. Postgres is deliberately mapped to 5433 (see
# POSTGRES_PORT in .env.example) for exactly this reason, but Redis/
# Meilisearch use their standard ports and could still collide.
docker compose up -d --wait

echo "==> Installing dependencies"
pnpm install

echo "==> Applying database migrations"
(cd apps/api && pnpm exec prisma migrate deploy)

echo "==> Seeding database"
(cd apps/api && pnpm exec prisma db seed)

echo "==> Starting storefront (:3000), admin (:3001), and api (:3333)"
echo "    Ctrl+C stops all three — Docker services keep running in the background."
echo "    OTP codes for checkout/login aren't really sent anywhere yet; watch this"
echo "    terminal's api output for 'OTP for +1...: 123456' lines during testing."
pnpm dev
