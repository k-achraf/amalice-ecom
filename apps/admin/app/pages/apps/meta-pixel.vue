<script setup lang="ts">
import type { AppInstallationView, MetaPixelAdminConfig, SendMetaPixelTestEventResult } from '@amalice/shared'

definePageMeta({ requiredRole: 'SuperAdmin' })
useHead({ title: 'Meta Pixel' })

const api = useAdminApi()
const toast = useToast()

const { data: apps, pending } = await useAdminFetch<AppInstallationView[]>('/admin/apps', { key: 'admin-apps' })
const app = computed(() => apps.value?.find((a) => a.appId === 'meta-pixel'))
const config = computed(() => app.value?.config as MetaPixelAdminConfig | null)

// Local editable copies — apply on save, not on click (same pattern as
// settings/storefront.vue). accessTokenInput is special: the server never
// echoes the real token back (see AppsService.maskConfigForAdmin), so this
// field always starts blank and means "set a new token" only when non-empty.
// clearAccessToken is the explicit "remove it" action, separate from "leave
// it alone" (blank input).
const enabled = ref(false)
const pixelId = ref('')
const capiEnabled = ref(false)
const testEventCode = ref('')
const accessTokenInput = ref('')
const clearAccessToken = ref(false)

watchEffect(() => {
  if (!app.value) return
  enabled.value = app.value.enabled
  pixelId.value = config.value?.pixelId ?? ''
  capiEnabled.value = config.value?.capiEnabled ?? false
  testEventCode.value = config.value?.testEventCode ?? ''
  accessTokenInput.value = ''
  clearAccessToken.value = false
})

const hasAccessToken = computed(() => !!config.value?.hasAccessToken)

const saving = ref(false)
const dirty = computed(() => !!app.value && (
  enabled.value !== app.value.enabled ||
  pixelId.value !== (config.value?.pixelId ?? '') ||
  capiEnabled.value !== (config.value?.capiEnabled ?? false) ||
  testEventCode.value !== (config.value?.testEventCode ?? '') ||
  !!accessTokenInput.value.trim() ||
  clearAccessToken.value
))

function setAccessToken(value: string) {
  accessTokenInput.value = value
  if (value) clearAccessToken.value = false
}

async function save() {
  if (!dirty.value) return
  saving.value = true
  try {
    const body: Record<string, unknown> = {
      pixelId: pixelId.value || null,
      capiEnabled: capiEnabled.value,
      testEventCode: testEventCode.value || null
    }
    if (clearAccessToken.value) {
      body.accessToken = null
    } else if (accessTokenInput.value.trim()) {
      body.accessToken = accessTokenInput.value.trim()
    }
    // accessToken omitted entirely otherwise — the server preserves
    // whatever's already stored.

    const updated = await api<AppInstallationView>('/admin/apps/meta-pixel', {
      method: 'PUT',
      body: { enabled: enabled.value, config: body }
    })
    // Replace the array (not an in-place index mutation) so the `app`
    // computed reliably re-evaluates and `dirty` clears right away — a
    // mutated index on the fetched array didn't consistently invalidate it.
    if (apps.value) {
      apps.value = apps.value.map((a) => (a.appId === 'meta-pixel' ? updated : a))
    }
    toast.add({ title: 'Meta Pixel updated', color: 'success' })
  } catch {
    toast.add({ title: 'Update failed', description: 'Check the Pixel ID is a valid 10-20 digit number.', color: 'error' })
  } finally {
    saving.value = false
  }
}

// Test Events — fires one real event against Meta's Conversions API using
// whatever is currently SAVED server-side (not unsaved local edits, which
// is why the button is disabled while dirty).
const testEventOptions = ['Purchase', 'InitiateCheckout', 'AddToCart', 'PageView', 'Lead'] as const
const testEventName = ref<(typeof testEventOptions)[number]>('Purchase')
const sendingTestEvent = ref(false)
const testEventResult = ref<SendMetaPixelTestEventResult | null>(null)
const testEventErrorMessage = ref<string | null>(null)

const canSendTestEvent = computed(() => enabled.value && !!pixelId.value && hasAccessToken.value && !dirty.value)

async function sendTestEvent() {
  sendingTestEvent.value = true
  testEventResult.value = null
  testEventErrorMessage.value = null
  try {
    testEventResult.value = await api<SendMetaPixelTestEventResult>('/admin/apps/meta-pixel/test-event', {
      method: 'POST',
      body: { eventName: testEventName.value }
    })
    toast.add({
      title: 'Test event sent',
      description: `Meta received ${testEventResult.value.eventsReceived} event(s). Check Events Manager → Test Events.`,
      color: 'success'
    })
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    testEventErrorMessage.value = data?.message ?? 'Failed to send test event.'
    toast.add({ title: 'Test event failed', description: testEventErrorMessage.value, color: 'error' })
  } finally {
    sendingTestEvent.value = false
  }
}
</script>

