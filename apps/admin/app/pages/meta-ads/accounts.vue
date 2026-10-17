<script setup lang="ts">
import type { MetaAdsStatus, MetaAppCredentialsView } from '@amalice/shared'

definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })
useHead({ title: 'Meta Ads · Accounts' })

const api = useAdminApi()
const toast = useToast()
const auth = useAuthStore()
const { status, accounts, accountId, loading, connected, expired, init, select, sync } = useMetaAds()

const isSuperAdmin = computed(() => auth.role === 'SuperAdmin')
const showConnect = computed(() => !status.value?.connection || expired.value)

const accessToken = ref('')
const connectingToken = ref(false)
const connecting = ref(false)
const syncing = ref(false)
const disconnecting = ref(false)

// Meta app (App ID + secret) — only needed for "Connect with Facebook".
const appId = ref('')
const appSecret = ref('')
const savingApp = ref(false)
const showAdvanced = ref(false)
const redirectUri = ref('')

onMounted(async () => {
  redirectUri.value = `${window.location.origin}/meta-ads/callback`
  await init()
  appId.value = status.value?.app?.appId ?? ''
  showAdvanced.value = !!status.value?.app
})

async function connectWithToken() {
  connectingToken.value = true
  try {
    status.value = await api<MetaAdsStatus>('/admin/meta-ads/connect-token', { method: 'POST', body: { accessToken: accessToken.value.trim() } })
    accessToken.value = ''
    await init()
    toast.add({ title: 'Meta account connected', description: `${accounts.value.length} ad account(s) loaded.`, color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not connect', description: errorMessage(err, 'Check the access token and try again.'), color: 'error' })
  } finally {
    connectingToken.value = false
  }
}

// Facebook login: the Meta login happens on facebook.com and comes back to /meta-ads/callback with ?code&state.
// `state` is a random value kept in this tab's sessionStorage and checked on return (CSRF guard).
async function connectWithFacebook() {
  connecting.value = true
  try {
    const state = crypto.randomUUID()
    sessionStorage.setItem('meta.oauth.state', state)
    const { url } = await api<{ url: string }>('/admin/meta-ads/oauth-url', { query: { redirectUri: redirectUri.value, state } })
    window.location.href = url
  } catch (err) {
    toast.add({ title: 'Meta Ads', description: errorMessage(err, 'Could not start the Meta login.'), color: 'error' })
    connecting.value = false
  }
}

async function saveApp() {
  savingApp.value = true
  try {
    await api<MetaAppCredentialsView>('/admin/meta-ads/app-credentials', { method: 'PUT', body: { appId: appId.value.trim(), ...(appSecret.value.trim() && { appSecret: appSecret.value.trim() }) } })
    appSecret.value = ''
    await init()
    toast.add({ title: 'Meta app saved', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Meta app', description: errorMessage(err, 'Could not save the Meta app.'), color: 'error' })
  } finally {
    savingApp.value = false
  }
}

async function removeApp() {
  if (!window.confirm('Remove the saved Meta app? Connected accounts keep working; "Connect with Facebook" stops until you add an app again.')) return
  try {
    await api('/admin/meta-ads/app-credentials', { method: 'DELETE' })
    appId.value = ''
    appSecret.value = ''
    await init()
  } catch (err) {
    toast.add({ title: 'Meta app', description: errorMessage(err, 'Could not remove the Meta app.'), color: 'error' })
  }
}

async function syncNow() {
  syncing.value = true
  try {
    await sync()
    toast.add({ title: 'Ad accounts updated', description: `${accounts.value.length} account(s) loaded from Meta.`, color: 'success' })
  } catch (err) {
    toast.add({ title: 'Meta Ads', description: errorMessage(err, 'Could not load ad accounts.'), color: 'error' })
    await init()
  } finally {
    syncing.value = false
  }
}

async function disconnect() {
  if (!window.confirm('Disconnect your Meta account? Your ad accounts will no longer be available here.')) return
  disconnecting.value = true
  try {
    await api('/admin/meta-ads/connection', { method: 'DELETE' })
    await init()
    toast.add({ title: 'Meta account disconnected', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Meta Ads', description: errorMessage(err, 'Could not disconnect.'), color: 'error' })
  } finally {
    disconnecting.value = false
  }
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: 'Copied', color: 'success' })
  } catch {
    // Clipboard blocked — the value is selectable in the field.
  }
}

// Exchange rate to DZD per non-DZD ad account (profit needs it: ad spend is in the account currency, orders in DZD).
const rates = reactive<Record<string, number | null>>({})
const savingRateFor = ref<string | null>(null)
watch(accounts, (list) => { for (const a of list) rates[a.accountId] ??= a.exchangeRateToDzd }, { immediate: true })
async function saveRate(accountId: string) {
  savingRateFor.value = accountId
  try {
    await api(`/admin/meta-ads/accounts/${accountId}/exchange-rate`, { method: 'PUT', body: { rate: rates[accountId] || null } })
    await init()
    toast.add({ title: 'Exchange rate saved', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Exchange rate', description: errorMessage(err, 'Could not save the rate.'), color: 'error' })
  } finally {
    savingRateFor.value = null
  }
}

// The URL parameters to paste in each ad (Ads Manager -> ad -> Tracking -> URL parameters) so every order knows its campaign, ad set and ad.
const TRACKING_PARAMS = 'utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}&placement={{placement}}'

const money = (v: number | null, currency: string | null) => formatMoney(v, currency)
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <AdsPage title="Connection & accounts" description="Meta Ads">
    <div v-if="loading && !status" class="empty">Loading…</div>

    <template v-else-if="status">
      <section v-if="status.connection" class="card" aria-labelledby="conn-h">
        <div class="card-head"><h2 id="conn-h">Meta account</h2></div>
        <dl class="details">
          <dt>Facebook user</dt><dd>{{ status.connection.fbUserName ?? status.connection.fbUserId }}</dd>
          <dt>Status</dt>
          <dd><span class="pill" :class="connected ? 'connected' : 'returned'">{{ connected ? 'Connected' : 'Expired — reconnect' }}</span></dd>
          <dt>Linked with</dt><dd>{{ status.connection.method === 'token' ? 'Access token' : 'Facebook login' }}</dd>
          <dt v-if="status.connection.scopes.length">Permissions</dt><dd v-if="status.connection.scopes.length">{{ status.connection.scopes.join(', ') }}</dd>
          <dt>Connected</dt><dd>{{ fmtDateTime(status.connection.connectedAt) }}</dd>
          <dt>Session valid until</dt><dd>{{ status.connection.tokenExpiresAt ? fmtDateTime(status.connection.tokenExpiresAt) : 'No expiry known' }}</dd>
        </dl>
        <p v-if="expired" class="notice warn"><AdsIcon name="i-lucide-alert-triangle" /><span>Meta rejected the saved session. Paste a new access token below (or log in again) to keep seeing your ads.</span></p>
        <div><button class="btn btn-danger" type="button" :disabled="disconnecting" @click="disconnect"><AdsIcon name="i-lucide-unlink" />Disconnect</button></div>
      </section>

      <section v-if="showConnect || showAdvanced" class="card" aria-labelledby="tok-h">
        <div class="card-head"><h2 id="tok-h">{{ status.connection ? 'Replace the connection' : 'Connect with an access token' }}</h2></div>
        <p class="muted" style="line-height: 1.6">Read-only access to your ad accounts, no app setup on this platform. Get a token from Meta in a minute:</p>
        <ol style="line-height: 1.8; padding-inline-start: 20px; margin: 0">
          <li>Open <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener" style="font-weight: 600">Graph API Explorer</a> and pick your Meta app on the right.</li>
          <li>Under <b>Permissions</b> add <code>ads_read</code> (and <code>business_management</code>), then press <b>Generate Access Token</b> and log in.</li>
          <li>Copy the token and paste it below.</li>
        </ol>
        <AdsField label="Access token" help="Stored encrypted; never shown again. A Business Manager System User token (Business settings → System users → Generate token) never expires — best for long-term use.">
          <AdsInput v-model="accessToken" type="password" autocomplete="off" placeholder="EAAG…" style="max-width: 560px" />
        </AdsField>
        <div><button class="btn btn-primary" type="button" :disabled="connectingToken || accessToken.trim().length < 20" @click="connectWithToken"><AdsIcon name="i-lucide-link" />{{ connectingToken ? 'Checking…' : 'Connect' }}</button></div>
      </section>

      <section class="card" aria-labelledby="adv-h">
        <div class="card-head">
          <h2 id="adv-h">Connect with Facebook login <span class="pill neutral" style="margin-left: 4px">Advanced</span></h2>
          <button class="btn btn-sm btn-ghost" type="button" @click="showAdvanced = !showAdvanced">{{ showAdvanced ? 'Hide' : 'Show' }}</button>
        </div>
        <template v-if="showAdvanced">
          <p class="muted" style="line-height: 1.6">Lets each user log in with Facebook instead of pasting a token. Needs a Meta app with Facebook Login; enter its details here (no server settings to edit).</p>

          <template v-if="isSuperAdmin">
            <div class="grid-2">
              <AdsField label="App ID"><AdsInput v-model="appId" inputmode="numeric" placeholder="1234567890123456" /></AdsField>
              <AdsField label="App secret" :help="status.app ? 'Saved — leave blank to keep it.' : undefined"><AdsInput v-model="appSecret" type="password" autocomplete="new-password" :placeholder="status.app ? '•••••••••••••••• (saved)' : ''" /></AdsField>
            </div>
            <AdsField label="Redirect URI" help="Add this exactly to your Meta app: Facebook Login → Settings → Valid OAuth Redirect URIs.">
              <div style="display: flex; gap: 8px; flex-wrap: wrap">
                <AdsInput :model-value="redirectUri" readonly style="flex: 1 1 320px; max-width: 460px" />
                <button class="btn" type="button" @click="copy(redirectUri)"><AdsIcon name="i-lucide-copy" />Copy</button>
              </div>
            </AdsField>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center">
              <button class="btn btn-primary" type="button" :disabled="savingApp || !appId.trim() || (!status.app && !appSecret.trim())" @click="saveApp">{{ savingApp ? 'Checking with Meta…' : 'Save Meta app' }}</button>
              <button v-if="status.app?.source === 'database'" class="btn btn-danger" type="button" @click="removeApp">Remove</button>
              <span v-if="status.app" class="pill connected">{{ status.app.appName ?? status.app.appId }}{{ status.app.source === 'env' ? ' · from server settings' : '' }}</span>
            </div>
          </template>
          <p v-else-if="!status.app" class="muted">A SuperAdmin must add the Meta app first.</p>

          <div v-if="status.app"><button class="btn" type="button" :disabled="connecting" @click="connectWithFacebook"><AdsIcon name="i-lucide-link" />Log in with Facebook</button></div>
        </template>
      </section>

      <section v-if="connected" class="card flush" aria-labelledby="acc-h">
        <div class="card-head">
          <h2 id="acc-h">Ad accounts <span class="pill neutral" style="margin-left: 4px">{{ accounts.length }}</span></h2>
          <button class="btn btn-sm" type="button" :disabled="syncing" @click="syncNow"><AdsIcon name="i-lucide-refresh-cw" />{{ syncing ? 'Loading…' : 'Reload from Meta' }}</button>
        </div>
        <div class="table-wrap">
          <table style="min-width: 760px">
            <thead><tr><th style="padding-left: 20px">Account</th><th>Business</th><th>Status</th><th>Currency</th><th class="num">Total spent</th><th>1 unit in DZD</th><th class="num" style="padding-right: 20px"><span class="sr">Select</span></th></tr></thead>
            <tbody>
              <tr v-if="!accounts.length"><td colspan="7" class="empty">No ad accounts were found for this Facebook account.</td></tr>
              <tr v-for="a in accounts" :key="a.accountId">
                <td style="padding-left: 20px"><span class="strong">{{ a.name }}</span><span class="sub">{{ a.accountId }}</span></td>
                <td>{{ a.businessName ?? '—' }}</td>
                <td><span class="pill" :class="a.accountStatus === 1 ? 'connected' : 'neutral'">{{ a.accountStatusLabel }}</span></td>
                <td>{{ a.currency ?? '—' }}<span class="sub">{{ a.timezoneName ?? '' }}</span></td>
                <td class="num">{{ money(a.amountSpent, a.currency) }}</td>
                <td style="white-space: nowrap">
                  <span v-if="a.currency === 'DZD'" class="muted">1 (DZD account)</span>
                  <span v-else style="display: inline-flex; gap: 6px; align-items: center">
                    <AdsNumberInput v-model="rates[a.accountId]" :min="0" style="width: 96px" :aria-label="`DZD per 1 ${a.currency}`" />
                    <button class="btn btn-sm" type="button" :disabled="savingRateFor === a.accountId || rates[a.accountId] === a.exchangeRateToDzd" @click="saveRate(a.accountId)">Save</button>
                  </span>
                </td>
                <td class="num" style="padding-right: 20px">
                  <span v-if="a.accountId === accountId" class="pill connected">Selected</span>
                  <template v-else><button class="btn btn-sm" type="button" @click="select(a.accountId)">Select</button></template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section id="tracking" class="card" aria-labelledby="trk-h">
        <div class="card-head"><h2 id="trk-h">Link orders to your ads</h2></div>
        <p class="muted" style="line-height: 1.6">Every order records where it came from. For it to name the exact campaign, ad set and ad, add these <b>URL parameters</b> to your ads (Ads Manager → the ad → Tracking → URL parameters). Meta fills the <code v-pre>{{ }}</code> values by itself. Profitability and the confirmation / delivery / return rates per campaign depend on it.</p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-start">
          <AdsInput :model-value="TRACKING_PARAMS" readonly style="flex: 1 1 360px; font-family: monospace; font-size: 12px" />
          <button class="btn" type="button" @click="copy(TRACKING_PARAMS)"><AdsIcon name="i-lucide-copy" />Copy</button>
        </div>
        <p class="hint muted">Without them, orders from Meta still count by platform, and are matched to a campaign only when its name is unique in <code>utm_campaign</code>.</p>
      </section>
      <NuxtLink v-if="connected && accountId" to="/meta-ads/campaigns" class="btn" style="align-self: flex-start">View campaigns<AdsIcon name="i-lucide-arrow-right" /></NuxtLink>
    </template>
  </AdsPage>
</template>
