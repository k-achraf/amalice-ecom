<script setup lang="ts">
import type { AppInstallationView, SendTikTokPixelTestEventResult, TikTokPixelAdminConfig } from '@amalice/shared'

definePageMeta({ requiredRole: 'SuperAdmin' })
useHead({ title: 'TikTok Pixel' })

const api = useAdminApi()
const toast = useToast()

const { data: apps, pending } = await useAdminFetch<AppInstallationView[]>('/admin/apps', { key: 'admin-apps' })
const app = computed(() => apps.value?.find((a) => a.appId === 'tiktok-pixel'))
const config = computed(() => app.value?.config as TikTokPixelAdminConfig | null)

// Local editable copies — apply on save, not on click (same pattern as
// meta-pixel.vue / settings/storefront.vue). accessTokenInput is special:
// the server never echoes the real token back (see
// AppsService.maskConfigForAdmin), so this field always starts blank and
// means "set a new token" only when non-empty. clearAccessToken is the
// explicit "remove it" action, separate from "leave it alone" (blank input).
const enabled = ref(false)
const pixelCode = ref('')
const eapiEnabled = ref(false)
const testEventCode = ref('')
const accessTokenInput = ref('')
const clearAccessToken = ref(false)

watchEffect(() => {
  if (!app.value) return
  enabled.value = app.value.enabled
  pixelCode.value = config.value?.pixelCode ?? ''
  eapiEnabled.value = config.value?.eapiEnabled ?? false
  testEventCode.value = config.value?.testEventCode ?? ''
  accessTokenInput.value = ''
  clearAccessToken.value = false
})

const hasAccessToken = computed(() => !!config.value?.hasAccessToken)

const saving = ref(false)
const dirty = computed(() => !!app.value && (
  enabled.value !== app.value.enabled ||
  pixelCode.value !== (config.value?.pixelCode ?? '') ||
  eapiEnabled.value !== (config.value?.eapiEnabled ?? false) ||
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
      pixelCode: pixelCode.value || null,
      eapiEnabled: eapiEnabled.value,
      testEventCode: testEventCode.value || null
    }
    if (clearAccessToken.value) {
      body.accessToken = null
    } else if (accessTokenInput.value.trim()) {
      body.accessToken = accessTokenInput.value.trim()
    }
    // accessToken omitted entirely otherwise — the server preserves
    // whatever's already stored.

    const updated = await api<AppInstallationView>('/admin/apps/tiktok-pixel', {
      method: 'PUT',
      body: { enabled: enabled.value, config: body }
    })
    // Replace the array (not an in-place index mutation) so the `app`
    // computed reliably re-evaluates and `dirty` clears right away — a
    // mutated index on the fetched array didn't consistently invalidate it.
    if (apps.value) {
      apps.value = apps.value.map((a) => (a.appId === 'tiktok-pixel' ? updated : a))
    }
    toast.add({ title: 'TikTok Pixel updated', color: 'success' })
  } catch {
    toast.add({ title: 'Update failed', description: 'Check the Pixel Code is valid.', color: 'error' })
  } finally {
    saving.value = false
  }
}

// Test Events — fires one real event against TikTok's Events API using
// whatever is currently SAVED server-side (not unsaved local edits, which
// is why the button is disabled while dirty).
const testEventOptions = ['CompletePayment', 'InitiateCheckout', 'AddToCart', 'ViewContent', 'SubmitForm'] as const
const testEventName = ref<(typeof testEventOptions)[number]>('CompletePayment')
const sendingTestEvent = ref(false)
const testEventResult = ref<SendTikTokPixelTestEventResult | null>(null)
const testEventErrorMessage = ref<string | null>(null)

const canSendTestEvent = computed(() => enabled.value && !!pixelCode.value && hasAccessToken.value && !dirty.value)

