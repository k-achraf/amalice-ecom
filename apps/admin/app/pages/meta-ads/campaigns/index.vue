<script setup lang="ts">
import type { MetaCampaignsResponse } from '@amalice/shared'

definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })
useHead({ title: 'Meta Ads · Campaigns' })

const { status, datePreset, connected, expired } = useMetaAds()
const { data, rows, next, busy, statusFilter, noDelivery, load } = useMetaLevel<MetaCampaignsResponse>((account) => `/admin/meta-ads/accounts/${account}/campaigns`)
const currency = computed(() => data.value?.currency ?? null)
const tableRows = computed(() => (rows.value as MetaCampaignsResponse['items']).map((c) => ({ ...c, sub: c.objective ? metaLabel(c.objective) : null })))
</script>

<template>
  <AdsPage title="Campaigns" description="Meta Ads">
    <template v-if="connected" #actions><MetaMetricPicker with-campaign /></template>
    <AdsBanner v-if="expired" tone="warning">
      Your Meta session expired.
      <NuxtLink to="/meta-ads/accounts" style="font-weight: 600">Reconnect your account</NuxtLink>
    </AdsBanner>
    <AdsEmptyState v-if="status && !status.connection" icon="i-lucide-megaphone" title="Connect your Meta account" description="Link your Facebook account to see your campaigns.">
      <NuxtLink to="/meta-ads/accounts" class="btn btn-primary" style="margin-top: 8px">Connect Meta</NuxtLink>
    </AdsEmptyState>

    <template v-else-if="connected">
      <MetaAdsBar :refreshing="busy" @refresh="load({ refresh: true })" />
      <AdsTabs v-model="statusFilter" :items="META_STATUS_TABS" />

      <p v-if="noDelivery && datePreset !== 'maximum'" class="notice warn" style="align-items: center">
        <AdsIcon name="i-lucide-alert-triangle" />
        <span>None of these campaigns delivered in this period, so Meta reports no results.</span>
        <button class="btn btn-sm" type="button" style="margin-inline-start: auto" @click="datePreset = 'maximum'">Show all time</button>
      </p>

      <section class="card flush" aria-label="Campaigns">
        <MetaInsightsTable level="campaign" name-label="Campaign" budget :rows="tableRows" :currency="currency" :busy="busy" :to="(r) => `/meta-ads/campaigns/${r.id}`" empty-text="No campaigns match this filter." />
        <div v-if="next" style="padding: 12px 20px"><button class="btn" type="button" :disabled="busy" @click="load({ more: true })">Load more</button></div>
      </section>
      <p class="hint muted">Open a campaign to see its ad sets. Amounts are in the ad account's currency{{ currency ? ` (${currency})` : '' }}. Results are the pixel's purchases reported by Meta.</p>
    </template>
  </AdsPage>
</template>
