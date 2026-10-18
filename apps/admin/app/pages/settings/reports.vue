<script setup lang="ts">
import type { ReportSettingsView } from '@amalice/shared'

definePageMeta({ requiredRole: 'SuperAdmin' })
useHead({ title: 'Reports & alerts' })

const api = useAdminApi()
const toast = useToast()

const { data: settings, pending, error: loadError } = await useAdminFetch<ReportSettingsView>('/admin/reports/settings', { key: 'admin-report-settings' })

const form = reactive({
  enabled: false,
  botToken: '',
  chatId: '',
  dailyReportHour: 21,
  maxCostPerOrderDzd: '' as string | number,
  returnRateAlertPct: 40,
  returnRateMinOrders: 8,
  carrierStaleHours: 36
})

watchEffect(() => {
  const s = settings.value
  if (!s) return
  form.enabled = s.enabled
  form.chatId = s.telegramChatId ?? ''
  form.dailyReportHour = s.dailyReportHour
  form.maxCostPerOrderDzd = s.maxCostPerOrderDzd ?? ''
  form.returnRateAlertPct = s.returnRateAlertPct
  form.returnRateMinOrders = s.returnRateMinOrders
  form.carrierStaleHours = s.carrierStaleHours
})

const saving = ref(false)
const busy = ref<'test' | 'send' | null>(null)

async function save() {
  saving.value = true
  try {
    const maxCost = Number(form.maxCostPerOrderDzd)
    settings.value = await api<ReportSettingsView>('/admin/reports/settings', {
      method: 'PUT',
      body: {
        enabled: form.enabled,
        // Blank = keep the stored token.
        ...(form.botToken.trim() && { telegramBotToken: form.botToken.trim() }),
        telegramChatId: form.chatId.trim() || null,
        dailyReportHour: Number(form.dailyReportHour),
        maxCostPerOrderDzd: form.maxCostPerOrderDzd !== '' && maxCost > 0 ? Math.round(maxCost) : null,
        returnRateAlertPct: Number(form.returnRateAlertPct),
        returnRateMinOrders: Number(form.returnRateMinOrders),
        carrierStaleHours: Number(form.carrierStaleHours)
      }
    })
    form.botToken = ''
    toast.add({ title: 'Reports & alerts saved', color: 'success' })
  } catch {
    toast.add({ title: 'Could not save', description: 'Check the values and try again.', color: 'error' })
  } finally {
    saving.value = false
  }
}

async function run(kind: 'test' | 'send') {
  busy.value = kind
  try {
    await api(kind === 'test' ? '/admin/reports/test' : '/admin/reports/send-now', { method: 'POST' })
    toast.add({ title: kind === 'test' ? 'Test message sent' : 'Report sent', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Telegram failed', description: (e as Error).message || 'Save the bot token and chat id first.', color: 'error' })
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <AdsPage title="Reports & alerts" description="Daily Telegram summary and automatic warnings.">
    <template #actions>
      <button class="btn btn-primary" type="button" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save' }}</button>
    </template>

    <div v-if="pending" class="empty">Loading…</div>
    <div v-else-if="loadError" class="empty"><p style="color: var(--danger-fg)">Failed to load settings.</p><p>{{ loadError.message }}</p></div>
    <div v-else class="stack">
      <section class="card" aria-labelledby="tg-h">
        <div class="card-head"><h2 id="tg-h">Telegram</h2></div>
        <p class="card-sub">Create a bot with @BotFather, add it to your group (or start a chat with it), then paste its token and the chat id.</p>
        <label style="display: flex; gap: 8px; align-items: center; margin-bottom: 12px"><input v-model="form.enabled" type="checkbox"> Send the daily report and alerts</label>
        <AdsField label="Bot token" :help="settings?.telegramConfigured ? 'A token is already saved — leave blank to keep it.' : 'Looks like 123456:ABC-DEF…'">
          <AdsInput v-model="form.botToken" type="password" placeholder="Bot token" autocomplete="off" />
        </AdsField>
        <AdsField label="Chat id" help="A number such as -1001234567890 for groups.">
          <AdsInput v-model="form.chatId" placeholder="Chat id" />
        </AdsField>
        <div style="display: flex; gap: 8px; flex-wrap: wrap">
          <button class="btn" type="button" :disabled="busy !== null || !settings?.telegramConfigured" @click="run('test')">{{ busy === 'test' ? 'Sending…' : 'Send test message' }}</button>
          <button class="btn" type="button" :disabled="busy !== null || !settings?.telegramConfigured" @click="run('send')">{{ busy === 'send' ? 'Sending…' : 'Send today\'s report now' }}</button>
        </div>
        <span class="muted" style="font-size: 12px">Save first: the buttons use the saved values.</span>
      </section>

      <section class="card" aria-labelledby="daily-h">
        <div class="card-head"><h2 id="daily-h">Daily summary</h2></div>
        <p class="card-sub">Orders, deliveries, returns, low stock and call-center performance for the day.</p>
        <AdsField label="Send at (hour, Algiers time, 0–23)"><AdsInput v-model="form.dailyReportHour" type="number" min="0" max="23" style="max-width: 120px" /></AdsField>
      </section>

      <section class="card" aria-labelledby="alerts-h">
        <div class="card-head"><h2 id="alerts-h">Alerts</h2></div>
        <p class="card-sub">Each alert is sent once per day per subject.</p>
        <AdsField label="Max cost per order (DZD)" help="Meta ads: warns when a campaign's spend today divided by its orders goes above this. Empty = off. Needs the ad account's exchange rate.">
          <AdsInput v-model="form.maxCostPerOrderDzd" type="number" min="0" placeholder="e.g. 800" style="max-width: 160px" />
        </AdsField>
        <AdsField label="Return rate alert (%)" help="Warns when a wilaya's return rate over the last 30 days reaches this.">
          <AdsInput v-model="form.returnRateAlertPct" type="number" min="1" max="100" style="max-width: 120px" />
        </AdsField>
        <AdsField label="Minimum closed orders per wilaya" help="Ignores wilayas with fewer delivered + returned orders than this.">
          <AdsInput v-model="form.returnRateMinOrders" type="number" min="1" style="max-width: 120px" />
        </AdsField>
        <AdsField label="Courier silent for (hours)" help="Warns when a courier hasn't updated any in-transit parcel for this long. 0 = off.">
          <AdsInput v-model="form.carrierStaleHours" type="number" min="0" style="max-width: 120px" />
        </AdsField>
      </section>
    </div>
  </AdsPage>
</template>
