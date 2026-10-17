<script setup lang="ts">
import type { MetaOrderStats } from '@amalice/shared'
import { ORDER_STATUS_COLORS, gainLossOption, statusBarOption } from '~/lib/meta-charts'

// Orders linked to ads: how many were confirmed / delivered / returned, the money they brought
// in and what is left after product cost, courier fees and ad spend. Used for one campaign /
// ad set / ad (analytics page) and for the whole account (profitability page).
const props = defineProps<{ stats: MetaOrderStats; rateMissing?: boolean; accountCurrency?: string | null; title?: string }>()

const s = computed(() => props.stats)
const profitable = computed(() => (s.value.profit ?? 0) >= 0)

const cards = computed(() => {
  const x = s.value
  const spendKnown = x.adSpend !== null
  return [
    { label: 'Orders', value: formatCount(x.orders), hint: `${formatCount(x.pending)} awaiting confirmation` },
    { label: 'Confirmation rate', value: formatPct(x.confirmationRate), hint: `${formatCount(x.confirmed)} confirmed` },
    { label: 'Delivery rate', value: formatPct(x.deliveryRate), hint: `${formatCount(x.delivered)} delivered of ${formatCount(x.confirmed)} confirmed` },
    { label: 'Return rate', value: formatPct(x.returnRate), hint: `${formatCount(x.returned)} returned` },
    { label: 'Final delivery rate', value: formatPct(x.finalDeliveryRate), hint: 'Delivered ÷ (delivered + returned)' },
    { label: 'Revenue', value: formatDz(x.revenue), hint: 'Delivered orders' },
    { label: 'Product cost', value: formatDz(x.productCost) },
    { label: 'Courier fees', value: formatDz(x.courierFees) },
    { label: 'Ad spend', value: spendKnown ? formatDz(x.adSpend) : '—', hint: spendKnown ? undefined : 'Set the exchange rate' },
    { label: profitable.value ? 'Profit' : 'Loss', value: x.profit === null ? '—' : formatDz(x.profit), hint: x.profit === null ? 'Needs the exchange rate' : x.roi === null ? undefined : `ROI ${formatPct(x.roi, 0)}`, tone: x.profit !== null && x.profit < 0 ? ('loss' as const) : undefined, dark: x.profit !== null && x.profit >= 0 },
    { label: 'Real ROAS', value: x.realRoas === null ? '—' : `${x.realRoas.toFixed(2)}×`, hint: 'Delivered revenue ÷ ad spend' },
    { label: 'Cost per delivered', value: formatDz(x.costPerDelivered), hint: x.costPerOrder === null ? undefined : `${formatDz(x.costPerOrder)} per order` },
    { label: 'In transit', value: formatDz(x.inProgressValue), hint: `${formatCount(x.inProgress)} order(s) still in progress` }
  ]
})

// Where the money goes: revenue in, then each cost out, then what is left.
const moneyChart = computed(() => {
  const x = s.value
  const names = ['Revenue', 'Product cost', 'Courier fees', ...(x.adSpend !== null ? ['Ad spend'] : []), ...(x.profit !== null ? [x.profit >= 0 ? 'Profit' : 'Loss'] : ['Before ad spend'])]
  const values = [x.revenue, -x.productCost, -x.courierFees, ...(x.adSpend !== null ? [-x.adSpend] : []), ...(x.profit !== null ? [x.profit] : [x.grossProfit])]
  return gainLossOption({ names, values, fmt: (v) => formatDz(v ?? 0), name: 'DZD' })
})
const moneyTable = computed(() => {
  const x = s.value
  return {
    columns: ['Item', 'Amount'],
    rows: [['Revenue (delivered)', formatDz(x.revenue)], ['Product cost', formatDz(-x.productCost)], ['Courier fees', formatDz(-x.courierFees)], ['Ad spend', x.adSpend === null ? '—' : formatDz(-x.adSpend)], [x.profit !== null && x.profit < 0 ? 'Loss' : 'Profit', x.profit === null ? '—' : formatDz(x.profit)]]
  }
})

// The order funnel as one stacked bar: every order ends in exactly one of these.
const outcomeChart = computed(() => {
  const x = s.value
  return statusBarOption({
    names: ['Orders'],
    series: [
      { name: 'Delivered', data: [x.delivered], color: ORDER_STATUS_COLORS.delivered },
      { name: 'Returned', data: [x.returned], color: ORDER_STATUS_COLORS.returned },
      { name: 'In progress', data: [x.inProgress], color: ORDER_STATUS_COLORS.inProgress },
      { name: 'Awaiting confirmation', data: [x.pending], color: ORDER_STATUS_COLORS.pending },
      { name: 'Cancelled', data: [x.cancelledByCallCenter + x.cancelledAfterConfirm], color: ORDER_STATUS_COLORS.cancelled }
    ]
  })
})
const outcomeTable = computed(() => {
  const x = s.value
  const row = (label: string, n: number) => [label, formatCount(n), x.orders ? formatPct((n / x.orders) * 100) : '—']
  return {
    columns: ['Outcome', 'Orders', 'Share'],
    rows: [row('Delivered', x.delivered), row('Returned', x.returned), row('In progress', x.inProgress), row('Awaiting confirmation', x.pending), row('Cancelled at the call center', x.cancelledByCallCenter), row('Cancelled after confirmation', x.cancelledAfterConfirm)]
  }
})
</script>

<template>
  <section :aria-label="title ?? 'Orders and profit'" style="display: flex; flex-direction: column; gap: 12px">
    <div>
      <h2 style="font-size: 18px">{{ title ?? 'Orders & profit' }}</h2>
      <p class="muted" style="font-size: 13px; margin-top: 2px">Real orders linked to these ads, in DZD. Rates use confirmed orders as the base.</p>
    </div>
    <p v-if="rateMissing" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>Ad spend is in {{ accountCurrency ?? 'the account currency' }}: set its exchange rate to DZD (Connection &amp; accounts) to see profit.</span></p>
    <p v-if="stats.orders === 0" class="muted">No order is linked to this in the selected period.</p>
    <template v-else>
      <div class="kpis">
        <MetaStatCard v-for="c in cards" :key="c.label" :label="c.label" :value="c.value" :hint="c.hint" :tone="c.tone" :dark="c.dark" />
      </div>
      <div class="meta-orders-grid">
        <MetaChartCard title="Order outcomes" subtitle="Where each order ended up" :table="outcomeTable">
          <ChartsEChart :option="outcomeChart" :height="150" label="Order outcomes" />
        </MetaChartCard>
        <MetaChartCard title="Where the money goes" subtitle="Revenue, costs and result (DZD)" :table="moneyTable">
          <ChartsEChart :option="moneyChart" :height="260" label="Revenue, costs and profit" />
        </MetaChartCard>
      </div>
    </template>
  </section>
</template>

<style scoped>
.meta-orders-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr)); gap: 16px; }
</style>
