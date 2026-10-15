<script setup lang="ts">
import { TIMELINE_CATEGORIES, TIMELINE_CATEGORY_LABELS, type ActivityFeedResponse, type OrderTimelineEvent, type TimelineCategory } from '@amalice/shared'

// Everything that is being done to orders, across the whole store, newest first:
// who changed what, which calls were made, what the couriers reported. Filter by
// type or person; open any event's order for its full tracking record.
definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })
useHead({ title: 'Order activity' })

const api = useAdminApi()
const { run } = useApiAction()

const category = ref<'all' | TimelineCategory>('all')
const actor = ref('')
const events = ref<OrderTimelineEvent[]>([])
const nextBefore = ref<string | null>(null)
const loading = ref(false)

async function load(reset: boolean) {
  loading.value = true
  const query: Record<string, string> = { limit: '50' }
  if (!reset && nextBefore.value) query.before = nextBefore.value
  if (category.value !== 'all') query.category = category.value
  if (actor.value.trim()) query.actor = actor.value.trim()
  const res = await run(() => api<ActivityFeedResponse>('/admin/orders/activity', { query }), { errorFallback: 'Could not load the activity' })
  if (res) {
    events.value = reset ? res.events : [...events.value, ...res.events]
    nextBefore.value = res.nextBefore
  }
  loading.value = false
}
await load(true)

watch(category, () => load(true))
let timer: ReturnType<typeof setTimeout> | undefined
watch(actor, () => {
  clearTimeout(timer)
  timer = setTimeout(() => load(true), 350)
})

const chips = [{ label: 'All', value: 'all' }, ...TIMELINE_CATEGORIES.filter((c) => c !== 'notification').map((c) => ({ label: TIMELINE_CATEGORY_LABELS[c], value: c }))]
const toneColor: Record<string, string> = { good: 'var(--teal)', warn: 'var(--brass)', bad: '#b42318', neutral: 'var(--text-2, #6b7280)' }

const grouped = computed(() => {
  const groups: { day: string; items: OrderTimelineEvent[] }[] = []
  for (const e of events.value) {
    const day = new Date(e.at).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(e)
    else groups.push({ day, items: [e] })
  }
  return groups
})
function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <AdsPage title="Order activity" description="Every operation on every order">
    <template #actions>
      <NuxtLink to="/orders" class="btn"><AdsIcon name="i-lucide-list" />Orders</NuxtLink>
      <button class="btn" type="button" :disabled="loading" @click="load(true)"><AdsIcon name="i-lucide-refresh-cw" />Refresh</button>
    </template>

    <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center">
      <AdsTabs :model-value="category" :items="chips" @update:model-value="(v) => (category = v as typeof category)" />
      <AdsSearch v-model="actor" placeholder="Filter by person (email)…" style="max-width: 280px" />
    </div>

    <section v-for="g in grouped" :key="g.day" class="card flush">
      <div class="card-head"><h2 style="font-size: 14px">{{ g.day }}</h2></div>
      <ul style="list-style: none; margin: 0; padding: 0">
        <li v-for="e in g.items" :key="e.id" style="display: grid; grid-template-columns: 56px 1fr auto; gap: 12px; padding: 10px 20px; border-top: 1px solid var(--line-soft); align-items: start">
          <span class="mono muted" style="font-size: 12px; padding-top: 2px">{{ time(e.at) }}</span>
          <div style="min-width: 0">
            <b :style="{ color: toneColor[e.tone] }" style="font-size: 14px">{{ e.title }}</b>
            <span class="pill neutral" style="font-size: 11px; margin-left: 8px">{{ TIMELINE_CATEGORY_LABELS[e.category] }}</span>
            <p v-if="e.detail" style="font-size: 13px; margin-top: 2px; overflow-wrap: anywhere">{{ e.detail }}</p>
            <p class="muted" style="font-size: 12px; margin-top: 2px">{{ e.actor }}</p>
          </div>
          <NuxtLink v-if="e.orderId" :to="`/orders/${e.orderId}`" class="link-cell" style="white-space: nowrap">#{{ e.orderId.slice(0, 8) }}</NuxtLink>
        </li>
      </ul>
    </section>

    <div v-if="!events.length && !loading" class="empty">No activity matches.</div>
    <div v-if="nextBefore" style="text-align: center">
      <button class="btn" type="button" :disabled="loading" @click="load(false)">Load older activity</button>
    </div>
  </AdsPage>
</template>
