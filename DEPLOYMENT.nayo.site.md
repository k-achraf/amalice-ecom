# Deploying Nayo to `nayo.site` (same VPS as Amalice)

The `nayo.site` version of [`DEPLOYMENT.md`](DEPLOYMENT.md), updated with everything added since that file
was last changed (2026-10-15): funnels, AI (Settings → AI models), Meta Ads, Telegram reports, inventory
and returns, trust proxy, and the storefront's build memory.

**Nayo runs on the same VPS as the existing Amalice deployment, from the same code.** The two are fully
separate deployments that only share the machine, Nginx, Postgres (server) and Redis (server):

|                     | Amalice (already running)  | Nayo (this guide)            |
| ------------------- | -------------------------- | ---------------------------- |
| Linux user / folder | `amalice` / `/home/amalice/app` | `nayo` / `/home/nayo/app` |
| PM2 processes       | `amalice-*`                | `nayo-*`                     |
| Storefront          | 3000 · `amalice.shop`      | **4000** · `nayo.site`, `www.nayo.site` |
| Admin               | 3001 · `admin.amalice.shop`| **4001** · `admin.nayo.site` |
| Funnels             | 3002                       | **4002** · `offers.nayo.site` |
| API                 | 3333 · `api.amalice.shop`  | **4333** · `api.nayo.site`   |
| Postgres database   | `amalice`                  | `nayo`                       |
| Redis database      | `0` (`redis://localhost:6379`) | **`1`** (`redis://localhost:6379/1`) |
| Uploads             | `/home/amalice/app/apps/api/uploads` | `/home/nayo/app/apps/api/uploads` |

No Docker: Node + PM2 + Nginx, everything over HTTPS.

> To use another name for the funnels site instead of `offers.nayo.site`, change it everywhere it appears
> below (DNS, Nginx, SSL, `CORS_EXTRA_ORIGINS`, `NUXT_PUBLIC_FUNNELS_BASE`).

---

## ⚠️ Read first

1. **Nayo needs the multi-store code** (commit that adds `CORS_ORIGINS` and reads the store name from
   settings). Amalice needs nothing new: without `CORS_ORIGINS` it keeps the `amalice.shop` defaults, and
   its store name ("Amalice") comes from its own database.
2. **Redis must be a different database number (`/1`).** On the same Redis database the two APIs share
   BullMQ queues, AI usage counters and caches: one store's daily Telegram report, alerts and `Delivered`
   events to Meta/TikTok would be processed by the other store's API, against the other database.
3. **Ports must not collide** — Nayo uses 4000/4001/4002/4333. A port already in use makes the PM2
   process crash-loop with `EADDRINUSE`.
4. **Admin is an SPA (`ssr: false`)**: export the `NUXT_PUBLIC_*` vars in the build shell (step 5), or the
   admin's product/funnel links point at `amalice.shop` / `leezil.com`. The storefront reads
   `NUXT_PUBLIC_API_BASE` and `NUXT_PUBLIC_SITE_*` at build time too.
5. **Empty optional env vars crash the API.** `GEMINI_API_KEY=` (empty) fails validation
   (`Invalid environment configuration … Too small`). Give a real value or comment the line out.
6. **Never build both stores at the same time** on a small box — one Nuxt build already needs ~3 GB
   (RAM+swap). Redeploy them one after the other.
7. **Set the store name in the Nayo admin** (Settings → Storefront → store name: `Nayo`) right after the
   first login: page titles, footer, About/Terms pages, structured data for Google, the admin's title
   and the Telegram messages all use it.

---

## 0. Before you start

- The VPS already runs Amalice per [`DEPLOYMENT.md`](DEPLOYMENT.md) (Node, pnpm, PM2, Postgres, Redis,
  Nginx with `conf.d/gzip.conf`, certbot, ufw, swap). Those steps are **not** repeated here.
- RAM: two full sets of processes (8 Node processes + Postgres + Redis) — **4 GB RAM** is the realistic
  minimum; on 2 GB expect heavy swapping.
- Access to the DNS settings of `nayo.site`.

Check what's free before starting:

