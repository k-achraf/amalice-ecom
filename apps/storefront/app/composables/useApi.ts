// SSR-friendly fetch (caches/hydrates) for GET routes rendered on the page.
export function useApiFetch<T>(url: string, opts?: Parameters<typeof useFetch<T>>[1]) {
  const config = useRuntimeConfig()
  return useFetch<T>(url, { baseURL: config.public.apiBase, ...opts })
}

// Plain client for mutations (POST/etc.) triggered by user interaction,
// where there's nothing to server-render or hydrate.
export function useApiClient() {
  const config = useRuntimeConfig()
  return $fetch.create({ baseURL: config.public.apiBase })
}

// Resolve image URLs stored as relative paths (e.g. /uploads/xxx.jpg from the
// admin upload) by prepending the API base. Absolute URLs (https://…) pass
// through unchanged.
export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  const config = useRuntimeConfig()
  return `${config.public.apiBase}${url}`
}
