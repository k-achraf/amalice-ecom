// ADM data layer. The admin talks to the API with a JWT bearer token from the
// auth store. On ANY 401 response the user is logged out and redirected to
// /login (preserving the destination they were heading to) — this is the
// single, unconditional rule for expired/invalid sessions across the admin.
//
// Two helpers:
//  - useAdminApi(): a $fetch client for mutations/client-only calls.
//  - useAdminFetch(): an SSR-compatible useFetch wrapper for GET reads.
// Both inject the bearer and route 401s through the same handler.

// The one place the "401 → logout + redirect" rule lives. Client-only: on the
// server a 401 surfaces as an error the caller can handle (there's no session
// cookie to clear mid-SSR and no browser to navigate); the client middleware
// re-gates on hydration. `to` defaults to the current route so login returns
// the user where they were.
function handle401() {
  if (!import.meta.client) return
  const auth = useAuthStore()
  // Avoid looping if already on /login.
  const route = useRoute()
  if (route.path === '/login') return
  auth.clear()
  navigateTo({ path: '/login', query: { redirect: route.fullPath } })
}

export function useAdminApi() {
  const config = useRuntimeConfig()
  const auth = useAuthStore()

  return $fetch.create({
    baseURL: config.public.apiBase,
    onRequest({ options }) {
      const token = auth.token
      if (token) {
        options.headers = new Headers(options.headers)
        options.headers.set('Authorization', `Bearer ${token}`)
      }
    },
    onResponseError({ response }) {
      if (response.status === 401) handle401()
    }
  })
}

// useFetch wrapper — keeps the option surface narrow (query + key) to avoid
// spreading ofetch types into Nuxt's UseFetchOptions, which don't line up.
// The same 401 handler applies: an expired session during a GET read logs the
// user out and bounces to /login just like a mutation would.
export function useAdminFetch<T>(url: string, opts?: { query?: Record<string, unknown>; key?: string }) {
  const config = useRuntimeConfig()
  const auth = useAuthStore()

  return useFetch<T>(url, {
    baseURL: config.public.apiBase,
    key: opts?.key,
    query: opts?.query,
    onRequest({ options }) {
      const token = auth.token
      if (token) {
        options.headers = new Headers(options.headers)
        options.headers.set('Authorization', `Bearer ${token}`)
      }
    },
    onResponseError({ response }) {
      if (response.status === 401) handle401()
    }
  })
}
