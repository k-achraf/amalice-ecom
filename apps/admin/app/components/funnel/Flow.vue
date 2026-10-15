<script setup lang="ts">
import { FUNNEL_STEP_TYPE_META, type FunnelStepType } from '@amalice/shared'

// A funnel's path as a row of step chips joined by arrows. Used in the template
// picker (preview) and the funnel list/editor (overview). Disabled steps are
// dimmed so the visible path matches what a visitor would actually walk.
defineProps<{
  steps: { type: FunnelStepType; name?: string; enabled?: boolean }[]
  compact?: boolean
}>()
</script>

<template>
  <ol class="flow" :class="{ compact }">
    <template v-for="(s, i) in steps" :key="i">
      <li v-if="i > 0" class="arrow" aria-hidden="true"><AdsIcon name="i-lucide-arrow-right" /></li>
      <li class="step" :class="{ off: s.enabled === false }" :title="s.name ?? FUNNEL_STEP_TYPE_META[s.type].label">
        <AdsIcon :name="FUNNEL_STEP_TYPE_META[s.type].icon" />
        <span>{{ compact ? FUNNEL_STEP_TYPE_META[s.type].label : (s.name ?? FUNNEL_STEP_TYPE_META[s.type].label) }}</span>
      </li>
    </template>
  </ol>
</template>

<style scoped>
.flow { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.step { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--white); color: var(--pine); font-size: 13px; font-weight: 500; white-space: nowrap; }
.step svg { width: 14px; height: 14px; color: var(--teal); flex-shrink: 0; }
.step.off { opacity: .45; text-decoration: line-through; }
.arrow { display: inline-flex; color: var(--text-2); }
.arrow svg { width: 14px; height: 14px; }
.compact .step { padding: 3px 7px; font-size: 12px; }
</style>
