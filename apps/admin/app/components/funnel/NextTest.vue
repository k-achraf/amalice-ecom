<script setup lang="ts">
import type { FunnelSuggestionResult } from '@amalice/shared'

// "What should I test next?" — rule-based, from the same stats shown below (no AI, no quota).
const props = defineProps<{ funnelId: string; days: number }>()

const api = useAdminApi()
const result = ref<FunnelSuggestionResult | null>(null)
const failed = ref(false)

async function load() {
  failed.value = false
  try {
    result.value = await api<FunnelSuggestionResult>(`/admin/funnels/${props.funnelId}/next-test`, { query: { days: String(props.days) } })
  } catch {
    failed.value = true
  }
}
onMounted(load)
watch(() => [props.funnelId, props.days], load)
</script>

<template>
  <div v-if="result" class="card">
    <div class="card-head"><h2>Next test</h2></div>
    <p class="muted" style="margin-bottom: 8px">{{ result.summary }}</p>
    <ol style="list-style: none; padding: 0; margin: 0; display: grid; gap: 12px">
      <li v-for="(s, i) in result.suggestions" :key="s.id" style="font-size: 13px">
        <b>{{ i === 0 && result.status !== 'collect-data' ? 'First: ' : '' }}{{ s.title }}</b>
        <span style="display: block"><span class="muted">Why:</span> {{ s.evidence }}</span>
        <span style="display: block"><span class="muted">Change:</span> {{ s.change }}</span>
        <span class="muted" style="display: block">Decided by: {{ s.metric }} · about {{ s.minVisitorsPerVariant }} visitors per variant</span>
      </li>
    </ol>
  </div>
</template>
