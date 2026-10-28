import { cleanOrderFilters, ORDER_FILTER_KEYS } from '@amalice/shared'
import type { OrderFilterKey, OrderFilterOptions, OrderFilters } from '@amalice/shared'

const EMPTY_OPTIONS: OrderFilterOptions = { products: [], funnels: [], companies: [], regions: [], offers: [] }
const NUMERIC_KEYS: OrderFilterKey[] = ['minTotal', 'maxTotal']

// Options for the <OrderFilters> selects. Fetched once per session and shared
// (useState); a failed fetch yields empty lists and is retried on the next mount.
export function useOrderFilterOptions() {
  const data = useState<OrderFilterOptions | null>('order-filter-options', () => null)
  const loading = useState<boolean>('order-filter-options-loading', () => false)

  if (import.meta.client && !data.value && !loading.value) {
    loading.value = true
    useAdminApi()<OrderFilterOptions>('/admin/orders/filter-options')
      .then((d) => {
        data.value = {
          products: d?.products ?? [],
          funnels: d?.funnels ?? [],
          companies: d?.companies ?? [],
          regions: d?.regions ?? [],
          offers: d?.offers ?? []
        }
      })
      .catch(() => { /* tolerant: leave empty lists */ })
      .finally(() => { loading.value = false })
  }

  const options = computed<OrderFilterOptions>(() => data.value ?? EMPTY_OPTIONS)
  return { options, loading: readonly(loading) }
}

// Shared filter state for the order-based pages. With `syncRoute`, the filters
// are read from the URL on creation and written back (router.replace) on change,
// so they survive a reload and links are shareable. Other query keys are kept.
export function useOrderFilters(opts: { syncRoute?: boolean } = {}) {
  const route = useRoute()
  const router = useRouter()

  const filters = reactive<Partial<OrderFilters>>({})
  const query = computed<Record<string, string>>(() => cleanOrderFilters(filters))
  const activeCount = computed(() => Object.keys(query.value).length)

  function set<K extends OrderFilterKey>(key: K, val: OrderFilters[K] | '' | null | undefined) {
    const f = filters as Record<string, unknown>
    if (val === undefined || val === null || val === '') delete f[key]
    else f[key] = val
  }

  function clear() {
    for (const k of ORDER_FILTER_KEYS) delete (filters as Record<string, unknown>)[k]
  }

  function hydrateFromRoute(q: Record<string, unknown> = route.query) {
    clear()
    for (const k of ORDER_FILTER_KEYS) {
      const raw = q[k]
      const v = Array.isArray(raw) ? raw[0] : raw
      if (typeof v !== 'string' || v === '') continue
      const n = Number(v)
      ;(filters as Record<string, unknown>)[k] = NUMERIC_KEYS.includes(k) ? (Number.isNaN(n) ? undefined : n) : v
    }
  }

  // The current URL query with the filter keys replaced by the active filters.
  function toRouteQuery(): Record<string, any> {
    const out: Record<string, any> = { ...route.query }
    for (const k of ORDER_FILTER_KEYS) delete out[k]
    return { ...out, ...query.value }
  }

  if (opts.syncRoute) {
    hydrateFromRoute()
    watch(query, (next, prev) => {
      if (JSON.stringify(next) === JSON.stringify(prev)) return
      router.replace({ query: toRouteQuery() })
    })
  }

  return { filters, query, activeCount, clear, set, hydrateFromRoute, toRouteQuery }
}
