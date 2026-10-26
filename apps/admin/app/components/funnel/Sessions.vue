<script setup lang="ts">
import type { FunnelRecordingDetail, FunnelRecordingList, FunnelRecordingSummary } from '@amalice/shared'

// Replays of this funnel's visits (rrweb): how real visitors scroll, tap and fill the order form. Typed text is
// masked in the visitor's browser, so a replay never shows names, phones or addresses.
const props = defineProps<{ funnelId: string }>()

const api = useAdminApi()
const toast = useToast()
const page = ref(1)
const loading = ref(true)
const failed = ref(false)
const data = ref<FunnelRecordingList | null>(null)

async function load() {
  loading.value = true
  failed.value = false
  try {
    data.value = await api<FunnelRecordingList>(`/admin/funnels/${props.funnelId}/recordings`, { query: { page: String(page.value) } })
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(() => props.funnelId, () => { page.value = 1; load() })
function goToPage(p: number) { page.value = p; load() }

const rows = computed(() => data.value?.items ?? [])
const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmtDuration = (s: number | null) => (s == null ? '—' : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`)

// ---- player ----
const playing = ref<FunnelRecordingSummary | null>(null)
const open = computed({ get: () => !!playing.value, set: (v: boolean) => { if (!v) close() } })
const stage = ref<HTMLElement | null>(null)
const opening = ref(false)
const playError = ref('')
let player: { $destroy?: () => void; pause?: () => void } | null = null

function destroyPlayer() {
  try { player?.pause?.(); player?.$destroy?.() } catch { /* already gone */ }
  player = null
  if (stage.value) stage.value.innerHTML = ''
}
function close() {
  destroyPlayer()
  playing.value = null
}
onBeforeUnmount(destroyPlayer)

async function watchRecording(r: FunnelRecordingSummary) {
  playing.value = r
  playError.value = ''
  opening.value = true
  try {
    const [detail, mod] = await Promise.all([
      api<FunnelRecordingDetail>(`/admin/funnels/${props.funnelId}/recordings/${r.viewId}`),
      import('rrweb-player'),
      import('rrweb-player/dist/style.css')
    ])
    await nextTick()
    if (!stage.value || playing.value?.viewId !== r.viewId) return
    if (detail.events.length < 2) throw new Error('Too short to replay')
    destroyPlayer()
    const Player = mod.default
    // The replay is scaled to the panel; phone visits keep their proportions.
    const width = Math.min(stage.value.clientWidth || 360, 420)
    player = new Player({
      target: stage.value,
      props: { events: detail.events as never, width, height: Math.round(width * 1.6), autoPlay: true, skipInactive: true, showController: true }
    })
  } catch (e) {
    playError.value = e instanceof Error && e.message ? e.message : 'Could not load this recording.'
  } finally {
    opening.value = false
  }
}

async function remove(r: FunnelRecordingSummary) {
  if (!confirm('Delete this recording?')) return
  try {
    await api(`/admin/funnels/${props.funnelId}/recordings/${r.viewId}`, { method: 'DELETE' })
    if (playing.value?.viewId === r.viewId) close()
    await load()
  } catch {
    toast.add({ title: 'Could not delete the recording', color: 'error' })
  }
}
</script>

<template>
  <section class="card" aria-label="Visitor sessions" style="padding-bottom: 16px">
    <div class="card-head">
      <h2>Sessions <span class="muted" style="font-weight: 400">· {{ data?.total ?? 0 }}</span></h2>
    </div>
    <p class="muted" style="margin: 0 0 12px">
      Replays of real visits: scrolling, taps and the order form. Text typed by visitors is never recorded. Recordings are kept for 14 days. Turn recording off in the Landing page tab.
    </p>

    <p v-if="failed" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>Could not load the sessions. <button type="button" class="link-cell" style="border: 0; background: none; padding: 0; cursor: pointer" @click="load">Try again</button></span></p>

    <div class="table-wrap">
      <table style="min-width: 720px">
        <thead>
          <tr><th>Visit</th><th>Device</th><th>Source</th><th class="num">Time on page</th><th class="num">Scrolled</th><th>Order form</th><th /></tr>
        </thead>
        <tbody>
          <tr v-if="loading && !rows.length"><td colspan="7" class="empty">Loading…</td></tr>
          <tr v-else-if="!rows.length"><td colspan="7" class="empty">No session has been recorded yet. Visits appear here a few seconds after a visitor opens the page.</td></tr>
          <tr v-for="r in rows" v-else :key="r.viewId">
            <td style="white-space: nowrap">{{ fmtDate(r.startedAt) }}</td>
            <td>{{ r.deviceType ?? '—' }}</td>
            <td style="max-width: 200px">{{ r.source ?? '—' }}<span v-if="r.campaign" class="sub" style="overflow: hidden; text-overflow: ellipsis" :title="r.campaign">{{ r.campaign }}</span></td>
            <td class="num">{{ fmtDuration(r.durationSeconds ?? Math.round(r.recordedMs / 1000)) }}</td>
            <td class="num">{{ r.scrollDepth == null ? '—' : `${r.scrollDepth}%` }}</td>
            <td><span v-if="r.startedForm" class="pill delivered">Started</span><span v-else class="muted">Not touched</span></td>
            <td style="white-space: nowrap; text-align: end">
              <button type="button" class="btn btn-sm" @click="watchRecording(r)"><AdsIcon name="i-lucide-play" />Watch</button>
              <button type="button" class="icon-btn plain sm" aria-label="Delete recording" @click="remove(r)"><AdsIcon name="i-lucide-trash-2" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <AdsPagination :total="data?.total ?? 0" :page="page" :page-size="data?.pageSize ?? 25" item-label="sessions" @update:page="goToPage" />

    <AdsModal v-model:open="open" title="Session replay" :ui="{ content: 'max-w-[520px]' }">
      <p v-if="playing" class="muted" style="margin: 0 0 8px">{{ fmtDate(playing.startedAt) }} · {{ playing.deviceType ?? 'unknown device' }} · {{ playing.source ?? 'direct' }}</p>
      <p v-if="opening" class="muted">Loading the recording…</p>
      <p v-if="playError" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>{{ playError }}</span></p>
      <div ref="stage" style="display: flex; justify-content: center; min-height: 120px" />
    </AdsModal>
  </section>
</template>
