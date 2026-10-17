<script setup lang="ts">
import type { MetaAdSetsResponse } from '@amalice/shared'

definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })

const route = useRoute()
const campaignId = route.params.id as string
const { connected, datePreset } = useMetaAds()
const { data, rows, next, busy, statusFilter, noDelivery, load } = useMetaLevel<MetaAdSetsResponse>((account) => `/admin/meta-ads/accounts/${account}/campaigns/${campaignId}/adsets`)
const currency = computed(() => data.value?.currency ?? null)
const name = computed(() => data.value?.parent.name ?? campaignId)
useHead({ title: computed(() => `${name.value} · Ad sets`) })
const tableRows = computed(() => (rows.value as MetaAdSetsResponse['items']).map((s) => ({ ...s, sub: s.optimizationGoal ? metaLabel(s.optimizationGoal) : null })))
</script>

<template>
  <AdsPage :title="name" description="Ad sets">
    <template #breadcrumb>
      <NuxtLink to="/meta-ads/campaigns">Campaigns</NuxtLink><AdsIcon name="i-lucide-chevron-right" style="width: 14px; height: 14px" /><span>{{ name }}</span>
    </template>
    <template v-if="connected" #actions>
      <NuxtLink :to="`/meta-ads/analytics/campaign/${campaignId}`" class="btn"><AdsIcon name="i-lucide-bar-chart-3" />Campaign analytics</NuxtLink>
      <MetaMetricPicker with-campaign />
    </template>

    <template v-if="connected">
      <MetaAdsBar :refreshing="busy" @refresh="load({ refresh: true })" />
      <AdsTabs v-model="statusFilter" :items="META_STATUS_TABS" />

      <p v-if="noDelivery && datePreset !== 'maximum'" class="notice warn" style="align-items: center">
        <AdsIcon name="i-lucide-alert-triangle" />
        <span>None of these ad sets delivered in this period, so Meta reports no results.</span>
        <button class="btn btn-sm" type="button" style="margin-inline-start: auto" @click="datePreset = 'maximum'">Show all time</button>
      </p>

      <section class="card flush" aria-label="Ad sets">
        <MetaInsightsTable level="adset" name-label="Ad set" budget :rows="tableRows" :currency="currency" :busy="busy" :to="(r) => `/meta-ads/campaigns/${campaignId}/${r.id}`" empty-text="This campaign has no ad sets matching this filter." />
        <div v-if="next" style="padding: 12px 20px"><button class="btn" type="button" :disabled="busy" @click="load({ more: true })">Load more</button></div>
      </section>
      <p class="hint muted">Open an ad set to see its ads. An ad set without a budget uses the campaign's budget.</p>
    </template>
  </AdsPage>
</template>
