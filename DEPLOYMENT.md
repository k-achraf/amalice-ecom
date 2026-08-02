# Deploying Amalice to a VPS

No Docker — this is a plain Node/PM2/Nginx deployment. Three processes run on
one VPS, proxied by Nginx over HTTPS:

| Process               | Port (internal) | Domain                  |
| ---------------------- | ---------------- | ------------------------ |
| `amalice-storefront`  | 3000             | `yourdomain.com`        |
| `amalice-admin`       | 3001             | `admin.yourdomain.com`  |
| `amalice-api`         | 3333             | `api.yourdomain.com`    |

The API requires a reachable **Postgres** database and **Redis** instance to
boot (Redis connects during Nest module init — the process won't finish
starting without it).

---

## 0. Before you start

- A VPS (Ubuntu 22.04/24.04, 2 GB RAM minimum) with root/sudo access.
- A domain you control, with access to its DNS records.
- This repo pushed somewhere you can `git clone` from the VPS (or uploaded
  via `scp`/`rsync`).

---

## 1. Point DNS at the VPS

In your domain registrar's DNS panel, add four **A records**, all pointing
at the VPS's IP:

| Type | Host  | Value       |
| ---- | ----- | ----------- |
| A    | `@`   | `<VPS_IP>` |
| A    | `www` | `<VPS_IP>` |
| A    | `admin` | `<VPS_IP>` |
| A    | `api`   | `<VPS_IP>` |

Wait for propagation before continuing (usually minutes):

```bash
dig +short yourdomain.com
dig +short admin.yourdomain.com
dig +short api.yourdomain.com
```

Each should return `<VPS_IP>`.

---

## 2. Provision the VPS

SSH in as root:

```bash
apt update && apt upgrade -y
apt install -y curl git build-essential ufw nginx
```

### Node, pnpm, PM2

