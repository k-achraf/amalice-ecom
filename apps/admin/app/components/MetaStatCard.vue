<script setup lang="ts">
// A headline figure: label, big value, change vs the previous period (arrow + % + a good/bad
// word, never color alone) and an optional sparkline of its daily values.
const props = defineProps<{
  label: string
  value: string
  // Percent change vs the previous period; null = nothing to compare.
  delta?: number | null
  lowerIsBetter?: boolean
  spark?: (number | null)[]
  hint?: string
  dark?: boolean
  // Colors the value (a loss in red) — always paired with a hint word.
  tone?: 'loss' | 'gain'
}>()

const direction = computed(() => (props.delta == null || Math.abs(props.delta) < 0.05 ? 'flat' : props.delta > 0 ? 'up' : 'down'))
const good = computed(() => direction.value === 'flat' ? null : (direction.value === 'up') !== !!props.lowerIsBetter)
const deltaText = computed(() => (props.delta == null ? '' : `${props.delta > 0 ? '+' : ''}${props.delta.toFixed(1)}%`))
const arrow = computed(() => (direction.value === 'up' ? '▲' : direction.value === 'down' ? '▼' : '■'))

// Sparkline path over a 100x28 box (null days are gaps).
const path = computed(() => {
  const pts = (props.spark ?? []).map((v) => (v == null || !Number.isFinite(v) ? null : v))
  const nums = pts.filter((v): v is number => v !== null)
  if (nums.length < 2) return ''
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || 1
  let d = ''
  let pen = false
  pts.forEach((v, i) => {
    if (v === null) { pen = false; return }
    const x = (i / (pts.length - 1)) * 100
    const y = 26 - ((v - min) / span) * 24
    d += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `
    pen = true
  })
  return d
})
</script>

<template>
  <div class="kpi" :class="{ dark }" style="position: relative; overflow: hidden; min-width: 0">
    <span class="label">{{ label }}</span>
    <span class="value" :style="{ overflowWrap: 'anywhere', color: tone === 'loss' ? 'var(--danger-fg)' : undefined }">{{ value }}</span>
    <span class="meta" style="gap: 6px; flex-wrap: wrap">
      <span v-if="delta != null" class="delta" :class="{ down: good === false, brass: dark }" :title="good === null ? 'No change' : good ? 'Better than the previous period' : 'Worse than the previous period'">
        {{ arrow }} {{ deltaText }}<template v-if="good !== null"> · {{ good ? 'better' : 'worse' }}</template>
      </span>
      <span v-if="hint">{{ hint }}</span>
    </span>
    <svg v-if="path" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true" style="position: absolute; right: 12px; top: 12px; width: 72px; height: 24px; opacity: 0.9">
      <path :d="path" fill="none" :stroke="dark ? '#F1EDE2' : '#2a78d6'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
    </svg>
  </div>
</template>
