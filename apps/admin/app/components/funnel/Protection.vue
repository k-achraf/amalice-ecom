<script setup lang="ts">
import { FUNNEL_BLOCK_REASONS, FunnelProtectionSchema, type FunnelBlockedAttemptList, type FunnelDetail, type FunnelProtection } from '@amalice/shared'

// Protection tab: every anti-spam / fake-order rule of one funnel. Saved whole with PATCH /admin/funnels/:id
// (`protection`), enforced by the API on each order the funnel receives (see apps/api CLAUDE.md → funnels).
const props = defineProps<{ funnel: FunnelDetail }>()
const emit = defineEmits<{ saved: [funnel: FunnelDetail] }>()

const api = useAdminApi()
const { run } = useApiAction()
const toast = useToast()

const clone = (p: FunnelProtection): FunnelProtection => JSON.parse(JSON.stringify(p))
const form = ref<FunnelProtection>(clone(props.funnel.protection))
const saved = ref(JSON.stringify(props.funnel.protection))
watch(
  () => props.funnel.protection,
  (p) => {
    form.value = clone(p)
    saved.value = JSON.stringify(p)
    syncRaws()
  }
)
// The secret field is write-only: typing a new one counts as a change.
const dirty = computed(() => JSON.stringify(form.value) !== saved.value)

// Lists are edited as text, one entry per line. The text is its own state (so typing a newline works) and
// is parsed into the form on every keystroke; it is rewritten from the form only on load / discard.
const parseList = (v: string) => v.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean)
const raws = reactive({ ips: '', phones: '', wips: '' })
function syncRaws() {
  raws.ips = form.value.network.blockedIps.join('\n')
  raws.phones = form.value.whitelist.phones.join('\n')
  raws.wips = form.value.whitelist.ips.join('\n')
}
syncRaws()
watch(() => raws.ips, (v) => (form.value.network.blockedIps = parseList(v)))
watch(() => raws.phones, (v) => (form.value.whitelist.phones = parseList(v)))
watch(() => raws.wips, (v) => (form.value.whitelist.ips = parseList(v)))

const fakeActions = [
  { label: 'Ignore', value: 'ignore' },
  { label: 'Warn (flag for the call center)', value: 'warn' },
  { label: 'Block the order', value: 'block' }
]