The repo pins `node "^22.13.0 || ^24.11.0 || >=26.0.0"` and
`pnpm@10.33.2` (root `package.json`'s `packageManager` field) — match it.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
corepack enable
corepack prepare pnpm@10.33.2 --activate
npm install -g pm2
node -v && pnpm -v
```

### Postgres and Redis

```bash
apt install -y postgresql postgresql-contrib redis-server
systemctl enable --now postgresql redis-server

sudo -u postgres psql -c "CREATE USER amalice WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE amalice OWNER amalice;"
```

Sanity check Redis: `redis-cli ping` → should print `PONG`.

---

## 3. Create a deploy user and get the code onto the box

Don't run the app as root.

```bash
adduser --disabled-password --gecos "" amalice
usermod -aG sudo amalice
su - amalice

git clone <your-repo-url> /home/amalice/app
cd /home/amalice/app
```

---

## 4. Configure environment files

### `apps/api/.env`

Only `JWT_SECRET`/`JWT_REFRESH_SECRET` have no usable default — but you also
**must** override the Postgres/Redis dev defaults (they point at
`localhost` dev credentials otherwise).

Generate two secrets first:

```bash
openssl rand -hex 32   # → JWT_SECRET
openssl rand -hex 32   # → JWT_REFRESH_SECRET
```

Then write the file (paste the two generated values in place of the
placeholders):

```bash
cat > apps/api/.env <<'EOF'
NODE_ENV=production
PORT=3333
DATABASE_URL=postgresql://amalice:CHANGE_ME_STRONG_PASSWORD@localhost:5432/amalice
REDIS_URL=redis://localhost:6379

JWT_SECRET=PASTE_GENERATED_SECRET_HERE
JWT_REFRESH_SECRET=PASTE_GENERATED_SECRET_HERE

# Optional integrations — leave blank to disable each cleanly, no broken boot
GEMINI_API_KEY=
GOOGLE_SHEETS_CLIENT_EMAIL=
GOOGLE_SHEETS_PRIVATE_KEY=
EOF
```

> `GOOGLE_SHEETS_PRIVATE_KEY` (if you use that integration) must keep its
> literal `\n` escapes exactly as they appear in the downloaded service
> account JSON — don't convert them to real line breaks.

### `apps/admin/.env` and `apps/storefront/.env`

Both just need the API's public URL (read at **runtime**, not baked into
the build — you can change this later without rebuilding, just restart the
process):

```bash
echo "NUXT_PUBLIC_API_BASE=https://api.yourdomain.com" > apps/admin/.env

cat > apps/storefront/.env <<'EOF'
NUXT_PUBLIC_API_BASE=https://api.yourdomain.com
NUXT_PUBLIC_SITE_URL=https://yourdomain.com
EOF
```

---

## 5. Install dependencies and build

```bash
cd /home/amalice/app
pnpm install --frozen-lockfile
pnpm turbo run build
```

`turbo run build` builds `packages/shared`/`packages/ui` first (dependency
order), then all three apps:
- `apps/api/dist/` (NestJS, plain `tsc`)
- `apps/admin/.output/` (Nuxt/Nitro)
- `apps/storefront/.output/` (Nuxt/Nitro)

**This step is required before anything can start** — PM2 runs the built
output (`dist/main.js`, `.output/server/index.mjs`), not source files.

---

## 6. Run database migrations

```bash
cd apps/api
pnpm exec prisma migrate deploy
cd ../..
```

Use `migrate deploy`, **not** `migrate dev` — `dev` is interactive and
expects a disposable shadow database; `deploy` is the non-interactive
command meant for production, applying already-committed migrations.

> **Do not run `apps/api/prisma/seed.ts` against production.** It creates a
> hardcoded admin login (`dev-password-123` for every seeded role) plus
> fake demo products/customers/orders — it's dev-only fixture data. If you
> need a first admin account, write a small one-off script to create just
> that user, or run the seed once and **immediately change that account's
> password** through the admin UI, then delete any other seeded admin
> accounts.

---

## 7. Set up the persistent uploads directory

Product images uploaded through the admin land on local disk at
`apps/api/uploads/`, relative to the API process's working directory. This
is **not** synced to S3/R2 or anything external — treat it as stateful data.

```bash
mkdir -p /home/amalice/app/apps/api/uploads
```

- Always start the API with `apps/api` as its working directory (the PM2
  config below does this via `cwd`).
- Back this folder up — a redeploy or `rm -rf` here loses every uploaded
  product image permanently.

---

## 8. Start everything with PM2

> **Why this file parses `.env` itself:** `apps/api` boots through Nest's
> `ConfigModule.forRoot()`, which loads `apps/api/.env` on its own — no
> extra wiring needed there. But `apps/admin` and `apps/storefront` are
> Nuxt/Nitro apps, and the **built, standalone `.output/server/index.mjs`
> does not read `.env` files at runtime** (that auto-loading only happens
> during `nuxt dev`/`nuxt build`, confirmed by direct testing). Since
> `runtimeConfig.public.apiBase` is only overridden by an actual env var
> already present in the process's environment when Nitro boots, the value
> from `apps/admin/.env` / `apps/storefront/.env` has to be read here and
> injected into PM2's `env` block — otherwise it silently falls back to
> `nuxt.config.ts`'s hardcoded default (`http://localhost:3333`), which is
> exactly the bug this replaced.

```bash
cd /home/amalice/app
cat > ecosystem.config.cjs <<'EOF'
const fs = require('fs')
const path = require('path')

// Minimal dependency-free ".env" parser (KEY=value per line, '#' comments,
// optional quotes) — deliberately not requiring the `dotenv` package here,
// since pnpm's strict node_modules layout doesn't guarantee it's resolvable
// from this repo-root script.
function loadEnvFile(relPath) {
  const fullPath = path.join(__dirname, relPath)
  if (!fs.existsSync(fullPath)) return {}
  const out = {}
  for (const line of fs.readFileSync(fullPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

module.exports = {
  apps: [
    {
      name: 'amalice-api',
      cwd: './apps/api',
      script: 'dist/main.js',
      env: { NODE_ENV: 'production', ...loadEnvFile('apps/api/.env') }
    },
    {
      name: 'amalice-admin',
      cwd: './apps/admin',
      script: '.output/server/index.mjs',
      env: { NODE_ENV: 'production', PORT: 3001, HOST: '0.0.0.0', ...loadEnvFile('apps/admin/.env') }
    },
    {
      name: 'amalice-storefront',
      cwd: './apps/storefront',
      script: '.output/server/index.mjs',
      env: { NODE_ENV: 'production', PORT: 3000, HOST: '0.0.0.0', ...loadEnvFile('apps/storefront/.env') }
    }
  ]
}
EOF

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # run the command it prints (as the user it tells you to)
```

If you already have an `ecosystem.config.cjs` from before this fix, replace
it with the version above, then re-apply it — a plain `restart` isn't
enough because PM2 caches the `env` block from when the process was *first
started* with that config; you need PM2 to re-read the file:

```bash
pm2 delete amalice-admin amalice-storefront
pm2 start ecosystem.config.cjs --only amalice-admin,amalice-storefront
pm2 save
```

Verify:

```bash
pm2 status
pm2 logs amalice-api --lines 50
pm2 logs amalice-admin --lines 50
pm2 logs amalice-storefront --lines 50
```

All three should show `online`. If `amalice-api` crash-loops, it's almost
always Postgres/Redis connectivity or a missing `JWT_SECRET`/
`JWT_REFRESH_SECRET` — check `pm2 logs amalice-api`.

---

## 9. Nginx reverse proxy

First, enable gzip compression at the `http` level — without this, the
storefront's CSS bundle (500KB+ uncompressed, mostly Tailwind utility
classes that compress extremely well) is served raw. On fast Wi-Fi this is
invisible; on a slow mobile connection it can take long enough that the
page renders with no styling at all before the stylesheet finishes
downloading. This bit us for real — a customer on a slow Android connection
saw a completely unstyled page while desktop was fine.

