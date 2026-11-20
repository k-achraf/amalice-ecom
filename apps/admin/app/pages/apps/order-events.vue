<script setup lang="ts">
import {
  DEFAULT_ORDER_EVENT_CONFIRMED,
  DEFAULT_ORDER_EVENT_DELIVERED,
  RESERVED_AD_EVENT_NAMES,
  type AppInstallationView,
  type OrderEventSetting,
  type OrderEventsConfig
} from '@amalice/shared'

definePageMeta({ requiredRole: 'SuperAdmin' })
useHead({ title: 'Order events' })

const api = useAdminApi()
const toast = useToast()

const { data: apps, pending } = await useAdminFetch<AppInstallationView[]>('/admin/apps', { key: 'admin-apps' })
const app = computed(() => apps.value?.find((a) => a.appId === 'order-events'))
const config = computed(() => app.value?.config as Partial<OrderEventsConfig> | null)

// "enabled" of a never-saved app is false, but Delivered has always been sent: show it as on until the owner saves.
const enabled = ref(true)
const confirmed = ref<OrderEventSetting>({ ...DEFAULT_ORDER_EVENT_CONFIRMED })
const delivered = ref<OrderEventSetting>({ ...DEFAULT_ORDER_EVENT_DELIVERED })

watchEffect(() => {
  if (!app.value) return
  const saved = !!config.value && Object.keys(config.value).length > 0
  enabled.value = saved ? app.value.enabled : true
  confirmed.value = { ...DEFAULT_ORDER_EVENT_CONFIRMED, ...(config.value?.confirmed ?? {}) }
  delivered.value = { ...DEFAULT_ORDER_EVENT_DELIVERED, ...(config.value?.delivered ?? {}) }
})

const events = computed(() => [
  {
    key: 'confirmed' as const,
    title: 'Confirmed',
    help: 'Sent when the call center (or the customer via WhatsApp) confirms the order. Useful to optimise ads for orders that are really confirmed.',
    model: confirmed
  },
  {
    key: 'delivered' as const,
    title: 'Delivered',
    help: 'Sent when the courier delivers the order. The strongest signal: a real sale.',
    model: delivered
  }
])

const NAME_RE = /^[A-Za-z][A-Za-z0-9_]{1,39}$/
function nameError(name: string): string | null {
  const n = name.trim()
  if (!NAME_RE.test(n)) return 'Use 2-40 letters, digits or underscores, starting with a letter.'
  if ((RESERVED_AD_EVENT_NAMES as readonly string[]).includes(n.toLowerCase())) return 'This is a standard event (Purchase, Lead…): choose another name.'
  return null
}
const errors = computed(() => ({ confirmed: nameError(confirmed.value.eventName), delivered: nameError(delivered.value.eventName) }))

const savedSnapshot = ref('')
const snapshot = () => JSON.stringify([enabled.value, confirmed.value, delivered.value])
watch(app, () => { savedSnapshot.value = snapshot() }, { immediate: true, flush: 'post' })
const dirty = computed(() => !!app.value && snapshot() !== savedSnapshot.value)
const hasErrors = computed(() => !!errors.value.confirmed || !!errors.value.delivered)

const saving = ref(false)
async function save() {
  if (!dirty.value || hasErrors.value) return
  saving.value = true
  try {
    const clean = (s: OrderEventSetting): OrderEventSetting => ({ ...s, eventName: s.eventName.trim() })
    const updated = await api<AppInstallationView>('/admin/apps/order-events', {
      method: 'PUT',
      body: { enabled: enabled.value, config: { confirmed: clean(confirmed.value), delivered: clean(delivered.value) } }
    })
    if (apps.value) apps.value = apps.value.map((a) => (a.appId === 'order-events' ? updated : a))
    toast.add({ title: 'Order events saved', color: 'success' })
  } catch (err) {
    const message = (err as { data?: { message?: string } })?.data?.message
    toast.add({ title: 'Update failed', description: message ?? 'Check the event names.', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AdsPage title="Order events" description="Marketing app">
    <template #actions>
      <NuxtLink to="/apps" class="btn"><AdsIcon name="i-lucide-arrow-left" />Apps</NuxtLink>
    </template>

    <div v-if="pending" class="empty">Loading…</div>
    <div v-else class="stack" style="width: 100%; max-width: 760px; padding-bottom: 72px">
      <div class="prod" style="align-items: flex-start">
        <span class="app-logo" style="background: var(--teal); color: var(--ivory)" aria-hidden="true"><AdsIcon name="i-lucide-radio-tower" /></span>
        <div class="grow">
          <h2 style="font-size: 18px">Order events (Meta &amp; TikTok)</h2>
          <p class="muted">Sends your own events from our server to Meta (Conversions API) and TikTok (Events API) when an order is confirmed or delivered. Each order sends each event once.</p>
        </div>
      </div>

      <section class="card" aria-label="Order events">
        <div class="setting">
          <div class="text"><b>Send order events</b><span>Master switch. Off = neither event is sent.</span></div>
          <AdsSwitch v-model="enabled" aria-label="Send order events" />
        </div>
        <p class="notice"><AdsIcon name="i-lucide-info" /><span>Events use the server-side credentials already set in <NuxtLink to="/apps/meta-pixel">Meta Pixel</NuxtLink>, <NuxtLink to="/apps/tiktok-pixel">TikTok Pixel</NuxtLink> (Conversions / Events API on, with an access token) or the pixels chosen on a funnel. Events are sent within about 5 minutes of the change.</span></p>
      </section>

      <section v-for="e in events" :key="e.key" class="card" :aria-label="`${e.title} event`">
        <div class="setting">
          <div class="text"><b>{{ e.title }} event</b><span>{{ e.help }}</span></div>
          <AdsSwitch v-model="e.model.value.enabled" :aria-label="`Send the ${e.title} event`" />
        </div>

        <AdsField label="Event name" help="The exact name shown in Meta Events Manager / TikTok. Letters, digits and underscores only.">
          <AdsInput v-model="e.model.value.eventName" maxlength="40" style="max-width: 280px" />
        </AdsField>
        <p v-if="errors[e.key]" class="notice danger"><AdsIcon name="i-lucide-circle-x" /><span>{{ errors[e.key] }}</span></p>

        <div class="setting">
          <div class="text"><b>Send to Meta</b><span>Facebook / Instagram Conversions API.</span></div>
          <AdsSwitch v-model="e.model.value.sendToMeta" :aria-label="`Send ${e.title} to Meta`" />
        </div>
        <div class="setting">
          <div class="text"><b>Send to TikTok</b><span>TikTok Events API.</span></div>
          <AdsSwitch v-model="e.model.value.sendToTikTok" :aria-label="`Send ${e.title} to TikTok`" />
        </div>
      </section>

      <section class="card" aria-label="How to use these events">
        <div class="card-head"><h2>Using them in Meta</h2></div>
        <p class="muted">Custom events appear in Events Manager → your pixel → Overview within minutes. To optimise a campaign for one, create a <b>Custom conversion</b> from the event (Events Manager → Custom conversions) and pick it as the campaign’s conversion event. Renaming an event creates a new event in Meta; the old one keeps its history.</p>
      </section>
    </div>

    <div class="savebar" :class="{ on: dirty }">
      <span>Unsaved changes</span>
      <AdsButton appearance="brass" :loading="saving" :disabled="!dirty || hasErrors" icon="i-lucide-check" @click="save">Save</AdsButton>
    </div>
  </AdsPage>
</template>
