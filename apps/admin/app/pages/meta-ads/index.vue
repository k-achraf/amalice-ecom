<script setup lang="ts">
import { META_DATE_PRESET_LABELS, type MetaAccountOverview, type MetaCampaignsResponse } from '@amalice/shared'

definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })
useHead({ title: 'Meta Ads' })

const api = useAdminApi()
const toast = useToast()
const { status, accountId, account, datePreset, loading, connected, expired, init } = useMetaAds()
const { visible } = useMetaMetrics()
const kpiMetrics = computed(() => visible.value.filter((m) => !m.campaign))

const overview = ref<MetaAccountOverview | null>(null)
const top = ref<MetaCampaignsResponse | null>(null)
const busy = ref(false)
const failure = ref<string | null>(null)

async function load(refresh = false) {
  if (!accountId.value) return
  busy.value = true
  failure.value = null
  const query = { datePreset: datePreset.value, ...(refresh && { refresh: 'true' }) }
  try {
    const [o, c] = await Promise.all([
      api<MetaAccountOverview>(`/admin/meta-ads/accounts/${accountId.value}/overview`, { query }),
      api<MetaCampaignsResponse>(`/admin/meta-ads/accounts/${accountId.value}/campaigns`, { query: { ...query, status: 'ACTIVE' } })
    ])
    overview.value = o
    top.value = c
  } catch (err) {
    failure.value = errorMessage(err, 'Could not load data from Meta.')
    toast.add({ title: 'Meta Ads', description: failure.value, color: 'error' })
    await init()
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  await init()
  await load()
})
watch([accountId, datePreset], () => load())

const t = computed(() => overview.value?.totals ?? null)
const topCampaigns = computed(() => [...(top.value?.items ?? [])].sort((a, b) => (b.insights?.spend ?? 0) - (a.insights?.spend ?? 0)).slice(0, 5))
</script>

<template>
  <AdsPage title="Dashboard" description="Meta Ads">
    <template v-if="connected && accountId" #actions><MetaMetricPicker /></template>
    <div v-if="loading && !status" class="empty">Loading…</div>

    <template v-else-if="status">
      <AdsEmptyState v-if="!status.connection" icon="i-lucide-megaphone" title="Connect your Meta account" description="Link your Facebook account to see your ad accounts, campaigns and results here.">
        <NuxtLink to="/meta-ads/accounts" class="btn btn-primary" style="margin-top: 8px">Connect Meta</NuxtLink>
      </AdsEmptyState>

      <template v-else>
        <AdsBanner v-if="expired" tone="warning">
          Your Meta session expired.
          <NuxtLink to="/meta-ads/accounts" style="font-weight: 600">Reconnect your account</NuxtLink>
        </AdsBanner>

        <template v-if="connected">
          <AdsEmptyState v-if="!accountId" icon="i-lucide-megaphone" title="No ad account found" description="This Facebook account has no ad accounts, or access wasn't granted.">
            <NuxtLink to="/meta-ads/accounts" class="btn" style="margin-top: 8px">Manage accounts</NuxtLink>
          </AdsEmptyState>

          <template v-else>
            <MetaAdsBar :refreshing="busy" @refresh="load(true)" />
            <AdsBanner v-if="failure" tone="warning">{{ failure }}</AdsBanner>

            <div v-if="busy && !overview" class="empty">Loading from Meta…</div>
            <template v-else-if="overview">
              <p v-if="account && account.accountStatus !== 1" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>This ad account is "{{ account.accountStatusLabel }}" on Meta.</span></p>

              <p v-if="!t" class="notice warn" style="align-items: center">
                <AdsIcon name="i-lucide-alert-triangle" />
                <span>No ad delivery in this period ({{ META_DATE_PRESET_LABELS[overview.datePreset].toLowerCase() }}), so Meta reports no results.</span>
                <button v-if="datePreset !== 'maximum'" class="btn btn-sm" type="button" style="margin-inline-start: auto" @click="datePreset = 'maximum'">Show all time</button>
              </p>
              <div v-else class="kpis">
                <AdsKpiCard v-for="(m, i) in kpiMetrics" :key="m.key" :label="m.label" :value="metricText(m, t, overview.currency)" :color="i === 0 ? 'dark' : 'neutral'" />
              </div>

              <section class="card flush" aria-labelledby="top-h">
                <div class="card-head">
                  <h2 id="top-h">Top active campaigns by spend</h2>
                  <NuxtLink to="/meta-ads/campaigns">All campaigns</NuxtLink>
                </div>
                <div class="table-wrap">
                  <table :style="{ minWidth: `${260 + kpiMetrics.length * 110}px` }">
                    <thead>
                      <tr>
                        <th style="padding-left: 20px">Campaign</th>
                        <th v-for="(m, i) in kpiMetrics" :key="m.key" class="num" :style="i === kpiMetrics.length - 1 ? 'padding-right: 20px' : undefined">{{ m.label }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-if="!topCampaigns.length"><td :colspan="1 + kpiMetrics.length" class="empty">No active campaigns.</td></tr>
                      <tr v-for="c in topCampaigns" :key="c.id">
                        <td style="padding-left: 20px"><span class="strong">{{ c.name }}</span><span class="sub">{{ c.objective ?? '' }}</span></td>
                        <td v-for="(m, i) in kpiMetrics" :key="m.key" class="num" :style="i === kpiMetrics.length - 1 ? 'padding-right: 20px' : undefined">{{ metricText(m, c.insights, overview.currency) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
              <p class="hint muted">Figures come live from Meta (cached for a minute) · updated {{ new Date(overview.fetchedAt).toLocaleTimeString() }}</p>
            </template>
          </template>
        </template>
      </template>
    </template>
  </AdsPage>
</template>