```bash
free -h && swapon --show
sudo ss -ltnp | grep -E ':(4000|4001|4002|4333)\b' || echo "Nayo ports are free"
redis-cli -n 1 dbsize          # should be 0 (nothing else uses Redis DB 1)
```

If swap is under 4 GB, grow it (as root):

```bash
swapoff /swapfile && fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
```

---

## 1. DNS

At the registrar, add **A** records, all pointing at the VPS IP:

| Type | Host     | Value      |
| ---- | -------- | ---------- |
| A    | `@`      | `<VPS_IP>` |
| A    | `www`    | `<VPS_IP>` |
| A    | `admin`  | `<VPS_IP>` |
| A    | `api`    | `<VPS_IP>` |
| A    | `offers` | `<VPS_IP>` |

```bash
for h in nayo.site www.nayo.site admin.nayo.site api.nayo.site offers.nayo.site; do echo "$h -> $(dig +short $h)"; done
```

> **Don't turn on the Cloudflare proxy (orange cloud)** unless you also set `TRUST_PROXY=2` in
> `apps/api/.env` (step 4) — otherwise the API sees Cloudflare's address instead of the visitor's.

---

## 2. Database

```bash
sudo -u postgres psql -c "CREATE USER nayo WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE nayo OWNER nayo;"
```

Use a different password from Amalice's.

---

## 3. Deploy user and code

```bash
adduser --disabled-password --gecos "" nayo
usermod -aG sudo nayo
su - nayo

git clone <your-repo-url> /home/nayo/app
cd /home/nayo/app
```

Every `pm2` command for Nayo runs **as the `nayo` user**. PM2 keeps one process list per Linux user: as
`amalice` you only see `amalice-*`, as `nayo` only `nayo-*`. That separation is intended — each store
restarts independently.

---

## 4. Environment files

### Secrets (new ones — never reuse Amalice's)

```bash
openssl rand -hex 32   # → JWT_SECRET
openssl rand -hex 32   # → JWT_REFRESH_SECRET
openssl rand -hex 32   # → META_TOKEN_ENCRYPTION_KEY
```

> **Set `META_TOKEN_ENCRYPTION_KEY` from day one.** It encrypts the Meta tokens **and the AI provider keys**
> saved in Settings → AI models (and the Meta app id/secret saved from the UI). Left unset, it is derived
> from `JWT_SECRET`; then changing `JWT_SECRET`, or adding this key later, makes every saved key
> undecryptable (they must all be re-entered). Never change it once keys are saved.

### `apps/api/.env`

```bash
cat > apps/api/.env <<'EOF'
NODE_ENV=production
PORT=4333
DATABASE_URL=postgresql://nayo:CHANGE_ME_STRONG_PASSWORD@localhost:5432/nayo
# Redis database 1 — database 0 is Amalice's (queues, AI counters and caches must not be shared)
REDIS_URL=redis://localhost:6379/1

# This API's public URL — used to build the courier webhook URL (DHD / Swift Express / Anderson / 48 Hr Express)
PUBLIC_API_URL=https://api.nayo.site

JWT_SECRET=PASTE_GENERATED_SECRET_HERE
JWT_REFRESH_SECRET=PASTE_GENERATED_SECRET_HERE

# This deployment's own storefront + admin origins (replaces the amalice.shop defaults)
CORS_ORIGINS=https://nayo.site,https://www.nayo.site,https://admin.nayo.site
# The funnels site, on top
CORS_EXTRA_ORIGINS=https://offers.nayo.site

# Nginx is the only proxy hop → 1 (the production default). Use 2 behind the Cloudflare proxy.
TRUST_PROXY=1

# Meta Ads + encryption of saved keys (see the warning above)
META_TOKEN_ENCRYPTION_KEY=PASTE_GENERATED_SECRET_HERE
META_GRAPH_VERSION=v23.0

# Max model requests per Algiers day across all AI features, 0 = no cap
AI_DAILY_CALL_LIMIT=500

# ---- Optional: uncomment and fill in only if needed — never leave one empty ----
# Meta app — can be saved from the admin UI instead
# META_APP_ID=
# META_APP_SECRET=
# AI — providers and keys are set in Settings → AI models; these are fallbacks only
# GEMINI_API_KEY=
# AI_FAST_MODEL=gemini-flash-lite-latest
# AI_SMART_MODEL=gemini-flash-latest
# Google Sheets — both together
# GOOGLE_SHEETS_CLIENT_EMAIL=
# GOOGLE_SHEETS_PRIVATE_KEY=
EOF
chmod 600 apps/api/.env
```

