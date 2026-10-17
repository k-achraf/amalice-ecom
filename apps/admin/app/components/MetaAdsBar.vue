<script setup lang="ts">
import { META_DATE_PRESETS, META_DATE_PRESET_LABELS } from '@amalice/shared'

// Ad-account picker + date range shared by the Meta Ads dashboard and campaigns pages.
defineProps<{ refreshing?: boolean }>()
const emit = defineEmits<{ refresh: [] }>()

const { accounts, accountId, datePreset, select } = useMetaAds()
const accountOptions = computed(() => accounts.value.map((a) => ({ label: `${a.name} · ${a.accountId}`, value: a.accountId })))
const presetOptions = META_DATE_PRESETS.map((p) => ({ label: META_DATE_PRESET_LABELS[p], value: p }))
</script>

<template>
  <div class="card" style="flex-direction: row; flex-wrap: wrap; align-items: flex-end; gap: 12px">
    <AdsField label="Ad account" style="flex: 1 1 260px">
      <AdsSelect :model-value="accountId" :options="accountOptions" placeholder="Choose an ad account…" @update:model-value="select($event as string)" />
    </AdsField>
    <AdsField label="Period" style="flex: 0 1 190px">
      <AdsSelect v-model="datePreset" :options="presetOptions" />
    </AdsField>
    <button class="btn" type="button" :disabled="refreshing || !accountId" @click="emit('refresh')"><AdsIcon name="i-lucide-refresh-cw" />Refresh</button>
  </div>
</template>
