import type { PublicFunnel } from '@amalice/shared'
import { config } from './config'
import { renderPage, type Rendered } from './render'

// In-memory page cache with stale-while-revalidate: the visitor path never waits on the API once a page
// has been rendered. Fresh → serve. Stale (within maxStaleMs) → serve instantly and refresh in the
// background. Only a cold cache (first visit after a restart) or a very old entry waits for the API.
interface Entry {
  rendered: Rendered | null // null = "no such funnel" (remembered briefly)
  at: number
  refreshing: Promise<void> | null
}
const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<Entry>>()

async function fetchFunnel(slug: string): Promise<PublicFunnel | null> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 5000)
  try {
    const res = await fetch(`${config.apiBase}/public/funnels/${encodeURIComponent(slug)}`, { signal: ctl.signal, headers: { accept: 'application/json' } })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`API ${res.status}`)
    return (await res.json()) as PublicFunnel
  } finally {
    clearTimeout(timer)
  }
}

async function load(slug: string): Promise<Entry> {
  const funnel = await fetchFunnel(slug)
  const entry: Entry = { rendered: funnel ? renderPage(funnel) : null, at: Date.now(), refreshing: null }
  cache.set(slug, entry)
  return entry
}

function loadOnce(slug: string): Promise<Entry> {
  let p = inflight.get(slug)
  if (!p) {
    p = load(slug).finally(() => inflight.delete(slug))
    inflight.set(slug, p)
  }
  return p
}

export async function getPage(slug: string): Promise<Rendered | null> {
  const hit = cache.get(slug)
  const now = Date.now()
  if (hit) {
    const age = now - hit.at
    const ttl = hit.rendered ? config.cacheTtlMs : config.notFoundTtlMs
    if (age < ttl) return hit.rendered
    if (hit.rendered && age < config.maxStaleMs) {
      // Serve the stale page now; refresh behind it. A failed refresh keeps the old page and tries again next time.
      if (!hit.refreshing) {
        hit.refreshing = loadOnce(slug)
          .then(() => undefined)
          .catch(() => undefined)
          .finally(() => {
            hit.refreshing = null
          })
      }
      return hit.rendered
    }
  }
  try {
    return (await loadOnce(slug)).rendered
  } catch (err) {
    // API down: a stale page is still better than an error, however old.
    if (hit?.rendered) return hit.rendered
    throw err
  }
}

// Warm a funnel right after boot or on demand so the very first visitor is not the one paying for the render.
export async function warm(slug: string): Promise<void> {
  await getPage(slug).catch(() => undefined)
}
