<script setup lang="ts">
import {
  DEFAULT_WHATSAPP_ABANDONED_MESSAGE,
  DEFAULT_WHATSAPP_ORDER_MESSAGE,
  WHATSAPP_PLACEHOLDERS,
  type AppInstallationView,
  type WhatsAppAdminConfig,
  type WhatsAppMessage
} from '@amalice/shared'

definePageMeta({ requiredRole: 'SuperAdmin' })
useHead({ title: 'WhatsApp' })

const api = useAdminApi()
const toast = useToast()
const runtime = useRuntimeConfig()

const { data: apps, pending } = await useAdminFetch<AppInstallationView[]>('/admin/apps', { key: 'admin-apps' })
const app = computed(() => apps.value?.find((a) => a.appId === 'whatsapp'))
const config = computed(() => app.value?.config as WhatsAppAdminConfig | null)

const webhookUrl = computed(() => `${String(runtime.public.apiBase ?? '').replace(/\/$/, '')}/webhooks/whatsapp`)

// Local editable copies, applied on save. The two secrets are write-only: blank input = keep the stored one.
const enabled = ref(false)
const phoneNumberId = ref('')
const verifyToken = ref('')
const accessTokenInput = ref('')
const appSecretInput = ref('')
const clearAccessToken = ref(false)
const clearAppSecret = ref(false)
const sendOrderMessages = ref(true)
const sendAbandonedMessages = ref(true)
const abandonedDelayMinutes = ref(15)
const orderMessage = ref<WhatsAppMessage>({ ...DEFAULT_WHATSAPP_ORDER_MESSAGE })
const abandonedMessage = ref<WhatsAppMessage>({ ...DEFAULT_WHATSAPP_ABANDONED_MESSAGE })
const confirmedReply = ref('')
const cancelledReply = ref('')

watchEffect(() => {
  if (!app.value) return
  const c = config.value
  enabled.value = app.value.enabled
  phoneNumberId.value = c?.phoneNumberId ?? ''
  verifyToken.value = c?.verifyToken ?? ''
  accessTokenInput.value = ''
  appSecretInput.value = ''
  clearAccessToken.value = false
  clearAppSecret.value = false
  sendOrderMessages.value = c?.sendOrderMessages ?? true
  sendAbandonedMessages.value = c?.sendAbandonedMessages ?? true
  abandonedDelayMinutes.value = c?.abandonedDelayMinutes ?? 15
  orderMessage.value = { ...DEFAULT_WHATSAPP_ORDER_MESSAGE, ...(c?.orderMessage ?? {}) }
  abandonedMessage.value = { ...DEFAULT_WHATSAPP_ABANDONED_MESSAGE, ...(c?.abandonedMessage ?? {}) }
  confirmedReply.value = c?.confirmedReply ?? 'شكراً لك، تم تأكيد طلبك ✅ سنتواصل معك قريباً.'
  cancelledReply.value = c?.cancelledReply ?? 'تم إلغاء طلبك ❌ نتمنى خدمتك مستقبلاً.'
})

const hasAccessToken = computed(() => !!config.value?.hasAccessToken)
const hasAppSecret = computed(() => !!config.value?.hasAppSecret)

function snapshot() {
  return JSON.stringify([
    enabled.value, phoneNumberId.value, verifyToken.value, sendOrderMessages.value, sendAbandonedMessages.value, abandonedDelayMinutes.value,
    orderMessage.value, abandonedMessage.value, confirmedReply.value, cancelledReply.value
  ])
}
const saved = ref('')
watch(app, () => { saved.value = snapshot() }, { immediate: true, flush: 'post' })
const dirty = computed(() => !!app.value && (snapshot() !== saved.value || !!accessTokenInput.value.trim() || !!appSecretInput.value.trim() || clearAccessToken.value || clearAppSecret.value))

function generateVerifyToken() {
  verifyToken.value = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
}

function cleanMessage(m: WhatsAppMessage): WhatsAppMessage {
  return { ...m, templateName: m.templateName?.trim() || null, templateLanguage: m.templateLanguage?.trim() || 'ar' }
}