> `GOOGLE_SHEETS_PRIVATE_KEY` keeps its literal `\n` escapes exactly as in the service account JSON.
> `META_TOKEN_ENCRYPTION_KEY` must be at least 16 characters.

### `apps/admin/.env`

```bash
cat > apps/admin/.env <<'EOF'
NUXT_PUBLIC_API_BASE=https://api.nayo.site
NUXT_PUBLIC_STOREFRONT_BASE=https://nayo.site
NUXT_PUBLIC_FUNNELS_BASE=https://offers.nayo.site
EOF
```

### `apps/storefront/.env`

```bash
cat > apps/storefront/.env <<'EOF'
NUXT_PUBLIC_API_BASE=https://api.nayo.site
NUXT_PUBLIC_SITE_URL=https://nayo.site
NUXT_PUBLIC_SITE_NAME=Nayo
EOF
```

### `apps/funnels/.env`

```bash
cat > apps/funnels/.env <<'EOF'
PORT=4002
# The server fetches funnel data from Nayo's API locally (never leaves the box)
API_BASE=http://127.0.0.1:4333
# Visitors' browsers send orders / communes / analytics here
PUBLIC_API_BASE=https://api.nayo.site
CACHE_TTL_MS=30000
EOF
```

---

## 5. Install and build

Make sure Amalice isn't building at the same moment. Export the build-time vars **in the same shell**,
then build:

```bash
cd /home/nayo/app
pnpm install --frozen-lockfile

export NUXT_PUBLIC_API_BASE=https://api.nayo.site
export NUXT_PUBLIC_STOREFRONT_BASE=https://nayo.site
export NUXT_PUBLIC_FUNNELS_BASE=https://offers.nayo.site
export NUXT_PUBLIC_SITE_URL=https://nayo.site
export NUXT_PUBLIC_SITE_NAME=Nayo

pnpm turbo run build --concurrency=1
```

Builds `packages/shared`, `packages/ui` first, then:
- `apps/api/dist/` (NestJS)
- `apps/funnels/dist/` (Node + sharp)
- `apps/admin/.output/` (Nuxt SPA)
- `apps/storefront/.output/` (Nuxt SSR, no source maps, 3 GB heap)

`--concurrency=1` keeps the two Nuxt builds from running at the same time.

`pnpm install` builds `sharp`, `bcrypt` and Prisma automatically (allowed in `pnpm-workspace.yaml`'s
`allowBuilds`). If `sharp` fails: `pnpm rebuild sharp`.

API tests (no network or Redis needed):

```bash
pnpm --filter api test
```

---

## 6. Database setup

```bash
cd apps/api
pnpm exec prisma migrate deploy
pnpm seed-locations                                               # wilayas and communes — safe for production
pnpm create-admin -- you@nayo.site 'STRONG_PASSWORD' SuperAdmin   # first admin account
cd ../..
```

- These run against `DATABASE_URL` from **this** folder's `apps/api/.env` (Nayo's database). Double-check
  you're in `/home/nayo/app` — running them from Amalice's folder touches Amalice's database.
- `migrate deploy`, not `migrate dev`.
- **Don't run `prisma db seed` against production** — it creates admin accounts with the password
  `dev-password-123` plus fake data.
- **Don't run `apps/api/scripts/wipe-products-orders.sql`** unless you mean it, and only against the right
  database.
- `create-admin` upserts by email: rerunning it resets the password/role.

---

## 7. Persistent uploads directory

```bash
mkdir -p /home/nayo/app/apps/api/uploads
```

Nayo's product images, landing pages and logos live only here — **back it up** (separately from
Amalice's). The API must run with `cwd` = `apps/api` (also needed for the Cairo font in `assets/fonts`).

---

## 8. PM2 (as the `nayo` user)

