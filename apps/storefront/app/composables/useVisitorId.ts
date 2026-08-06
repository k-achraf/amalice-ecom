// A stable, anonymous per-browser id for first-party view-tracking (see
// useViewTracking.ts) — NOT tied to any account (there is no customer
// login system in this app), just a UUID persisted in localStorage so
// repeat visits from the same browser count as the same "unique visitor"
// in the admin dashboard's traffic stats. Client-only by construction
// (localStorage doesn't exist during SSR) — callers must guard with
// import.meta.client themselves, same as every other browser-only API in
// this app.
const STORAGE_KEY = 'amalice.visitorId'

export function useVisitorId(): string {
  if (import.meta.server) return ''
  try {
    let id = localStorage.getItem(STORAGE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(STORAGE_KEY, id)
    }
    return id
  } catch {
    // Private-browsing/storage-disabled browsers can throw on localStorage
    // access — fall back to a one-off id for this page load rather than
    // breaking the caller. It just won't count as "returning" next visit.
    return crypto.randomUUID()
  }
}
