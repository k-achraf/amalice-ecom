<script setup lang="ts">
import type { CreatePixel, PixelPlatform, PixelView, SendMetaPixelTestEventResult } from '@amalice/shared'

definePageMeta({ requiredRole: 'SuperAdmin' })
useHead({ title: 'Pixels' })

const api = useAdminApi()
const toast = useToast()

const { data: pixels, pending, refresh } = await useAdminFetch<PixelView[]>('/admin/pixels', { key: 'admin-pixels' })

const PLATFORMS: { value: PixelPlatform; label: string }[] = [
  { value: 'Meta', label: 'Meta (Facebook / Instagram)' },
  { value: 'TikTok', label: 'TikTok' }
]

// ---- add / edit dialog ----
const showModal = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const form = reactive({
  name: '',
  platform: 'Meta' as PixelPlatform,
  pixelId: '',
  serverEventsEnabled: false,
  testEventCode: '',
  accessTokenInput: '',
  clearAccessToken: false
})
const editing = computed(() => (pixels.value ?? []).find((p) => p.id === editingId.value) ?? null)
const hasStoredToken = computed(() => !!editing.value?.hasAccessToken)

function openCreate() {
  editingId.value = null
  Object.assign(form, { name: '', platform: 'Meta', pixelId: '', serverEventsEnabled: false, testEventCode: '', accessTokenInput: '', clearAccessToken: false })
  showModal.value = true
}
function openEdit(p: PixelView) {
  editingId.value = p.id
  Object.assign(form, { name: p.name, platform: p.platform, pixelId: p.pixelId, serverEventsEnabled: p.serverEventsEnabled, testEventCode: p.testEventCode ?? '', accessTokenInput: '', clearAccessToken: false })
  showModal.value = true
}

const idLabel = computed(() => (form.platform === 'Meta' ? 'Pixel ID' : 'Pixel code'))
const idHelp = computed(() => (form.platform === 'Meta' ? 'Meta Events Manager — a 15-16 digit number.' : 'TikTok Events Manager — letters and digits, e.g. C1ABCDEFGH23.'))
const tokenHelp = computed(() => {
  if (hasStoredToken.value && !form.clearAccessToken) return 'A token is already saved — leave blank to keep it.'
  return form.platform === 'Meta' ? 'Meta Events Manager → Conversions API → Generate access token.' : 'TikTok Events Manager → Events API → Generate access token.'
})
const canSave = computed(() => !!form.name.trim() && !!form.pixelId.trim())

async function submit() {
  if (!canSave.value) return
  saving.value = true
  try {
    const token = form.accessTokenInput.trim()
    if (editingId.value) {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        pixelId: form.pixelId.trim(),
        serverEventsEnabled: form.serverEventsEnabled,
        testEventCode: form.testEventCode.trim() || null
      }
      if (form.clearAccessToken) body.accessToken = null
      else if (token) body.accessToken = token
      await api<PixelView>(`/admin/pixels/${editingId.value}`, { method: 'PATCH', body })
    } else {
      const body: CreatePixel = {
        name: form.name.trim(),
        platform: form.platform,
        pixelId: form.pixelId.trim(),
        serverEventsEnabled: form.serverEventsEnabled,
        accessToken: token || null,
        testEventCode: form.testEventCode.trim() || null
      }
      await api<PixelView>('/admin/pixels', { method: 'POST', body })
    }
    await refresh()
    showModal.value = false
    toast.add({ title: editingId.value ? 'Pixel updated' : 'Pixel added', color: 'success' })
  } catch (err) {
    const msg = (err as { data?: { message?: string | string[] } })?.data?.message
    toast.add({ title: 'Could not save the pixel', description: Array.isArray(msg) ? msg.join('; ') : (msg ?? 'Check the pixel id.'), color: 'error' })
  } finally {
    saving.value = false
  }
}