```bash
cd /home/nayo/app
cat > ecosystem.config.cjs <<'EOF'
const fs = require('fs')
const path = require('path')

// Minimal dependency-free .env parser (KEY=value, '#' comments, optional quotes).
// The built Nitro servers (.output/server/index.mjs) and the funnels server do not read .env
// themselves, so the values are injected into PM2's env block here.
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

// Nayo's ports (4xxx) — Amalice uses 3000/3001/3002/3333 on the same machine.
module.exports = {
  apps: [
    {
      name: 'nayo-api',
      cwd: './apps/api',
      script: 'dist/main.js',
      env: { NODE_ENV: 'production', ...loadEnvFile('apps/api/.env'), PORT: 4333 }
    },
    {
      name: 'nayo-admin',
      cwd: './apps/admin',
      script: '.output/server/index.mjs',
      env: { NODE_ENV: 'production', HOST: '127.0.0.1', ...loadEnvFile('apps/admin/.env'), PORT: 4001 }
    },
    {
      name: 'nayo-storefront',
      cwd: './apps/storefront',
      script: '.output/server/index.mjs',
      env: { NODE_ENV: 'production', HOST: '127.0.0.1', ...loadEnvFile('apps/storefront/.env'), PORT: 4000 }
    },
    {
      name: 'nayo-funnels',
      cwd: './apps/funnels',
      script: 'dist/server.js',
      env: { NODE_ENV: 'production', ...loadEnvFile('apps/funnels/.env'), PORT: 4002 }
    }
  ]
}
EOF

pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # prints a sudo command for the nayo user — run it, so Nayo also comes back after a reboot
```

`pm2 startup` must be run once **per user**: Amalice's boot service only restores `amalice-*`.

Verify:

```bash
pm2 status
pm2 logs nayo-api --lines 50
sudo ss -ltnp | grep -E ':(4000|4001|4002|4333)\b'
```

All four should be `online` and listening. If `nayo-api` crash-loops it is almost always: Postgres/Redis,
`EADDRINUSE` (port taken), a `JWT_SECRET` shorter than 32 characters, or an optional var with an empty
value (comment it out) — the `Invalid environment configuration` message names which one.

> Changing `env` in `ecosystem.config.cjs` isn't picked up by `pm2 restart`: PM2 keeps the old env. Use
> `pm2 delete <name> && pm2 start ecosystem.config.cjs --only <name> && pm2 save`.

---

## 9. Nginx

`/etc/nginx/conf.d/gzip.conf` already exists from Amalice's setup and applies to both stores. Add Nayo's
sites in their own file:

```bash
sudo tee /etc/nginx/sites-available/nayo <<'EOF'
# X-Forwarded-For is what the API's "trust proxy" (TRUST_PROXY=1) reads for the real visitor IP:
# rate limits, visit tracking, order attribution and risk scoring all depend on it.

server {
    listen 80;
    server_name api.nayo.site;
    # Admin uploads accept up to 50 MB (upload.controller.ts); nginx's default is 1 MB.
    client_max_body_size 50m;
    # AI features (landing pages, assistant, analysis) can take well over the 60 s default.
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    location / {
        proxy_pass http://127.0.0.1:4333;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name admin.nayo.site;
    location / {
        proxy_pass http://127.0.0.1:4001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name nayo.site www.nayo.site;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name offers.nayo.site;
    # The funnels server already sends Brotli/gzip itself and picks AVIF/WebP per Accept header
    # (Vary: Accept) — don't compress twice here.
    gzip off;
    location / {
        proxy_pass http://127.0.0.1:4002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Accept-Encoding $http_accept_encoding;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/nayo /etc/nginx/sites-enabled/nayo
sudo nginx -t && sudo systemctl reload nginx
```

- **Don't touch `/etc/nginx/sites-available/amalice`** — Amalice keeps its own file.
- `nginx -t` must show no `conflicting server name` warning (no host may appear in both files).
- If Amalice's `api.amalice.shop` block has no `client_max_body_size 50m;` yet, add it there too.

---

## 10. SSL

```bash
sudo certbot --nginx \
  -d nayo.site -d www.nayo.site \
  -d admin.nayo.site -d api.nayo.site -d offers.nayo.site
```

