import type { MetaAdAccountView, MetaAdsStatus, MetaDatePreset } from '@amalice/shared'

// Shared state of the Meta Ads section: connection status, the synced ad
// accounts, the ad account currently being looked at and the date range.
// Kept in useState so the dashboard, campaigns and accounts pages agree.
export function useMetaAds() {
  const api = useAdminApi()
  const status = useState<MetaAdsStatus | null>('meta-ads-status', () => null)
  const accounts = useState<MetaAdAccountView[]>('meta-ads-accounts', () => [])
  const accountId = useState<string | null>('meta-ads-account', () => null)
  const datePreset = useState<MetaDatePreset>('meta-ads-preset', () => 'last_30d')
  const loading = useState('meta-ads-loading', () => false)

  const connected = computed(() => status.value?.connection?.status === 'Active')
  const expired = computed(() => status.value?.connection?.status === 'Expired')
  const account = computed(() => accounts.value.find((a) => a.accountId === accountId.value) ?? null)

  // Loads status and, when linked, the already-synced ad accounts.
  async function init() {
    loading.value = true
    try {
      status.value = await api<MetaAdsStatus>('/admin/meta-ads/status')
      if (connected.value) {
        accounts.value = await api<MetaAdAccountView[]>('/admin/meta-ads/accounts')
        const saved = status.value.connection?.selectedAdAccountId
        if (!accountId.value || !accounts.value.some((a) => a.accountId === accountId.value)) {
          accountId.value = accounts.value.find((a) => a.accountId === saved)?.accountId ?? accounts.value[0]?.accountId ?? null
        }
      } else {
        accounts.value = []
        accountId.value = null
      }
    } finally {
      loading.value = false
    }
  }

  async function select(id: string) {
    accountId.value = id
    try {
      await api(`/admin/meta-ads/accounts/${id}/select`, { method: 'POST' })
      if (status.value?.connection) status.value.connection.selectedAdAccountId = id
    } catch {
      // The choice still applies locally; persisting it is a convenience.
    }
  }

  // Pulls the ad accounts again from Meta.
  async function sync() {
    accounts.value = await api<MetaAdAccountView[]>('/admin/meta-ads/accounts/sync', { method: 'POST' })
    if (!accounts.value.some((a) => a.accountId === accountId.value)) accountId.value = accounts.value[0]?.accountId ?? null
  }

  return { status, accounts, accountId, account, datePreset, loading, connected, expired, init, select, sync }
}

export function errorMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string | string[] } })?.data
  const m = data?.message
  return (Array.isArray(m) ? m[0] : m) ?? fallback
}

export function formatMoney(value: number | null | undefined, currency: string | null | undefined): string {
  if (value === null || value === undefined) return '—'
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency ?? ''}`.trim()
  }
}

export function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : new Intl.NumberFormat('en-US').format(Math.round(value))
}

// Orders, costs and profit are in DZD (major units): "12,345 DA", negatives with a real minus sign.
export function formatDz(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  const abs = Math.abs(Math.round(value)).toLocaleString('en-US')
  return `${value < 0 ? '−' : ''}${abs} DA`
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : `${value.toFixed(digits)}%`
}