async function sendTestEvent() {
  sendingTestEvent.value = true
  testEventResult.value = null
  testEventErrorMessage.value = null
  try {
    testEventResult.value = await api<SendTikTokPixelTestEventResult>('/admin/apps/tiktok-pixel/test-event', {
      method: 'POST',
      body: { eventName: testEventName.value }
    })
    toast.add({
      title: 'Test event sent',
      description: `TikTok received the event. Check Events Manager → Test Events.`,
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
  <AdsPage title="TikTok Pixel" description="Marketing app">
    <template #actions>
      <NuxtLink to="/apps" class="btn"><AdsIcon name="i-lucide-arrow-left" />Apps</NuxtLink>
    </template>

    <div v-if="pending" class="empty">Loading…</div>
    <div v-else class="stack" style="width: 100%; max-width: 760px; padding-bottom: 72px">
      <div class="prod" style="align-items: flex-start">
        <span class="app-logo" style="background: var(--teal); color: var(--ivory)" aria-hidden="true"><AdsIcon name="i-lucide-music-2" /></span>
        <div class="grow">
          <h2 style="font-size: 18px">TikTok Pixel</h2>
          <p class="muted">Track page views, add-to-cart, and purchase events for TikTok ad retargeting and measurement.</p>
        </div>
      </div>

      <section class="card" aria-label="TikTok Pixel settings">
        <div class="setting">
          <div class="text"><b>Enable TikTok Pixel</b><span>When on, the browser pixel script loads on every storefront page.</span></div>
          <AdsSwitch v-model="enabled" aria-label="Enable TikTok Pixel" />
        </div>

        <AdsField label="Pixel Code" help="Find this in TikTok Events Manager — a ~20 character code, e.g. CT8QTHRC77U9GJ0ON6E0.">
          <AdsInput v-model="pixelCode" placeholder="CT8QTHRC77U9GJ0ON6E0" style="max-width: 380px" />
        </AdsField>

        <p v-if="enabled && !pixelCode" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>Enabled but no Pixel Code set — nothing will be tracked yet.</span></p>
      </section>

      <section class="card" aria-label="Events API">
        <div class="setting">
          <div class="text">
            <b>Events API (server-side events)</b>
            <span>Sends CompletePayment events directly from our server to TikTok, in addition to the browser pixel — recovers orders the browser pixel misses (ad blockers, browser privacy settings) and dedupes automatically against the browser event for the same order.</span>
          </div>
          <AdsSwitch v-model="eapiEnabled" aria-label="Enable Events API" />
        </div>

        <AdsField label="Access token" :help="hasAccessToken ? 'A token is already saved — leave blank to keep it.' : 'From TikTok Events Manager → Events API → Generate access token.'">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
            <AdsInput
              :model-value="accessTokenInput"
              type="password"
              autocomplete="new-password"
              :placeholder="hasAccessToken ? '•••••••••••••••••••• (configured)' : 'a1b2c3d4…'"
              style="flex: 1 1 260px; max-width: 380px"
              @update:model-value="setAccessToken($event as string)"
            />
            <span v-if="hasAccessToken && !accessTokenInput && !clearAccessToken" class="pill connected">Configured</span>
            <button v-if="hasAccessToken && !clearAccessToken" class="btn btn-danger btn-sm" type="button" @click="clearAccessToken = true; accessTokenInput = ''">Remove</button>
            <span v-if="clearAccessToken" class="pill new">Will be removed on save</span>
          </div>
        </AdsField>

        <AdsField label="Test event code" help="From TikTok Events Manager → Test Events — scopes events to the test stream instead of production reporting. Optional; remove once you're done testing.">
          <AdsInput v-model="testEventCode" placeholder="TEST12345" style="max-width: 380px" />
        </AdsField>

        <p v-if="eapiEnabled && (!pixelCode || !hasAccessToken && !accessTokenInput)" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>Events API is on but needs both a Pixel Code and an access token to actually send events.</span></p>
      </section>

      <section class="card" aria-label="Send a test event">
        <div class="card-head"><h2>Send a test event</h2></div>
        <p class="muted">
          Fires one real event at TikTok using your saved Pixel Code and access token — watch it arrive in
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
        <p v-else-if="!enabled" class="muted">Enable TikTok Pixel above to send a test event.</p>
        <p v-else-if="!pixelCode || !hasAccessToken" class="muted">Set a Pixel Code and access token above to send a test event.</p>

        <div v-if="testEventResult" class="notice">
          <AdsIcon name="i-lucide-circle-check" />
          <span>
            <b>{{ testEventResult.eventsReceived }} event(s) received by TikTok</b>
            <template v-if="testEventResult.requestId"><br><span class="mono">request_id: {{ testEventResult.requestId }}</span></template>
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