This creates a separate certificate for Nayo; Amalice's certificate and renewal are untouched.

---

## 11. Firewall

Nothing to add: `Nginx Full` is already allowed. Don't open 4000/4001/4002/4333 externally.

---

## 12. Admin setup (after first boot)

Log in at `https://admin.nayo.site` with the `create-admin` account, then:

1. **Settings → Storefront → store name: `Nayo`** (first!) — used in page titles, the footer, the About /
   Terms / FAQ pages, Google's structured data, the admin's title ("Nayo Admin") and Telegram messages.
2. **Settings → Brand**: logo, favicon, colour, font (automatic logo analysis needs a Gemini key). The
   logo also replaces the default one in the admin's sidebar and login page.
3. **Settings → AI models** (SuperAdmin): enter at least one provider key (Gemini, Groq, Cerebras,
   OpenRouter, Mistral, … or a Custom OpenAI-compatible endpoint), choose provider + model for `fast` and
   `smart` and a fallback, then **Test**. Keys can be the same as Amalice's, but quotas are then shared
   between the two stores (Gemini free tier ≈ 20 requests/day per model).
4. **Meta Ads**: either paste an access token, or use Facebook login. The same Meta app can serve both
   stores: in the Meta app → Facebook Login → Settings → **Valid OAuth Redirect URIs** add
   `https://admin.nayo.site/meta-ads/callback` (next to Amalice's), and add `nayo.site` under App Domains.
5. **Settings → Shipping Companies**: Nayo's courier tokens (Ecotrack: DHD, Swift Express, Anderson,
   48 Hr Express), **Sync locations** for each, and copy the displayed webhook URL
   (`https://api.nayo.site/...`) into the courier's dashboard.
6. **Reports** (SuperAdmin): Telegram bot token and chat id, daily report hour, then **Send test**. Both
   stores can report to the same chat: every message starts with the store name (🏪 **Nayo**).
