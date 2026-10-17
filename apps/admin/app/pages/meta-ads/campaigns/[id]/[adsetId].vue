<script setup lang="ts">
import type { MetaAdsResponse } from '@amalice/shared'

definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })

const route = useRoute()
const campaignId = route.params.id as string
const adsetId = route.params.adsetId as string
const { connected, datePreset } = useMetaAds()
const { data, rows, next, busy, statusFilter, noDelivery, load } = useMetaLevel<MetaAdsResponse>((account) => `/admin/meta-ads/accounts/${account}/adsets/${adsetId}/ads`)
const currency = computed(() => data.value?.currency ?? null)
const name = computed(() => data.value?.parent.name ?? adsetId)
const campaignName = computed(() => data.value?.campaign?.name ?? campaignId)
useHead({ title: computed(() => `${name.value} · Ads`) })
const tableRows = computed(() => rows.value as MetaAdsResponse['items'])
</script>

<template>
  <AdsPage :title="name" description="Ads">
    <template #breadcrumb>
      <NuxtLink to="/meta-ads/campaigns">Campaigns</NuxtLink><AdsIcon name="i-lucide-chevron-right" style="width: 14px; height: 14px" />
      <NuxtLink :to="`/meta-ads/campaigns/${campaignId}`">{{ campaignName }}</NuxtLink><AdsIcon name="i-lucide-chevron-right" style="width: 14px; height: 14px" /><span>{{ name }}</span>
    </template>
    <template v-if="connected" #actions>
      <NuxtLink :to="`/meta-ads/analytics/adset/${adsetId}`" class="btn"><AdsIcon name="i-lucide-bar-chart-3" />Ad set analytics</NuxtLink>
      <MetaMetricPicker />
    </template>

    <template v-if="connected">
      <MetaAdsBar :refreshing="busy" @refresh="load({ refresh: true })" />
      <AdsTabs v-model="statusFilter" :items="META_STATUS_TABS" />

      <p v-if="noDelivery && datePreset !== 'maximum'" class="notice warn" style="align-items: center">
        <AdsIcon name="i-lucide-alert-triangle" />
        <span>None of these ads delivered in this period, so Meta reports no results.</span>
        <button class="btn btn-sm" type="button" style="margin-inline-start: auto" @click="datePreset = 'maximum'">Show all time</button>
      </p>

      <section class="card flush" aria-label="Ads">
        <MetaInsightsTable level="ad" name-label="Ad" :rows="tableRows" :currency="currency" :busy="busy" empty-text="This ad set has no ads matching this filter." />
        <div v-if="next" style="padding: 12px 20px"><button class="btn" type="button" :disabled="busy" @click="load({ more: true })">Load more</button></div>
      </section>
    </template>
  </AdsPage>
</template>