const saving = ref(false)
async function save() {
  if (!dirty.value) return
  saving.value = true
  try {
    const body: Record<string, unknown> = {
      phoneNumberId: phoneNumberId.value.trim() || null,
      verifyToken: verifyToken.value.trim() || null,
      sendOrderMessages: sendOrderMessages.value,
      sendAbandonedMessages: sendAbandonedMessages.value,
      abandonedDelayMinutes: Math.min(1440, Math.max(1, Math.round(Number(abandonedDelayMinutes.value) || 15))),
      orderMessage: cleanMessage(orderMessage.value),
      abandonedMessage: cleanMessage(abandonedMessage.value),
      confirmedReply: confirmedReply.value,
      cancelledReply: cancelledReply.value
    }
    if (clearAccessToken.value) body.accessToken = null
    else if (accessTokenInput.value.trim()) body.accessToken = accessTokenInput.value.trim()
    if (clearAppSecret.value) body.appSecret = null
    else if (appSecretInput.value.trim()) body.appSecret = appSecretInput.value.trim()

    const updated = await api<AppInstallationView>('/admin/apps/whatsapp', { method: 'PUT', body: { enabled: enabled.value, config: body } })
    if (apps.value) apps.value = apps.value.map((a) => (a.appId === 'whatsapp' ? updated : a))
    toast.add({ title: 'WhatsApp settings saved', color: 'success' })
  } catch (err) {
    const message = (err as { data?: { message?: string } })?.data?.message
    toast.add({ title: 'Update failed', description: message ?? 'Check the values (button titles max 20 characters).', color: 'error' })
  } finally {
    saving.value = false
  }
}

// Test message — uses the SAVED settings.
const testPhone = ref('')
const testKind = ref<'order' | 'abandoned'>('order')
const sendingTest = ref(false)
const testError = ref<string | null>(null)
const canTest = computed(() => enabled.value && !!phoneNumberId.value && hasAccessToken.value && !dirty.value && testPhone.value.trim().length >= 8)

async function sendTest() {
  sendingTest.value = true
  testError.value = null
  try {
    await api('/admin/apps/whatsapp/test', { method: 'POST', body: { phone: testPhone.value.trim(), kind: testKind.value } })
    toast.add({ title: 'Test message sent', description: 'Check WhatsApp on that number.', color: 'success' })
  } catch (err) {
    testError.value = (err as { data?: { message?: string } })?.data?.message ?? 'Failed to send the test message.'
    toast.add({ title: 'Test failed', description: testError.value, color: 'error' })
  } finally {
    sendingTest.value = false
  }
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: 'Copied', color: 'success' })
  } catch { /* clipboard unavailable */ }
}

function resetMessage(kind: 'order' | 'abandoned') {
  if (kind === 'order') orderMessage.value = { ...DEFAULT_WHATSAPP_ORDER_MESSAGE }
  else abandonedMessage.value = { ...DEFAULT_WHATSAPP_ABANDONED_MESSAGE }
}

const messageBlocks = computed(() => [
  { key: 'order' as const, title: 'Regular orders', help: 'Sent right after a customer submits an order.', model: orderMessage },
  { key: 'abandoned' as const, title: 'Abandoned carts', help: 'Sent when a customer typed their phone number but never submitted the form.', model: abandonedMessage }
])
</script>