<template>
  <AdsPage title="Meta Pixel" description="Marketing app">
    <template #actions>
      <NuxtLink to="/apps" class="btn"><AdsIcon name="i-lucide-arrow-left" />Apps</NuxtLink>
    </template>

    <div v-if="pending" class="empty">Loading…</div>
    <div v-else class="stack" style="width: 100%; max-width: 760px; padding-bottom: 72px">
      <div class="prod" style="align-items: flex-start">
        <span class="app-logo" style="background: var(--teal); color: var(--ivory)" aria-hidden="true"><AdsIcon name="i-lucide-target" /></span>
        <div class="grow">
          <h2 style="font-size: 18px">Meta Pixel</h2>
          <p class="muted">Track page views, add-to-cart, and purchase events for Meta (Facebook/Instagram) ad retargeting and measurement.</p>
        </div>
      </div>

      <section class="card" aria-label="Meta Pixel settings">
        <div class="setting">
          <div class="text"><b>Enable Meta Pixel</b><span>When on, the browser pixel script loads on every storefront page.</span></div>
          <AdsSwitch v-model="enabled" aria-label="Enable Meta Pixel" />
        </div>

        <AdsField label="Pixel ID" help="Find this in Meta Events Manager — a 15-16 digit number.">
          <AdsInput v-model="pixelId" placeholder="1234567890123456" style="max-width: 380px" />
        </AdsField>

        <p v-if="enabled && !pixelId" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>Enabled but no Pixel ID set — nothing will be tracked yet.</span></p>
      </section>

      <section class="card" aria-label="Conversions API">
        <div class="setting">
          <div class="text">
            <b>Conversions API (server-side events)</b>
            <span>Sends Purchase events directly from our server to Meta, in addition to the browser pixel — recovers orders the browser pixel misses (ad blockers, iOS privacy settings, Safari ITP) and dedupes automatically against the browser event for the same order.</span>
          </div>
          <AdsSwitch v-model="capiEnabled" aria-label="Enable Conversions API" />
        </div>

        <AdsField label="Access token" :help="hasAccessToken ? 'A token is already saved — leave blank to keep it.' : 'A System User token from Meta Events Manager → Conversions API → Generate access token.'">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
            <AdsInput
              :model-value="accessTokenInput"
              type="password"
              autocomplete="new-password"
              :placeholder="hasAccessToken ? '•••••••••••••••••••• (configured)' : 'EAAG…'"
              style="flex: 1 1 260px; max-width: 380px"
              @update:model-value="setAccessToken($event as string)"
            />
            <span v-if="hasAccessToken && !accessTokenInput && !clearAccessToken" class="pill connected">Configured</span>
            <button v-if="hasAccessToken && !clearAccessToken" class="btn btn-danger btn-sm" type="button" @click="clearAccessToken = true; accessTokenInput = ''">Remove</button>
            <span v-if="clearAccessToken" class="pill new">Will be removed on save</span>
          </div>
        </AdsField>

        <AdsField label="Test event code" help="From Meta Events Manager → Test Events — scopes events to the test stream instead of production reporting. Optional; remove once you're done testing.">
          <AdsInput v-model="testEventCode" placeholder="TEST12345" style="max-width: 380px" />
        </AdsField>

        <p v-if="capiEnabled && (!pixelId || !hasAccessToken && !accessTokenInput)" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>Conversions API is on but needs both a Pixel ID and an access token to actually send events.</span></p>
      </section>

      <section class="card" aria-label="Send a test event">
        <div class="card-head"><h2>Send a test event</h2></div>
        <p class="muted">
          Fires one real event at Meta using your saved Pixel ID and access token — watch it arrive in
          <b>Events Manager → Test Events</b> to confirm the integration works.
        </p>

        <div style="display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px">
          <AdsField label="Event">
            <AdsSelect v-model="testEventName" :items="[...testEventOptions]" style="width: 190px" />
          </AdsField>
          <AdsButton appearance="default" :loading="sendingTestEvent" :disabled="!canSendTestEvent" icon="i-lucide-send" @click="sendTestEvent">
            Send test event
          </AdsButton>
        </div>

        <p v-if="dirty" class="muted">Save your changes first — test events use the saved configuration, not unsaved edits.</p>
        <p v-else-if="!enabled" class="muted">Enable Meta Pixel above to send a test event.</p>
        <p v-else-if="!pixelId || !hasAccessToken" class="muted">Set a Pixel ID and access token above to send a test event.</p>

        <div v-if="testEventResult" class="notice">
          <AdsIcon name="i-lucide-circle-check" />
          <span>
            <b>{{ testEventResult.eventsReceived }} event(s) received by Meta</b>
            <template v-if="testEventResult.fbtraceId"><br><span class="mono">fbtrace_id: {{ testEventResult.fbtraceId }}</span></template>
            <template v-for="(m, i) in testEventResult.messages" :key="i"><br>{{ m }}</template>
          </span>
        </div>
        <p v-if="testEventErrorMessage" class="notice danger"><AdsIcon name="i-lucide-circle-x" /><span>{{ testEventErrorMessage }}</span></p>
      </section>
    </div>

    <div class="savebar" :class="{ on: dirty }">
      <span>Unsaved changes</span>
      <AdsButton appearance="brass" :loading="saving" :disabled="!dirty" icon="i-lucide-check" @click="save">Save</AdsButton>
    </div>
  </AdsPage>
</template>
