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
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="TikTok Pixel">
        <template #leading><UDashboardSidebarCollapse /></template>
        <template #trailing>
          <UButton to="/apps" variant="ghost" color="neutral" icon="i-lucide-arrow-left" size="sm">Apps</UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="pending" class="py-24 text-center text-muted">Loading…</div>
      <div v-else class="max-w-2xl space-y-8">
        <div class="flex items-start gap-4">
          <div class="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UIcon name="i-lucide-music-2" class="size-6" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-highlighted">TikTok Pixel</h2>
            <p class="text-sm text-muted">Track page views, add-to-cart, and purchase events for TikTok ad retargeting and measurement.</p>
          </div>
        </div>

        <section class="admin-kpi-card space-y-5 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-highlighted">Enable TikTok Pixel</p>
              <p class="text-sm text-muted">When on, the browser pixel script loads on every storefront page.</p>
            </div>
            <USwitch v-model="enabled" />
          </div>

          <UFormField label="Pixel Code" help="Find this in TikTok Events Manager — a ~20 character code, e.g. CT8QTHRC77U9GJ0ON6E0.">
            <UInput v-model="pixelCode" placeholder="CT8QTHRC77U9GJ0ON6E0" class="w-full max-w-sm" />
          </UFormField>

          <p v-if="enabled && !pixelCode" class="flex items-center gap-1.5 text-sm text-warning">
            <UIcon name="i-lucide-alert-triangle" class="size-4" />
            Enabled but no Pixel Code set — nothing will be tracked yet.
          </p>
        </section>

        <section class="admin-kpi-card space-y-5 p-6">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="font-medium text-highlighted">Events API (server-side events)</p>
              <p class="text-sm text-muted">
                Sends CompletePayment events directly from our server to TikTok, in addition to the browser pixel —
                recovers orders the browser pixel misses (ad blockers, browser privacy settings) and dedupes
                automatically against the browser event for the same order.
              </p>
            </div>
            <USwitch v-model="eapiEnabled" />
          </div>

          <UFormField label="Access token" :help="hasAccessToken ? 'A token is already saved — leave blank to keep it.' : 'From TikTok Events Manager → Events API → Generate access token.'">
            <div class="flex items-center gap-2">
              <UInput
                :model-value="accessTokenInput"
                type="password"
                autocomplete="new-password"
                :placeholder="hasAccessToken ? '•••••••••••••••••••• (configured)' : 'a1b2c3d4…'"
                class="w-full max-w-sm"
                @update:model-value="setAccessToken($event as string)"
              />
              <UBadge v-if="hasAccessToken && !accessTokenInput && !clearAccessToken" color="success" variant="subtle" size="sm">Configured</UBadge>
              <UButton
                v-if="hasAccessToken && !clearAccessToken"
                variant="link"
                color="error"
                size="sm"
                @click="clearAccessToken = true; accessTokenInput = ''"
              >
                Remove
              </UButton>
              <UBadge v-if="clearAccessToken" color="warning" variant="subtle" size="sm">Will be removed on save</UBadge>
            </div>
          </UFormField>

          <UFormField label="Test event code" help="From TikTok Events Manager → Test Events — scopes events to the test stream instead of production reporting. Optional; remove once you're done testing.">
            <UInput v-model="testEventCode" placeholder="TEST12345" class="w-full max-w-sm" />
          </UFormField>

          <p v-if="eapiEnabled && (!pixelCode || !hasAccessToken && !accessTokenInput)" class="flex items-center gap-1.5 text-sm text-warning">
            <UIcon name="i-lucide-alert-triangle" class="size-4" />
            Events API is on but needs both a Pixel Code and an access token to actually send events.
          </p>
        </section>

        <section class="admin-kpi-card space-y-4 p-6">
          <div>
            <p class="font-medium text-highlighted">Send a test event</p>
            <p class="text-sm text-muted">
              Fires one real event at TikTok using your saved Pixel Code and access token — watch it arrive in
              <span class="font-medium text-highlighted">Events Manager → Test Events</span> to confirm the integration works.
            </p>
          </div>

          <div class="flex flex-wrap items-end gap-3">
            <UFormField label="Event">
              <USelect v-model="testEventName" :items="[...testEventOptions]" class="w-44" />
            </UFormField>
            <UButton
              :loading="sendingTestEvent"
              :disabled="!canSendTestEvent"
              color="primary"
              variant="soft"
              icon="i-lucide-send"
              @click="sendTestEvent"
            >
              Send test event
            </UButton>
          </div>

          <p v-if="dirty" class="text-xs text-muted">Save your changes first — test events use the saved configuration, not unsaved edits.</p>
          <p v-else-if="!enabled" class="text-xs text-muted">Enable TikTok Pixel above to send a test event.</p>
          <p v-else-if="!pixelCode || !hasAccessToken" class="text-xs text-muted">Set a Pixel Code and access token above to send a test event.</p>

          <div v-if="testEventResult" class="rounded-md border border-[var(--color-admin-border)] bg-[var(--color-admin-surface-tint)] p-3 text-sm">
            <p class="font-medium text-highlighted">{{ testEventResult.eventsReceived }} event(s) received by TikTok</p>
            <p v-if="testEventResult.requestId" class="tabular text-xs text-muted">request_id: {{ testEventResult.requestId }}</p>
            <p v-for="(m, i) in testEventResult.messages" :key="i" class="text-xs text-muted">{{ m }}</p>
          </div>
          <p v-if="testEventErrorMessage" class="flex items-center gap-1.5 text-sm text-error">
            <UIcon name="i-lucide-circle-x" class="size-4" />
            {{ testEventErrorMessage }}
          </p>
        </section>

        <div class="sticky bottom-4 flex items-center justify-between rounded-md border border-[var(--color-admin-border)] bg-[var(--color-admin-surface)] px-5 py-3 shadow-[var(--shadow-admin-md)]">
          <p class="text-sm" :class="dirty ? 'text-highlighted' : 'text-muted'">
            {{ dirty ? 'Unsaved changes.' : 'All changes saved.' }}
          </p>
          <UButton :loading="saving" :disabled="!dirty" color="primary" icon="i-lucide-check" @click="save">Save</UButton>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
