// Dev supervisor for the API (replaces `node --watch dist/main.js`).
//
// Why: `node --watch` does not restart a process that CRASHED — it sits dead
// until a file in dist/ changes. If the API booted before Docker's Postgres/
// Redis were reachable (Docker Desktop starts late, a container restarted…),
// it exited once and every admin/storefront call failed with
// ERR_CONNECTION_REFUSED until someone touched a file. This supervisor:
//   1. waits for Postgres and Redis (from apps/api/.env) before booting,
//   2. restarts the API whenever dist/ is rebuilt (tsc --watch),
//   3. restarts it after a crash, with a short backoff, instead of dying.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, watch } from 'node:fs'
import net from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const entry = join(root, 'dist', 'main.js')

function readEnv() {
  const file = join(root, '.env')
  const out = {}
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

function target(url, fallbackPort) {
  try {
    const u = new URL(url)
    return { host: u.hostname, port: Number(u.port) || fallbackPort }
  } catch {
    return null
  }
}

const probe = ({ host, port }) =>
  new Promise((resolve) => {
    const s = net.connect({ host, port, timeout: 1500 })
    s.once('connect', () => (s.destroy(), resolve(true)))
    s.once('error', () => resolve(false))
    s.once('timeout', () => (s.destroy(), resolve(false)))
  })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForDeps() {
  const env = { ...readEnv(), ...process.env }
  const deps = [
    ['Postgres', target(env.DATABASE_URL ?? '', 5432)],
    ['Redis', target(env.REDIS_URL ?? '', 6379)]
  ].filter(([, t]) => t)
  let last = ''
  for (;;) {
    const down = []
    for (const [name, t] of deps) if (!(await probe(t))) down.push(`${name} (${t.host}:${t.port})`)
    if (!down.length) return
    const msg = `[dev-server] waiting for ${down.join(', ')} — is Docker running? (docker compose up -d)`
    if (msg !== last) console.log(msg)
    last = msg
    await sleep(3000)
  }
}

let child = null
let restartTimer = null
let stopping = false
let lastStart = 0

async function start() {
  if (stopping) return
  if (!existsSync(entry)) {
    console.log('[dev-server] dist/main.js not built yet, waiting for tsc…')
    return scheduleRestart(1500)
  }
  await waitForDeps()
  lastStart = Date.now()
  child = spawn(process.execPath, [entry], { stdio: 'inherit', cwd: root, env: process.env })
  child.on('exit', (code, signal) => {
    child = null
    if (stopping || signal === 'SIGTERM') return
    // Crashed (or exited on its own): back off a little, then try again.
    const ranFor = Date.now() - lastStart
    console.log(`[dev-server] API exited (code ${code}) after ${Math.round(ranFor / 1000)}s — restarting`)
    scheduleRestart(ranFor < 5000 ? 3000 : 500)
  })
}

function scheduleRestart(delay = 400) {
  clearTimeout(restartTimer)
  restartTimer = setTimeout(async () => {
    if (child) {
      const old = child
      await new Promise((resolve) => {
        old.once('exit', resolve)
        old.kill('SIGTERM')
        setTimeout(() => old.kill('SIGKILL'), 4000)
      })
    }
    start()
  }, delay)
}

// tsc --watch rewrites many files per build; debounce into one restart.
let watcherReady = false
function watchDist() {
  const dist = join(root, 'dist')
  if (!existsSync(dist)) return setTimeout(watchDist, 1000)
  watch(dist, { recursive: true }, (_evt, name) => {
    if (!watcherReady || !name || !String(name).endsWith('.js')) return
    scheduleRestart(800)
  })
  setTimeout(() => (watcherReady = true), 1500)
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    stopping = true
    child?.kill('SIGTERM')
    process.exit(0)
  })
}

watchDist()
start()
