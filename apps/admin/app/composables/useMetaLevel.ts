import type { MetaCampaignStatus } from '@amalice/shared'

// Shared loader of the Meta Ads drill-down pages (campaigns → ad sets → ads): one paged,
// filterable, cached list read from the API for the selected ad account and period.
// `path` returns the list URL for the current ad account, or null while there's none.
export function useMetaLevel<T extends { items: unknown[]; next: string | null; currency: string | null }>(path: (accountId: string) => string) {
  const api = useAdminApi()
  const toast = useToast()
  const { accountId, datePreset, init } = useMetaAds()

  const data = ref<T | null>(null)
  const rows = ref<T['items']>([])
  const next = ref<string | null>(null)
  const busy = ref(false)
  const ready = ref(false)
  const statusFilter = ref<MetaCampaignStatus | ''>('')

  async function load(opts: { more?: boolean; refresh?: boolean } = {}) {
    if (!accountId.value) return
    busy.value = true
    try {
      const res = await api<T>(path(accountId.value), {
        query: {
          datePreset: datePreset.value,
          ...(statusFilter.value && { status: statusFilter.value }),
          ...(opts.more && next.value && { after: next.value }),
          ...(opts.refresh && { refresh: 'true' })
        }
      })
      data.value = res
      rows.value = opts.more ? [...rows.value, ...res.items] : res.items
      next.value = res.next
    } catch (err) {
      toast.add({ title: 'Meta Ads', description: errorMessage(err, 'Could not load data from Meta.'), color: 'error' })
      await init()
    } finally {
      busy.value = false
    }
  }

  onMounted(async () => {
    await init()
    await load()
    ready.value = true
  })
  // Switching ad account on a campaign / ad set page: that id doesn't exist in the other account, so go back to its campaigns.
  const route = useRoute()
  watch([accountId, datePreset, statusFilter], ([account], [previous]) => {
    if (!ready.value) return
    if (account !== previous && route.path !== '/meta-ads/campaigns') {
      navigateTo('/meta-ads/campaigns')
      return
    }
    load()
  })

  // Meta returns no insights for something that didn't deliver in the period.
  const noDelivery = computed(() => !busy.value && rows.value.length > 0 && (rows.value as { insights: unknown }[]).every((r) => !r.insights))

  return { data, rows, next, busy, statusFilter, noDelivery, load }
}

export const META_STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Paused', value: 'PAUSED' },
  { label: 'Archived', value: 'ARCHIVED' }
]

export const metaStatusPill = (s: string) => (s === 'ACTIVE' ? 'connected' : s === 'PAUSED' || s === 'CAMPAIGN_PAUSED' || s === 'ADSET_PAUSED' || s === 'ARCHIVED' ? 'neutral' : 'returned')
export const metaLabel = (s: string) => s.replaceAll('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())
