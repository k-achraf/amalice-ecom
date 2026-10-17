<script setup lang="ts">
// "Metrics" dropdown: tick the figures to show on the Meta Ads pages. `withCampaign`
// also offers the campaign-level columns (budget), which only make sense in the table.
const props = defineProps<{ withCampaign?: boolean }>()
const { selected, isOn, toggle, reset } = useMetaMetrics()
const groups = computed(() =>
  META_METRIC_GROUPS.map((g) => ({ name: g, items: META_METRICS.filter((m) => m.group === g && (props.withCampaign || !m.campaign)) })).filter((g) => g.items.length)
)
</script>

<template>
  <AdsPopover>
    <button class="btn" type="button"><AdsIcon name="i-lucide-settings" />Metrics<span class="pill neutral" style="margin-inline-start: 4px">{{ selected.length }}</span></button>
    <template #content>
      <div style="width: 260px; max-height: 420px; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 14px">
        <div v-for="g in groups" :key="g.name" style="display: flex; flex-direction: column; gap: 8px">
          <b style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-2)">{{ g.name }}</b>
          <AdsCheckbox v-for="m in g.items" :key="m.key" :model-value="isOn(m.key)" :label="m.label" @update:model-value="toggle(m.key, $event === true)" />
        </div>
        <button class="btn btn-sm btn-ghost" type="button" style="align-self: flex-start" @click="reset"><AdsIcon name="i-lucide-rotate-ccw" />Reset to default</button>
      </div>
    </template>
  </AdsPopover>
</template>