// ---- delete ----
const deleteTarget = ref<PixelView | null>(null)
const deleting = ref(false)
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api(`/admin/pixels/${deleteTarget.value.id}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'Pixel deleted', color: 'success' })
    deleteTarget.value = null
  } catch {
    toast.add({ title: 'Could not delete the pixel', color: 'error' })
  } finally {
    deleting.value = false
  }
}

// ---- test event ----
const testingId = ref<string | null>(null)
async function sendTest(p: PixelView) {
  testingId.value = p.id
  try {
    const r = await api<SendMetaPixelTestEventResult>(`/admin/pixels/${p.id}/test-event`, {
      method: 'POST',
      body: { eventName: p.platform === 'Meta' ? 'PageView' : 'ViewContent' }
    })
    toast.add({ title: `Test event sent to "${p.name}"`, description: `${r.eventsReceived} event(s) received. Check Events Manager → Test Events.`, color: 'success' })
  } catch (err) {
    toast.add({ title: 'Test event failed', description: (err as { data?: { message?: string } })?.data?.message ?? 'Failed to send test event.', color: 'error' })
  } finally {
    testingId.value = null
  }
}
</script>

<template>
  <AdsPage title="Pixels" description="Marketing app">
    <template #actions>
      <NuxtLink to="/apps" class="btn"><AdsIcon name="i-lucide-arrow-left" />Apps</NuxtLink>
      <AdsButton icon="i-lucide-plus" @click="openCreate">Add pixel</AdsButton>
    </template>

    <div v-if="pending" class="empty">Loading…</div>
    <div v-else class="stack" style="width: 100%; max-width: 860px">
      <p class="muted">
        Add as many Meta and TikTok pixels as you need and give each a name. In a funnel's settings you choose which of them it fires — no more typing ids by hand.
        The storefront keeps using the store-wide Meta / TikTok Pixel apps.
      </p>

      <section v-if="!(pixels ?? []).length" class="card">
        <div class="empty">
          <p>No pixels yet.</p>
          <AdsButton icon="i-lucide-plus" @click="openCreate">Add your first pixel</AdsButton>
        </div>
      </section>

      <section v-else class="card" aria-label="Pixels">
        <div v-for="p in pixels" :key="p.id" class="setting" style="align-items: center; gap: 12px">
          <span class="app-logo" style="background: var(--teal); color: var(--ivory)" aria-hidden="true"><AdsIcon :name="p.platform === 'Meta' ? 'i-lucide-target' : 'i-lucide-music-2'" /></span>
          <div class="text grow">
            <b>{{ p.name }}</b>
            <span><span class="mono">{{ p.pixelId }}</span> · {{ p.platform }}</span>
          </div>
          <span v-if="p.serverEventsEnabled && p.hasAccessToken" class="pill connected">Server events on</span>
          <span v-else-if="p.serverEventsEnabled" class="pill new">Needs token</span>
          <AdsButton v-if="p.hasAccessToken" appearance="default" size="sm" icon="i-lucide-send" :loading="testingId === p.id" @click="sendTest(p)">Test</AdsButton>
          <button class="btn btn-sm" type="button" @click="openEdit(p)"><AdsIcon name="i-lucide-pencil" />Edit</button>
          <button class="btn btn-danger btn-sm" type="button" @click="deleteTarget = p"><AdsIcon name="i-lucide-trash-2" />Delete</button>
        </div>
      </section>
    </div>

    <AdsDialog v-model:open="showModal" :title="editingId ? 'Edit pixel' : 'Add pixel'">
      <AdsField label="Name" help="To recognise it later, e.g. “Main store – Meta” or “Ramadan TikTok”.">
        <AdsInput v-model="form.name" placeholder="Pixel name" />
      </AdsField>
      <AdsField label="Platform">
        <AdsSelect v-model="form.platform" :items="PLATFORMS" value-key="value" :disabled="!!editingId" />
      </AdsField>
      <AdsField :label="idLabel" :help="idHelp">
        <AdsInput v-model="form.pixelId" class="mono" :placeholder="form.platform === 'Meta' ? '1234567890123456' : 'C1ABCDEFGH23'" />
      </AdsField>

      <div class="setting">
        <div class="text"><b>Server-side events</b><span>Also send Purchase / Delivered events from our server ({{ form.platform === 'Meta' ? 'Conversions API' : 'Events API' }}). Needs an access token.</span></div>
        <AdsSwitch v-model="form.serverEventsEnabled" aria-label="Server-side events" />
      </div>

      <AdsField label="Access token" :help="tokenHelp">
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
          <AdsInput
            v-model="form.accessTokenInput"
            type="password"
            autocomplete="new-password"
            :placeholder="hasStoredToken ? '•••••••••••••••• (configured)' : 'Access token'"
            style="flex: 1 1 240px"
            @update:model-value="form.clearAccessToken = false"
          />
          <button v-if="hasStoredToken && !form.clearAccessToken" class="btn btn-danger btn-sm" type="button" @click="form.clearAccessToken = true; form.accessTokenInput = ''">Remove</button>
          <span v-if="form.clearAccessToken" class="pill new">Will be removed on save</span>
        </div>
      </AdsField>

      <AdsField label="Test event code" help="Optional — only used by the Test button, never by real orders.">
        <AdsInput v-model="form.testEventCode" placeholder="TEST12345" />
      </AdsField>

      <template #footer>
        <button class="btn" type="button" @click="showModal = false">Cancel</button>
        <AdsButton :loading="saving" :disabled="!canSave" icon="i-lucide-check" @click="submit">{{ editingId ? 'Save' : 'Add pixel' }}</AdsButton>
      </template>
    </AdsDialog>

    <AdsDialog :open="!!deleteTarget" title="Delete pixel" width="sm" @update:open="(v: boolean) => { if (!v) deleteTarget = null }">
      <p>Delete <b>{{ deleteTarget?.name }}</b>? Funnels that use it will simply stop firing it.</p>
      <template #footer>
        <button class="btn" type="button" @click="deleteTarget = null">Cancel</button>
        <AdsButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="confirmDelete">Delete</AdsButton>
      </template>
    </AdsDialog>
  </AdsPage>
</template>