// Number inputs hand back null when emptied: keep the stored number instead of sending null.
const num = (v: number | null | undefined, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

const saving = ref(false)
async function save() {
  const parsed = FunnelProtectionSchema.safeParse(form.value)
  if (!parsed.success) {
    toast.add({ title: 'Check the values', description: parsed.error.issues[0]?.message ?? 'A value is out of range.', color: 'error' })
    return
  }
  const body = parsed.data
  saving.value = true
  const next = await run(() => api<FunnelDetail>(`/admin/funnels/${props.funnel.id}`, { method: 'PATCH', body: { protection: body } }), {
    success: 'Protection saved',
    errorFallback: 'Could not save the protection settings'
  })
  saving.value = false
  if (next) {
    emit('saved', next)
    loadBlocked()
  }
}
function discard() {
  form.value = clone(props.funnel.protection)
  syncRaws()
}

// ---- refused attempts ----
const page = ref(1)
const blocked = ref<FunnelBlockedAttemptList | null>(null)
const loading = ref(true)
const failed = ref(false)
async function loadBlocked() {
  loading.value = true
  failed.value = false
  try {
    blocked.value = await api<FunnelBlockedAttemptList>(`/admin/funnels/${props.funnel.id}/blocked-attempts`, { query: { page: String(page.value) } })
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}
onMounted(loadBlocked)
function goToPage(p: number) {
  page.value = p
  loadBlocked()
}
const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const reasonLabel = (r: keyof typeof FUNNEL_BLOCK_REASONS) => FUNNEL_BLOCK_REASONS[r]
const totalBlocked30 = computed(() => (blocked.value?.summary ?? []).reduce((n, s) => n + s.count, 0))
</script>

<template>
  <section class="stack" aria-label="Protection settings">
    <p class="notice"><AdsIcon name="i-lucide-shield-check" /><span>These rules apply to orders placed on <b>this funnel</b> only. Every rule can be turned off; a number set to <b>0</b> means "no limit". Whitelisted phones and IPs are never restricted.</span></p>

    <!-- Bots -->
    <section class="card" aria-label="Bots and spam">
      <div class="card-head"><h2>Bots &amp; spam</h2></div>
      <div class="stack">
        <AdsSwitch v-model="form.bots.honeypot" label="Honeypot field" description="A hidden field only a bot fills. Such an order is dropped without telling the bot." />
        <AdsSwitch v-model="form.bots.blockBotUserAgents" label="Block bots and scripts" description="Crawlers, curl, python-requests, headless browsers and requests with no User-Agent." />
        <AdsSwitch v-model="form.bots.requireVisit" label="Require a real page visit" description="Only visitors who opened this funnel page can order (a page view with the same visitor id must exist)." />
        <AdsField label="Minimum time to fill the form (seconds)" help="Orders sent faster than this after the form appeared are refused. 0 = off.">
          <AdsNumberInput :model-value="form.bots.minFillSeconds" :min="0" :max="60" style="max-width: 140px" @update:model-value="(v) => (form.bots.minFillSeconds = num(v))" />
        </AdsField>
        <div class="stack" style="border-top: 1px solid var(--line, #e5e5e5); padding-top: 12px">
          <AdsSwitch v-model="form.bots.captcha.enabled" label="Cloudflare Turnstile captcha" description="A free, low-friction captcha shown in the order form. Needs a Turnstile widget created in your Cloudflare account." />
          <div v-if="form.bots.captcha.enabled" class="grid-2">
            <AdsField label="Site key"><AdsInput v-model="form.bots.captcha.siteKey" class="mono" placeholder="0x4AAAAAAA…" /></AdsField>
            <AdsField label="Secret key" :help="form.bots.captcha.secretSet ? 'A secret key is saved. Leave empty to keep it.' : 'Write-only: it is never shown again.'">
              <AdsInput v-model="form.bots.captcha.secretKey" class="mono" type="password" autocomplete="off" :placeholder="form.bots.captcha.secretSet ? '•••••••• (saved)' : '0x4AAAAAAA…'" />
            </AdsField>
          </div>
          <p v-if="form.bots.captcha.enabled && (!form.bots.captcha.siteKey || (!form.bots.captcha.secretKey && !form.bots.captcha.secretSet))" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>The captcha stays off until both keys are saved.</span></p>
        </div>
      </div>
    </section>

    <!-- Limits -->
    <section class="card" aria-label="Order limits">
      <div class="card-head"><h2>Order limits</h2></div>
      <div class="stack">
        <div class="grid-2">
          <AdsField label="Max orders per phone"><AdsNumberInput :model-value="form.limits.phoneMax" :min="0" :max="100" @update:model-value="(v) => (form.limits.phoneMax = num(v))" /></AdsField>
          <AdsField label="…within (hours)"><AdsNumberInput :model-value="form.limits.phoneHours" :min="1" :max="720" @update:model-value="(v) => (form.limits.phoneHours = num(v, 24))" /></AdsField>
          <AdsField label="Max orders per IP address"><AdsNumberInput :model-value="form.limits.ipMax" :min="0" :max="1000" @update:model-value="(v) => (form.limits.ipMax = num(v))" /></AdsField>
          <AdsField label="…within (hours)"><AdsNumberInput :model-value="form.limits.ipHours" :min="1" :max="720" @update:model-value="(v) => (form.limits.ipHours = num(v, 1))" /></AdsField>
          <AdsField label="Max orders per visitor (browser)"><AdsNumberInput :model-value="form.limits.visitorMax" :min="0" :max="100" @update:model-value="(v) => (form.limits.visitorMax = num(v))" /></AdsField>
          <AdsField label="…within (hours)"><AdsNumberInput :model-value="form.limits.visitorHours" :min="1" :max="720" @update:model-value="(v) => (form.limits.visitorHours = num(v, 24))" /></AdsField>
        </div>
        <div class="grid-2">
          <AdsField label="Cooldown between two orders (minutes)" help="Same phone, IP or visitor. 0 = off.">
            <AdsNumberInput :model-value="form.limits.cooldownMinutes" :min="0" :max="1440" @update:model-value="(v) => (form.limits.cooldownMinutes = num(v))" />
          </AdsField>
          <AdsField label="Block a repeated order (hours)" help="The same phone ordering again within this time is refused. 0 = only flagged as a possible duplicate.">
            <AdsNumberInput :model-value="form.limits.duplicateBlockHours" :min="0" :max="720" @update:model-value="(v) => (form.limits.duplicateBlockHours = num(v))" />
          </AdsField>
        </div>
      </div>
    </section>

    <!-- Phone -->
    <section class="card" aria-label="Phone checks">
      <div class="card-head"><h2>Phone number</h2></div>
      <div class="stack">
        <AdsSwitch v-model="form.phone.algerianOnly" label="Algerian mobile numbers only" description="05 / 06 / 07 followed by 8 digits." />
        <AdsSwitch v-model="form.phone.rejectRepeated" label="Reject fake-looking numbers" description="0555555555, 0666666666, 0612121212 …" />
        <AdsSwitch v-model="form.phone.otp" label="Verify the phone with a code (OTP)" description="The customer types a 6-digit code sent by SMS before the order is accepted." />
        <p v-if="form.phone.otp" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>SMS delivery goes through the notifications provider. Until a real SMS provider is connected on the server, codes are only written to the API log and customers cannot receive them — keep this off in production until then.</span></p>
      </div>
    </section>

    <!-- Fake orders -->
    <section class="card" aria-label="Fake orders">
      <div class="card-head"><h2>Fake orders</h2></div>
      <div class="stack">
        <AdsSwitch v-model="form.risk.useBlacklist" label="Use the blacklist" description="Refuse (Block) or flag (Warn) phones and addresses on the shared blacklist." />
        <div class="grid-2">
          <AdsField label="Auto-warn after N returned orders" help="The phone is put on the blacklist as Warn at its next order. 0 = never.">
            <AdsNumberInput :model-value="form.risk.autoWarnReturns" :min="0" :max="20" @update:model-value="(v) => (form.risk.autoWarnReturns = num(v))" />
          </AdsField>
          <AdsField label="Auto-block after N returned orders" help="…as Block (orders refused). 0 = never.">
            <AdsNumberInput :model-value="form.risk.autoBlockReturns" :min="0" :max="20" @update:model-value="(v) => (form.risk.autoBlockReturns = num(v))" />
          </AdsField>
          <AdsField label="Fake-looking name"><AdsSelect v-model="form.risk.fakeNameAction" :options="fakeActions" /></AdsField>
          <AdsField label="Fake-looking address"><AdsSelect v-model="form.risk.fakeAddressAction" :options="fakeActions" /></AdsField>
          <AdsField label="Medium risk from score" help="Shown to the call center.">
            <AdsNumberInput :model-value="form.risk.mediumFrom" :min="1" :max="99" @update:model-value="(v) => (form.risk.mediumFrom = num(v, 30))" />
          </AdsField>
          <AdsField label="High risk from score">
            <AdsNumberInput :model-value="form.risk.highFrom" :min="1" :max="100" @update:model-value="(v) => (form.risk.highFrom = num(v, 60))" />
          </AdsField>
          <AdsField label="Refuse orders scoring at least" help="0 = never refuse, only flag. Be careful: a first order from a new customer already scores a few points.">
            <AdsNumberInput :model-value="form.risk.blockAtScore" :min="0" :max="100" @update:model-value="(v) => (form.risk.blockAtScore = num(v))" />
          </AdsField>
        </div>
        <p v-if="form.risk.highFrom <= form.risk.mediumFrom" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>"High risk from" should be above "Medium risk from".</span></p>
        <AdsField label="Message shown to a refused customer" help="Leave empty for the standard message. Never say which rule refused the order.">
          <AdsInput v-model="form.risk.blockedMessage" maxlength="200" placeholder="عذراً، لا يمكن قبول هذا الطلب حالياً. يرجى التواصل مع خدمة العملاء." dir="rtl" />
        </AdsField>
      </div>
    </section>

    <!-- Network -->
    <section class="card" aria-label="Network">
      <div class="card-head"><h2>Location &amp; network</h2></div>
      <div class="stack">
        <AdsSwitch v-model="form.network.blockDesktop" label="Block desktop orders" description="Only phones and tablets can order. Orders from a computer browser are refused." />
        <AdsSwitch v-model="form.network.algeriaOnly" label="Algeria only" description="Needs the country header of a CDN such as Cloudflare (CF-IPCountry). Without it nobody is refused." />
        <AdsSwitch v-model="form.network.blockProxies" label="Block Tor and anonymous proxies" description="Detected from the CDN's country header (Tor = T1) and proxy request headers. It cannot spot every VPN." />
        <AdsField label="Blocked IPs" help="One per line: an address (41.200.1.5) or a range (41.200.0.0/16).">
          <AdsTextarea v-model="raws.ips" :rows="3" class="mono" placeholder="41.200.1.5&#10;102.10.0.0/16" />
        </AdsField>
      </div>
    </section>

    <!-- Whitelist -->
    <section class="card" aria-label="Whitelist">
      <div class="card-head"><h2>Whitelist</h2></div>
      <div class="grid-2">
        <AdsField label="Phones" help="One per line. Never restricted by any rule here (use it for your own test numbers).">
          <AdsTextarea v-model="raws.phones" :rows="3" class="mono" placeholder="0555123456" />
        </AdsField>
        <AdsField label="IP addresses" help="One per line (addresses or ranges), e.g. your office.">
          <AdsTextarea v-model="raws.wips" :rows="3" class="mono" placeholder="197.200.10.5" />
        </AdsField>
      </div>
    </section>

    <div class="savebar" :class="{ on: dirty }">
      <span>You have unsaved protection changes.</span>
      <button class="btn" type="button" @click="discard">Discard</button>
      <button class="btn btn-brass" type="button" :disabled="saving" @click="save">Save protection</button>
    </div>

    <!-- Refused attempts -->
    <section class="card" aria-label="Blocked attempts" style="padding-bottom: 16px">
      <div class="card-head">
        <h2>Blocked attempts <span class="muted" style="font-weight: 400">· {{ totalBlocked30 }} in the last 30 days</span></h2>
        <button type="button" class="btn btn-sm" @click="loadBlocked"><AdsIcon name="i-lucide-refresh-cw" />Refresh</button>
      </div>
      <p class="muted" style="margin: 0 0 12px">Use this to check that the rules are not too strict: many blocked attempts from real-looking phones means a rule needs loosening.</p>
      <div v-if="blocked?.summary.length" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px">
        <span v-for="s in blocked.summary" :key="s.reason" class="pill neutral">{{ reasonLabel(s.reason) }} · {{ s.count }}</span>
      </div>
      <p v-if="failed" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>Could not load the blocked attempts.</span></p>
      <div class="table-wrap">
        <table style="min-width: 640px">
          <thead><tr><th>When</th><th>Reason</th><th>Phone</th><th>IP</th><th>Detail</th></tr></thead>
          <tbody>
            <tr v-if="loading && !blocked"><td colspan="5" class="empty">Loading…</td></tr>
            <tr v-else-if="!blocked?.items.length"><td colspan="5" class="empty">Nothing has been blocked on this funnel.</td></tr>
            <tr v-for="a in blocked?.items ?? []" v-else :key="a.id">
              <td style="white-space: nowrap">{{ fmtDate(a.createdAt) }}</td>
              <td>{{ reasonLabel(a.reason) }}</td>
              <td class="mono">{{ a.phone ?? '—' }}</td>
              <td class="mono">{{ a.ip ?? '—' }}</td>
              <td class="muted" style="max-width: 280px; overflow: hidden; text-overflow: ellipsis" :title="a.userAgent ?? ''">{{ a.detail ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <AdsPagination :total="blocked?.total ?? 0" :page="page" :page-size="blocked?.pageSize ?? 20" :page-size-options="[20]" item-label="attempts" @update:page="goToPage" />
    </section>
  </section>
</template>