<template>
  <AdsPage title="WhatsApp" description="Operations app">
    <template #actions>
      <NuxtLink to="/apps" class="btn"><AdsIcon name="i-lucide-arrow-left" />Apps</NuxtLink>
    </template>

    <div v-if="pending" class="empty">Loading…</div>
    <div v-else class="stack" style="width: 100%; max-width: 760px; padding-bottom: 72px">
      <div class="prod" style="align-items: flex-start">
        <span class="app-logo" style="background: var(--teal); color: var(--ivory)" aria-hidden="true"><AdsIcon name="i-lucide-message-circle" /></span>
        <div class="grow">
          <h2 style="font-size: 18px">WhatsApp order confirmation</h2>
          <p class="muted">Each new order gets a WhatsApp message with Confirm and Cancel buttons. When the customer taps one, the order is confirmed or cancelled here automatically and labelled “via WhatsApp”.</p>
        </div>
      </div>

      <section class="card" aria-label="Connection">
        <div class="setting">
          <div class="text"><b>Enable WhatsApp confirmation</b><span>Uses the WhatsApp Business Cloud API (Meta). Messages are only sent while this is on.</span></div>
          <AdsSwitch v-model="enabled" aria-label="Enable WhatsApp confirmation" />
        </div>

        <AdsField label="Phone number ID" help="Meta for Developers → your app → WhatsApp → API Setup. Digits only (not the phone number itself).">
          <AdsInput v-model="phoneNumberId" placeholder="123456789012345" style="max-width: 380px" />
        </AdsField>

        <AdsField label="Access token" :help="hasAccessToken ? 'A token is already saved — leave blank to keep it.' : 'A permanent token from a System User with the whatsapp_business_messaging permission.'">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
            <AdsInput
              :model-value="accessTokenInput"
              type="password"
              autocomplete="new-password"
              :placeholder="hasAccessToken ? '•••••••••••••••••••• (configured)' : 'EAAG…'"
              style="flex: 1 1 260px; max-width: 380px"
              @update:model-value="accessTokenInput = $event as string; if ($event) clearAccessToken = false"
            />
            <span v-if="hasAccessToken && !accessTokenInput && !clearAccessToken" class="pill connected">Configured</span>
            <button v-if="hasAccessToken && !clearAccessToken" class="btn btn-danger btn-sm" type="button" @click="clearAccessToken = true; accessTokenInput = ''">Remove</button>
            <span v-if="clearAccessToken" class="pill new">Will be removed on save</span>
          </div>
        </AdsField>

        <p v-if="enabled && (!phoneNumberId || (!hasAccessToken && !accessTokenInput))" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>Enabled but the Phone number ID or access token is missing — no message will be sent.</span></p>
      </section>

      <section class="card" aria-label="Webhook">
        <div class="card-head"><h2>Webhook (to receive the button taps)</h2></div>
        <p class="muted">In Meta for Developers → WhatsApp → Configuration → Webhook, paste the URL and verify token below, then subscribe to the <b>messages</b> field.</p>

        <AdsField label="Callback URL">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
            <code class="mono" style="flex: 1 1 260px; word-break: break-all">{{ webhookUrl }}</code>
            <button class="btn btn-sm" type="button" @click="copy(webhookUrl)"><AdsIcon name="i-lucide-copy" />Copy</button>
          </div>
        </AdsField>

        <AdsField label="Verify token" help="Any secret string (8+ characters). Paste the same value in Meta.">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
            <AdsInput v-model="verifyToken" placeholder="a-long-random-string" style="flex: 1 1 260px; max-width: 380px" />
            <button class="btn btn-sm" type="button" @click="generateVerifyToken"><AdsIcon name="i-lucide-refresh-cw" />Generate</button>
            <button v-if="verifyToken" class="btn btn-sm" type="button" @click="copy(verifyToken)"><AdsIcon name="i-lucide-copy" />Copy</button>
          </div>
        </AdsField>

        <AdsField label="App secret" :help="hasAppSecret ? 'Saved — leave blank to keep it.' : 'Meta app → Settings → Basic → App secret. Required: it proves a button tap really comes from WhatsApp.'">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
            <AdsInput
              :model-value="appSecretInput"
              type="password"
              autocomplete="new-password"
              :placeholder="hasAppSecret ? '•••••••••••••••••••• (configured)' : 'App secret'"
              style="flex: 1 1 260px; max-width: 380px"
              @update:model-value="appSecretInput = $event as string; if ($event) clearAppSecret = false"
            />
            <span v-if="hasAppSecret && !appSecretInput && !clearAppSecret" class="pill connected">Configured</span>
            <button v-if="hasAppSecret && !clearAppSecret" class="btn btn-danger btn-sm" type="button" @click="clearAppSecret = true; appSecretInput = ''">Remove</button>
            <span v-if="clearAppSecret" class="pill new">Will be removed on save</span>
          </div>
        </AdsField>

        <p v-if="enabled && (!verifyToken || (!hasAppSecret && !appSecretInput))" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>Without a verify token and the app secret, button taps are rejected and orders will not change status.</span></p>
      </section>

      <section v-for="block in messageBlocks" :key="block.key" class="card" :aria-label="`${block.title} message`">
        <div class="setting">
          <div class="text"><b>{{ block.title }}</b><span>{{ block.help }}</span></div>
          <AdsSwitch v-if="block.key === 'order'" v-model="sendOrderMessages" :aria-label="`Send for ${block.title}`" />
          <AdsSwitch v-else v-model="sendAbandonedMessages" :aria-label="`Send for ${block.title}`" />
        </div>

        <AdsField v-if="block.key === 'abandoned'" label="Wait before sending (minutes)" help="The message is sent only if the customer still has not submitted the form after this delay. If they submit meanwhile, they get the regular order message instead.">
          <AdsInput v-model.number="abandonedDelayMinutes" type="number" min="1" max="1440" style="width: 120px" />
        </AdsField>

        <AdsField label="Message" :help="`Placeholders: ${WHATSAPP_PLACEHOLDERS.join('  ')}`">
          <AdsTextarea v-model="block.model.value.body" :rows="7" dir="rtl" />
        </AdsField>

        <div style="display: flex; flex-wrap: wrap; gap: 12px">
          <AdsField label="Confirm button (max 20)">
            <AdsInput v-model="block.model.value.confirmLabel" maxlength="20" dir="rtl" style="width: 200px" />
          </AdsField>
          <AdsField label="Cancel button (max 20)">
            <AdsInput v-model="block.model.value.cancelLabel" maxlength="20" dir="rtl" style="width: 200px" />
          </AdsField>
        </div>

        <details>
          <summary class="muted" style="cursor: pointer">Approved template (for customers who never wrote to you)</summary>
          <p v-pre class="muted" style="margin-top: 8px">
            WhatsApp only allows free-text buttons within 24h of the customer’s last message. If it refuses, we send this template instead. Create it in WhatsApp Manager with two quick-reply buttons (Confirm first, Cancel second) and body variables:
            {{1}} name, {{2}} order ref, {{3}} total, {{4}} products, {{5}} store.
          </p>
          <div style="display: flex; flex-wrap: wrap; gap: 12px">
            <AdsField label="Template name"><AdsInput v-model="block.model.value.templateName" placeholder="order_confirmation" style="width: 240px" /></AdsField>
            <AdsField label="Language code"><AdsInput v-model="block.model.value.templateLanguage" placeholder="ar" style="width: 120px" /></AdsField>
          </div>
        </details>

        <div><button class="btn btn-sm" type="button" @click="resetMessage(block.key)"><AdsIcon name="i-lucide-rotate-ccw" />Restore default text</button></div>
      </section>

      <section class="card" aria-label="Replies">
        <div class="card-head"><h2>Reply after a tap</h2></div>
        <AdsField label="When the customer confirms"><AdsTextarea v-model="confirmedReply" :rows="2" dir="rtl" /></AdsField>
        <AdsField label="When the customer cancels"><AdsTextarea v-model="cancelledReply" :rows="2" dir="rtl" /></AdsField>
        <p class="muted">Leave empty to send no reply.</p>
      </section>

      <section class="card" aria-label="Send a test message">
        <div class="card-head"><h2>Send a test message</h2></div>
        <p class="muted">Sends the saved text with a sample order to one number (use international format, e.g. 213551234567). The buttons in a test do not change any order.</p>
        <div style="display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px">
          <AdsField label="Phone"><AdsInput v-model="testPhone" placeholder="+213551234567" style="width: 200px" /></AdsField>
          <AdsField label="Message">
            <AdsSelect v-model="testKind" :items="[{ label: 'Regular order', value: 'order' }, { label: 'Abandoned cart', value: 'abandoned' }]" style="width: 190px" />
          </AdsField>
          <AdsButton appearance="default" :loading="sendingTest" :disabled="!canTest" icon="i-lucide-send" @click="sendTest">Send test</AdsButton>
        </div>
        <p v-if="dirty" class="muted">Save your changes first — the test uses the saved settings.</p>
        <p v-if="testError" class="notice danger"><AdsIcon name="i-lucide-circle-x" /><span>{{ testError }}</span></p>
      </section>
    </div>

    <div class="savebar" :class="{ on: dirty }">
      <span>Unsaved changes</span>
      <AdsButton appearance="brass" :loading="saving" :disabled="!dirty" icon="i-lucide-check" @click="save">Save</AdsButton>
    </div>
  </AdsPage>
</template>
