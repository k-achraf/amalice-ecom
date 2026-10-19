<script setup lang="ts">
import type { SourcingAnalysis } from '@amalice/shared'

// Competitor summary (AI, from what the team recorded) + return risk of the product's
// category from our own past orders. Run on demand: the summary costs one AI request.
const props = defineProps<{ sourcedId: string }>()

const api = useAdminApi()
const { run } = useApiAction()
const analysis = ref<SourcingAnalysis | null>(null)
const loading = ref(false)

async function analyze() {
  loading.value = true
  const res = await run(() => api<SourcingAnalysis>(`/admin/sourcing/products/${props.sourcedId}/analysis`, { method: 'POST' }), {
    errorFallback: 'Could not analyze this product'
  })
  loading.value = false
  if (res) analysis.value = res
}

const dzd = (cents: number | null) => (cents == null ? '—' : `${Math.round(cents / 100).toLocaleString('en-US')} DA`)
const pct = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n)}%`)
const LEVEL_CLASS: Record<string, string> = { High: 'returned', Medium: 'pending', Low: 'delivered', Unknown: '' }
</script>

<template>
  <div class="card">
    <div class="card-head">
      <h2>Research analysis</h2>
      <button class="btn btn-sm" type="button" :disabled="loading" @click="analyze"><AdsIcon name="i-lucide-sparkles" />{{ loading ? 'Analyzing…' : analysis ? 'Analyze again' : 'Analyze' }}</button>
    </div>
    <p v-if="!analysis" class="muted">Summarises the competitors you logged and shows how this product's category has performed on returns in your own orders.</p>
    <template v-else>
      <h3 style="font-size: 14px; margin-bottom: 4px">Competitors</h3>
      <p class="muted" style="font-size: 13px">
        {{ analysis.competitors.stats.count }} logged<template v-if="analysis.competitors.stats.withPrice">
          · price {{ dzd(analysis.competitors.stats.minCents) }} – {{ dzd(analysis.competitors.stats.maxCents) }} (median {{ dzd(analysis.competitors.stats.medianCents) }})</template>
        <template v-if="analysis.competitors.ourTestPricesCents.length"> · your tested prices: {{ analysis.competitors.ourTestPricesCents.map(dzd).join(', ') }}</template>
      </p>
      <template v-if="analysis.competitors.summary">
        <p style="margin: 6px 0">{{ analysis.competitors.summary.summary }}</p>
        <p style="margin: 6px 0"><b>Price position:</b> {{ analysis.competitors.summary.pricePosition }}</p>
        <ul v-if="analysis.competitors.summary.points.length" style="margin: 6px 0 0 18px">
          <li v-for="(pt, i) in analysis.competitors.summary.points" :key="i">{{ pt }}</li>
        </ul>
      </template>
      <p v-else class="muted" style="margin-top: 6px">{{ analysis.competitors.aiUnavailableReason }}</p>

      <h3 style="font-size: 14px; margin: 14px 0 4px">Return risk by category</h3>
      <p v-if="analysis.returnRisk.category" style="margin: 4px 0">
        <b>{{ analysis.returnRisk.category.category }}</b>:
        {{ pct(analysis.returnRisk.category.ratePct) }} returned ({{ analysis.returnRisk.category.returned }} of {{ analysis.returnRisk.category.finished }})
        <span class="pill" :class="LEVEL_CLASS[analysis.returnRisk.category.level]">{{ analysis.returnRisk.category.level === 'Unknown' ? 'Too few orders' : `${analysis.returnRisk.category.level} risk` }}</span>
        · store average {{ pct(analysis.returnRisk.storeRatePct) }}
      </p>
      <p class="muted" style="font-size: 13px">{{ analysis.returnRisk.note }}</p>
      <table v-if="analysis.returnRisk.worst.length" style="margin-top: 8px; min-width: 360px">
        <thead><tr><th>Category</th><th>Returned</th><th>Rate</th><th>Risk</th></tr></thead>
        <tbody>
          <tr v-for="r in analysis.returnRisk.worst" :key="r.category">
            <td>{{ r.category }}</td><td>{{ r.returned }} / {{ r.finished }}</td><td>{{ pct(r.ratePct) }}</td>
            <td><span class="pill" :class="LEVEL_CLASS[r.level]">{{ r.level }}</span></td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>
