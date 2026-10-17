<script setup lang="ts">
import type { MetaInsightsMetrics } from '@amalice/shared'

// One table for every level of the Meta Ads drill-down (campaigns, ad sets, ads): name,
// status and the metrics picked in the "Metrics" menu. A row with `to` opens the next level.
export interface MetaTableRow {
  id: string
  name: string
  sub?: string | null
  effectiveStatus: string
  thumbnailUrl?: string | null
  dailyBudget?: number | null
  lifetimeBudget?: number | null
  insights: MetaInsightsMetrics | null
}

const props = defineProps<{
  rows: MetaTableRow[]
  currency: string | null
  busy?: boolean
  nameLabel: string
  // Which level these rows are, for the per-row Analytics link.
  level: 'campaign' | 'adset' | 'ad'
  // Where a row leads (the next level down); omit for the last level.
  to?: (row: MetaTableRow) => string
  // Budget exists on campaigns and ad sets, not on ads.
  budget?: boolean
  emptyText?: string
}>()

const { visible } = useMetaMetrics()
const columns = computed(() => visible.value.filter((m) => props.budget || !m.campaign))
const money = (v: number | null | undefined) => formatMoney(v, props.currency)

function open(row: MetaTableRow, event: MouseEvent) {
  if (!props.to || (event.target as HTMLElement).closest('a,button')) return
  navigateTo(props.to(row))
}
</script>

<template>
  <div class="table-wrap">
    <table :style="{ minWidth: `${480 + columns.length * 110}px` }">
      <thead>
        <tr>
          <th style="padding-left: 20px">{{ nameLabel }}</th><th>Status</th>
          <th v-for="(m, i) in columns" :key="m.key" class="num">{{ m.label }}</th>
          <th class="num" style="padding-right: 20px"><span class="sr">Analytics</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="busy && !rows.length"><td :colspan="3 + columns.length" class="empty">Loading from Meta…</td></tr>
        <tr v-else-if="!rows.length"><td :colspan="3 + columns.length" class="empty">{{ emptyText ?? 'Nothing matches this filter.' }}</td></tr>
        <tr v-for="r in rows" :key="r.id" :class="{ clickable: !!to }" @click="open(r, $event)">
          <td style="padding-left: 20px; max-width: 320px">
            <div class="prod">
              <img v-if="r.thumbnailUrl" :src="r.thumbnailUrl" alt="" loading="lazy" style="width: 40px; height: 40px; border-radius: 6px; object-fit: cover; flex-shrink: 0">
              <span>
                <NuxtLink v-if="to" class="link-cell" :to="to(r)">{{ r.name }}</NuxtLink>
                <span v-else class="strong">{{ r.name }}</span>
                <span class="sub">{{ r.sub ? `${r.sub} · ` : '' }}{{ r.id }}</span>
              </span>
            </div>
          </td>
          <td><span class="pill" :class="metaStatusPill(r.effectiveStatus)">{{ metaLabel(r.effectiveStatus) }}</span></td>
          <td v-for="m in columns" :key="m.key" class="num" :class="{ strong: m.key === 'spend' }">
            <template v-if="m.key === 'budget'">
              <template v-if="r.dailyBudget != null">{{ money(r.dailyBudget) }}<span class="sub">per day</span></template>
              <template v-else-if="r.lifetimeBudget != null">{{ money(r.lifetimeBudget) }}<span class="sub">lifetime</span></template>
              <span v-else class="muted">{{ nameLabel === 'Campaign' ? 'Ad set' : 'Campaign' }}</span>
            </template>
            <template v-else>{{ metricText(m, r.insights, currency) }}</template>
          </td>
          <td class="num" style="padding-right: 20px; white-space: nowrap">
            <NuxtLink class="btn btn-sm" :to="`/meta-ads/analytics/${level}/${r.id}`" :aria-label="`Analytics of ${r.name}`"><AdsIcon name="i-lucide-bar-chart-3" />Analytics</NuxtLink>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