```bash
sudo tee /etc/nginx/conf.d/gzip.conf <<'EOF'
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss image/svg+xml font/woff2;
EOF
sudo nginx -t && sudo systemctl reload nginx
```

```bash
sudo tee /etc/nginx/sites-available/amalice <<'EOF'
server {
    listen 80;
    server_name api.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3333;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name admin.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/amalice /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Replace every `yourdomain.com` above with your real domain first (or
`sed -i 's/yourdomain.com/yourrealdomain.com/g' /etc/nginx/sites-available/amalice`
after creating the file).

---

## 10. SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx \
  -d yourdomain.com -d www.yourdomain.com \
  -d admin.yourdomain.com -d api.yourdomain.com
```

Certbot edits the Nginx config in place to add HTTPS + redirect HTTP→HTTPS,
and sets up auto-renewal (`certbot renew` via systemd timer, already
enabled by the package).

---

## 11. Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

Do **not** open 3000/3001/3333 externally — Nginx is the only public entry
point; the PM2-managed processes only need to be reachable from
`127.0.0.1`.

---

## 12. Harden CORS before going fully live

`apps/api/src/main.ts` currently calls `app.enableCors()` with no options —
this is wide open (`Access-Control-Allow-Origin: *`, any origin allowed).
It works, but isn't locked to your real domains. Before relying on this in
production, restrict it, e.g.:

```ts
app.enableCors({
  origin: ['https://yourdomain.com', 'https://www.yourdomain.com', 'https://admin.yourdomain.com'],
  credentials: true
})
```

Rebuild and restart the API after this change (`pnpm --filter api build`
then `pm2 restart amalice-api`).

---

## 13. Smoke test

- `https://yourdomain.com` — storefront loads, products render.
- `https://admin.yourdomain.com` — admin login page loads.
- `https://api.yourdomain.com/settings` — should return JSON (public
  endpoint), confirming the API is reachable through the proxy.
- Log into the admin, place a test order on the storefront, confirm it
  shows up in the admin's Orders queue.

---

## Redeploying after code changes

```bash
cd /home/amalice/app
git pull
pnpm install --frozen-lockfile
pnpm turbo run build
cd apps/api && pnpm exec prisma migrate deploy && cd ../..
pm2 reload ecosystem.config.cjs
```

### When you *don't* need a full rebuild

| Change                                   | What to do instead              |
| ----------------------------------------- | -------------------------------- |
| `apps/api/.env` value (secrets, DB URL)   | `pm2 restart amalice-api`       |
| `NUXT_PUBLIC_API_BASE` / site URL         | `pm2 restart amalice-admin` / `amalice-storefront` |
| Any `.ts`/`.vue` source change            | Rebuild that app, then `pm2 reload` |
| Prisma schema change                      | Rebuild `apps/api`, then `prisma migrate deploy` |

---

## Reference: required vs. optional env vars (`apps/api`)

| Var | Required? | Notes |
| --- | --- | --- |
| `JWT_SECRET` | **Yes** | min 32 chars, no default |
| `JWT_REFRESH_SECRET` | **Yes** | min 32 chars, no default |
| `DATABASE_URL` | Yes (has a dev-only default) | must point at your real Postgres |
| `REDIS_URL` | Yes (has a dev-only default) | API won't finish booting without a reachable Redis |
| `PORT` | No | defaults to 3333 |
| `NODE_ENV` | No | defaults to `development` — set `production` |
| `GEMINI_API_KEY` | No | AI landing-page builder; feature no-ops if unset |
| `GOOGLE_SHEETS_CLIENT_EMAIL` / `GOOGLE_SHEETS_PRIVATE_KEY` | No | Google Sheets integration; both must be set together or the feature no-ops |
