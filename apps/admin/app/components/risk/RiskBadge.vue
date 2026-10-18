<script setup lang="ts">
import { RISK_FACTOR_LABELS } from '@amalice/shared'

// Colour-coded risk score for an order (see packages/shared risk.ts). Renders
// nothing for orders that predate scoring. The tooltip lists why.
const props = defineProps<{
  level: 'Low' | 'Medium' | 'High' | null | undefined
  score?: number | null
  factors?: Array<{ code: string; points: number; detail?: string }> | null
  compact?: boolean
}>()

const cls = computed(() => (props.level === 'High' ? 'returned' : props.level === 'Medium' ? 'new' : 'confirmed'))
const title = computed(() => {
  const lines = (props.factors ?? []).filter((f) => f.points !== 0).map((f) => `${f.points > 0 ? '+' : ''}${f.points} ${RISK_FACTOR_LABELS[f.code] ?? f.code}${f.detail ? ` (${f.detail})` : ''}`)
  return [`${props.level} risk${props.score != null ? ` · ${props.score}/100` : ''}`, ...lines].join('\n')
})
</script>

<template>
  <span v-if="level" class="pill" :class="cls" :title="title">
    <AdsIcon v-if="level === 'High'" name="i-lucide-shield-alert" style="width: 12px; height: 12px" />
    {{ compact ? score : `${level} risk` }}<template v-if="!compact && score != null"> · {{ score }}</template>
  </span>
</template>