7. **Apps**: Meta Conversions API / TikTok Events API (Nayo's pixel id + token) and Google Sheets if needed.
8. **Funnels**: a funnel is reachable only once its status is **Live**: `https://offers.nayo.site/f/<slug>`.
   Ad URLs must carry `utm_*` and `campaign_id`/`adset_id`/`ad_id` for the order source to show.

---

## 13. Smoke test

```bash
curl -sI https://nayo.site | head -1
curl -s  https://api.nayo.site/settings | head -c 200; echo     # storeName should be "Nayo"
curl -sI -H 'Origin: https://admin.nayo.site' https://api.nayo.site/settings | grep -i access-control-allow-origin
curl -sI -H 'Origin: https://admin.amalice.shop' https://api.nayo.site/settings | grep -i access-control-allow-origin || echo "amalice origin refused (correct)"
redis-cli -n 1 keys 'bull:reports:*' | head -3                   # Nayo's queue lives in DB 1
```

- `https://nayo.site` → page title ends with `· Nayo`; the footer says "عن Nayo".
- `https://admin.nayo.site` → "Nayo Admin" login, and login works.
- In the admin: a product preview link starts with `https://nayo.site`, a funnel link with
  `https://offers.nayo.site` (otherwise rebuild the admin with the step 5 exports).
- Upload a product image > 1 MB (checks `client_max_body_size`).
- Place a test order on Nayo → it shows in **Nayo's** admin only, with **Order source** and a risk score.
- Amalice still works: `https://amalice.shop`, `https://admin.amalice.shop`.

---

## Redeploying after code changes

Both stores run the same code, so a code update usually means redeploying both — **one after the other**:

```bash
# as nayo
cd /home/nayo/app
git pull
pnpm install --frozen-lockfile

export NUXT_PUBLIC_API_BASE=https://api.nayo.site
export NUXT_PUBLIC_STOREFRONT_BASE=https://nayo.site
export NUXT_PUBLIC_FUNNELS_BASE=https://offers.nayo.site
export NUXT_PUBLIC_SITE_URL=https://nayo.site
export NUXT_PUBLIC_SITE_NAME=Nayo

pnpm turbo run build --concurrency=1
cd apps/api && pnpm exec prisma migrate deploy && cd ../..
pm2 reload ecosystem.config.cjs
```

Then the same for Amalice, as the `amalice` user in `/home/amalice/app` with **its own** exports
(`https://api.amalice.shop`, …) — a new shell, so Nayo's exports don't leak into Amalice's build.

Nitro builds don't hot-reload: without `reload`/`restart` the processes keep serving a stale manifest
(404/500 on JS/CSS assets).

| Change | What to do (as `nayo`) |
| --- | --- |
| A value in `apps/api/.env` | `pm2 restart nayo-api --update-env` |
| `apps/funnels/.env` | `pm2 restart nayo-funnels --update-env` |
| Admin `NUXT_PUBLIC_*` | Rebuild the admin (SPA, values baked in), then `pm2 restart nayo-admin` |
| Storefront `NUXT_PUBLIC_*` | Rebuild the storefront, then `pm2 restart nayo-storefront` |
| `.ts`/`.vue` source | Rebuild that app, then `pm2 reload` |
| Prisma schema change | Rebuild `apps/api`, `prisma migrate deploy`, then `pm2 restart nayo-api` (and the same for Amalice) |
| Store name, brand, AI / Meta / Telegram / courier keys | From Nayo's admin — no restart |

---

## Reference: `apps/api` env vars

| Var | Required? | Nayo value / notes |
| --- | --- | --- |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | **Yes** | own values, min 32 chars |
| `DATABASE_URL` | Yes | `…/nayo` |
| `REDIS_URL` | Yes | **`redis://localhost:6379/1`** — never Amalice's DB 0 |
| `PORT` | Yes on a shared VPS | `4333` |
| `CORS_ORIGINS` | **Yes for nayo.site** | `https://nayo.site,https://www.nayo.site,https://admin.nayo.site`; unset = amalice.shop defaults |
| `CORS_EXTRA_ORIGINS` | Yes with funnels | `https://offers.nayo.site` |
| `PUBLIC_API_URL` | Yes in production | `https://api.nayo.site` — courier webhook URL |
| `META_TOKEN_ENCRYPTION_KEY` | Strongly recommended | own value; never change once used |
| `TRUST_PROXY` | No | `1` by default in production; `2` behind Cloudflare; `false` to disable |
| `NODE_ENV` | No | `production` |
| `GEMINI_API_KEY` | No | fallback while nothing is set in Settings → AI models |
| `AI_FAST_MODEL` / `AI_SMART_MODEL` | No | fallback Gemini models |
| `AI_DAILY_CALL_LIMIT` | No | 500 by default, 0 = no cap (counted per store) |
| `META_APP_ID` / `META_APP_SECRET` | No | or from the UI |
| `META_GRAPH_VERSION` | No | `v23.0` |
| `GOOGLE_SHEETS_CLIENT_EMAIL` / `GOOGLE_SHEETS_PRIVATE_KEY` | No | both or neither |

Any optional var that is present must be non-empty — an empty value fails validation and stops the boot.

## Reference: frontend env vars

| App | Var | Nayo value | Read when |
| --- | --- | --- | --- |
| admin | `NUXT_PUBLIC_API_BASE` | `https://api.nayo.site` | build + runtime |
| admin | `NUXT_PUBLIC_STOREFRONT_BASE` | `https://nayo.site` | **build** (default `amalice.shop`) |
| admin | `NUXT_PUBLIC_FUNNELS_BASE` | `https://offers.nayo.site` | **build** (default `leezil.com`) |
| storefront | `NUXT_PUBLIC_API_BASE` | `https://api.nayo.site` | build (image domain) + runtime |
| storefront | `NUXT_PUBLIC_SITE_URL` | `https://nayo.site` | build (sitemap) + runtime (canonical links) |
| storefront | `NUXT_PUBLIC_SITE_NAME` | `Nayo` | build (sitemap/SEO module) |
| funnels | `PORT`, `API_BASE`, `PUBLIC_API_BASE`, `CACHE_TTL_MS` | `4002`, `http://127.0.0.1:4333`, `https://api.nayo.site`, `30000` | runtime |

The store name shown to customers and admins is **not** an env var: it is Settings → Storefront → store
name in each store's own admin.
