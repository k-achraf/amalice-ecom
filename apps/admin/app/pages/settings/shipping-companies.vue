<script setup lang="ts">
import type { CourierWebhookLogResponse, CourierWebhookRawLogResponse, ShippingCompanyProvider, ShippingCompanyTariff, ShippingCompanyView } from '@amalice/shared'

// Third-party courier integrations — link an account with its API token,
// sync its per-wilaya tariffs for reference, and optionally apply them into
// the live Shipping Rates table (settings/shipping.vue). Sync never touches
// live rates by itself — see ShippingCompanyTariff's Prisma comment — apply
// is a separate, explicit action so a sync can't silently clobber hand-tuned
// prices.
definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })
useHead({ title: 'Shipping companies' })

const api = useAdminApi()
const toast = useToast()

const { data: companies, pending, refresh } = await useAdminFetch<ShippingCompanyView[]>('/admin/shipping-companies', {
  key: 'admin-shipping-companies'
})

const iconByProvider: Record<ShippingCompanyProvider, string> = {
  Dhd: 'i-lucide-truck',
  SwiftExpress: 'i-lucide-truck',
  Anderson: 'i-lucide-truck',
  Hr48: 'i-lucide-truck'
}

// Per-provider local UI state, keyed by provider — one card can be linking
// while another is syncing without interfering.
const apiTokenInput = reactive<Record<string, string>>({})
const linking = reactive<Record<string, boolean>>({})
const syncing = reactive<Record<string, boolean>>({})
const applying = reactive<Record<string, boolean>>({})
const tariffsByProvider = reactive<Record<string, ShippingCompanyTariff[] | undefined>>({})
const loadingTariffs = reactive<Record<string, boolean>>({})
const webhookSecretInput = reactive<Record<string, string>>({})
const savingWebhookSecret = reactive<Record<string, boolean>>({})
const webhookLogsByProvider = reactive<Record<string, CourierWebhookLogResponse | undefined>>({})
const loadingWebhookLogs = reactive<Record<string, boolean>>({})
const webhookLogPageSize = reactive<Record<string, number>>({})
const webhookLogSearch = reactive<Record<string, string>>({})
// The RAW delivery log (every request, including 401/400/404 rejections —
// see CourierWebhookLog's Prisma comment) — separate state from the
// business log above since it's a distinct table/endpoint with no search.
const webhookRawLogsByProvider = reactive<Record<string, CourierWebhookRawLogResponse | undefined>>({})
const loadingWebhookRawLogs = reactive<Record<string, boolean>>({})
const webhookRawLogPageSize = reactive<Record<string, number>>({})
const expandedRawLogId = ref<string | null>(null)

async function link(provider: ShippingCompanyProvider) {
  const token = apiTokenInput[provider]?.trim()
  if (!token) return
  linking[provider] = true
  try {
    await api(`/admin/shipping-companies/${provider}/link`, { method: 'POST', body: { apiToken: token } })
    apiTokenInput[provider] = ''
    await refresh()
    toast.add({ title: `${provider} linked`, color: 'success' })
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Link failed', description: data?.message ?? 'Check the API token and try again.', color: 'error' })
  } finally {
    linking[provider] = false
  }
}

async function saveWebhookSecret(provider: ShippingCompanyProvider) {
  const secret = webhookSecretInput[provider]?.trim()
  if (!secret) return
  savingWebhookSecret[provider] = true
  try {
    await api(`/admin/shipping-companies/${provider}/webhook-secret`, { method: 'POST', body: { secret } })
    webhookSecretInput[provider] = ''
    await refresh()
    toast.add({ title: 'Webhook secret saved', color: 'success' })
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Failed to save secret', description: data?.message, color: 'error' })
  } finally {
    savingWebhookSecret[provider] = false
  }
}

async function copyWebhookUrl(url: string) {
  await navigator.clipboard.writeText(url)
  toast.add({ title: 'Webhook URL copied', color: 'success' })
}

async function unlink(provider: ShippingCompanyProvider) {
  try {
    await api(`/admin/shipping-companies/${provider}/unlink`, { method: 'POST' })
    tariffsByProvider[provider] = undefined
    await refresh()
    toast.add({ title: `${provider} unlinked`, color: 'success' })
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Unlink failed', description: data?.message, color: 'error' })
  }
}

async function setDefault(provider: ShippingCompanyProvider) {
  try {
    companies.value = await api<ShippingCompanyView[]>(`/admin/shipping-companies/${provider}/default`, { method: 'POST' })
    toast.add({ title: `${provider} set as default`, color: 'success' })
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Failed to set default', description: data?.message, color: 'error' })
  }
}

async function sync(provider: ShippingCompanyProvider) {
  syncing[provider] = true
  try {
    const result = await api<{ syncedCount: number; lastSyncedAt: string }>(`/admin/shipping-companies/${provider}/sync`, { method: 'POST' })
    await refresh()
    await loadTariffs(provider)
    toast.add({ title: `Synced ${result.syncedCount} wilaya tariffs`, color: 'success' })
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Sync failed', description: data?.message, color: 'error' })
  } finally {
    syncing[provider] = false
  }
}

const syncingLocations = reactive<Record<string, boolean>>({})
// The courier's own commune list: exact spellings and stop-desk availability,
// used to check every address before dispatch.
async function syncLocations(provider: ShippingCompanyProvider) {
  syncingLocations[provider] = true
  try {
    const result = await api<{ communesCount: number; wilayasCount: number }>(`/admin/shipping-companies/${provider}/sync-locations`, { method: 'POST' })
    await refresh()
    toast.add({ title: `Synced ${result.communesCount} communes in ${result.wilayasCount} wilayas`, color: 'success' })
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Location sync failed', description: data?.message, color: 'error' })
  } finally {
    syncingLocations[provider] = false
  }
}

async function loadTariffs(provider: ShippingCompanyProvider) {
  loadingTariffs[provider] = true
  try {
    tariffsByProvider[provider] = await api<ShippingCompanyTariff[]>(`/admin/shipping-companies/${provider}/tariffs`)
  } finally {
    loadingTariffs[provider] = false
  }
}

function toggleTariffs(provider: ShippingCompanyProvider) {
  if (tariffsByProvider[provider]) {
    tariffsByProvider[provider] = undefined
  } else {
    loadTariffs(provider)
  }
}

// Admin-facing view of DHD's own "Logs de livraison" page — every inbound
// webhook delivery for this provider, server-side paginated.
async function loadWebhookLogs(provider: ShippingCompanyProvider, page = 1) {
  loadingWebhookLogs[provider] = true
  try {
    webhookLogsByProvider[provider] = await api<CourierWebhookLogResponse>(`/admin/shipping-companies/${provider}/webhook-logs`, {
      query: {
        page,
        pageSize: webhookLogPageSize[provider] ?? 20,
        trackingReference: webhookLogSearch[provider]?.trim() || undefined
      }
    })
  } finally {
    loadingWebhookLogs[provider] = false
  }
}

function toggleWebhookLogs(provider: ShippingCompanyProvider) {
  if (webhookLogsByProvider[provider]) {
    webhookLogsByProvider[provider] = undefined
  } else {
    loadWebhookLogs(provider)
  }
}

function searchWebhookLogs(provider: ShippingCompanyProvider) {
  loadWebhookLogs(provider, 1)
}

// The RAW delivery log — every request unconditionally, including ones
// rejected before the business log above could ever have a row (unknown
// company id, missing/invalid signature, malformed payload). This is what
// actually answers "why is the webhook log always empty" during a run of
// failures.
async function loadWebhookRawLogs(provider: ShippingCompanyProvider, page = 1) {
  loadingWebhookRawLogs[provider] = true
  try {
    webhookRawLogsByProvider[provider] = await api<CourierWebhookRawLogResponse>(`/admin/shipping-companies/${provider}/webhook-raw-logs`, {
      query: { page, pageSize: webhookRawLogPageSize[provider] ?? 20 }
    })
  } finally {
    loadingWebhookRawLogs[provider] = false
  }
}

function toggleWebhookRawLogs(provider: ShippingCompanyProvider) {
  if (webhookRawLogsByProvider[provider]) {
    webhookRawLogsByProvider[provider] = undefined
    expandedRawLogId.value = null
  } else {
    loadWebhookRawLogs(provider)
  }
}

async function applyToRates(provider: ShippingCompanyProvider) {
  applying[provider] = true
  try {
    const result = await api<{ appliedCount: number }>(`/admin/shipping-companies/${provider}/tariffs/apply`, { method: 'POST', body: {} })
    toast.add({
      title: `Applied ${result.appliedCount} wilayas to Shipping Rates`,
      description: 'Review apply — enable/disable and prices are live now.',
      color: 'success'
    })
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Apply failed', description: data?.message, color: 'error' })
  } finally {
    applying[provider] = false
  }
}

// ---- Design cards + settings drawer: the full integration UI (token, webhook, tariffs, logs) lives in the drawer ----
const activeProvider = ref<ShippingCompanyProvider | null>(null)
const active = computed(() => (companies.value ?? []).find((c) => c.provider === activeProvider.value) ?? null)
const activeList = computed(() => (active.value ? [active.value] : []))
const drawerOpen = computed({ get: () => !!activeProvider.value, set: (v) => { if (!v) activeProvider.value = null } })
const lastSync = computed(() => {
  const d = (companies.value ?? []).map((c) => c.lastSyncedAt).filter(Boolean).sort().pop()
  return d ? new Date(d as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Never'
})

</script>

<template>
  <AdsPage title="Shipping companies" :description="`${companies?.length ?? 0} companies · Connect delivery companies and choose who ships what`">
    <template #actions>
      <NuxtLink to="/settings/shipping" class="btn hide-sm"><AdsDesignIcon name="rates" />Shipping rates</NuxtLink>
    </template>

    <div v-if="pending" class="empty">Loading…</div>
    <template v-else>
      <section class="kpis" aria-label="Shipping summary">
        <AdsKpiCard label="Connected" :value="(companies ?? []).filter((c) => c.isLinked).length" color="dark" :meta="`of ${(companies ?? []).length} companies`" />
        <AdsKpiCard label="Default company" :value="(companies ?? []).find((c) => c.isDefault)?.name ?? '—'" meta="Used when nothing else is assigned" />
        <AdsKpiCard label="Last tariff sync" :value="lastSync" meta="Prices are applied to Shipping rates on request" />
      </section>

      <section aria-labelledby="con-h" class="stack">
        <h2 id="con-h" style="font-size: 16px">Companies</h2>
        <div class="cards-grid">
          <article v-for="c in companies" :key="c.provider" class="carrier" :class="{ 'is-default': c.isDefault }">
            <div class="head">
              <span class="app-logo" style="width: 40px; height: 40px" aria-hidden="true"><AdsIcon :name="iconByProvider[c.provider]" /></span>
              <div class="grow"><h3 style="font-size: 15px">{{ c.name }}</h3><span class="muted">{{ c.baseUrl }}</span></div>
              <span v-if="c.isDefault" class="pill solid">Default</span>
              <span v-else-if="c.isLinked" class="pill connected">Connected</span>
              <span v-else class="pill neutral">Not linked</span>
            </div>
            <div class="body">
              <dl class="details" style="font-size: 13px">
                <dt>API token</dt><dd>{{ c.hasApiToken ? 'Saved' : 'Not set' }}</dd>
                <dt>Webhook</dt><dd>{{ c.webhookUrl ? (c.hasWebhookSecret ? 'Configured' : 'Secret missing') : 'Not available' }}</dd>
                <dt>Tariffs</dt><dd>{{ c.lastSyncedAt ? `Synced ${new Date(c.lastSyncedAt).toLocaleDateString()}` : 'Never synced' }}</dd>
                <dt>Communes</dt><dd>{{ c.locationsSyncedAt ? `${c.communesCount} synced` : 'Never synced' }}</dd>
              </dl>
            </div>
            <div class="foot">
              <button class="btn btn-sm" :class="{ 'btn-primary': !c.isLinked }" type="button" @click="activeProvider = c.provider"><AdsIcon :name="c.isLinked ? 'i-lucide-settings' : 'i-lucide-link'" />{{ c.isLinked ? 'Settings' : 'Connect' }}</button>
              <button v-if="c.isLinked && !c.isDefault" class="btn btn-sm btn-ghost" type="button" @click="setDefault(c.provider)">Make default</button>
            </div>
          </article>
        </div>
      </section>
    </template>
  </AdsPage>

  <AdsDrawer v-model:open="drawerOpen" :title="active?.name ?? 'Shipping company'" wide>
    <section v-for="company in activeList" :key="company.provider" class="stack" style="gap: 20px">
      <div class="prod" style="align-items: flex-start">
        <span class="app-logo" style="width: 44px; height: 44px" aria-hidden="true"><AdsIcon :name="iconByProvider[company.provider]" /></span>
        <div class="grow">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
            <h3 style="font-size: 16px">{{ company.name }}</h3>
            <span v-if="company.isLinked" class="pill connected">Linked</span>
            <span v-else class="pill neutral">Not linked</span>
            <span v-if="company.isDefault" class="pill solid">Default</span>
          </div>
          <p class="muted">{{ company.baseUrl }}</p>
          <p v-if="company.lastSyncedAt" class="muted">Tariffs last synced {{ new Date(company.lastSyncedAt).toLocaleString() }}</p>
          <p v-if="company.locationsSyncedAt" class="muted">{{ company.communesCount }} communes synced {{ new Date(company.locationsSyncedAt).toLocaleString() }}</p>
        </div>
      </div>

      <AdsField label="API token" :help="company.hasApiToken ? 'A token is already saved — leave blank to keep it.' : 'From your ' + company.name + ' account settings.'">
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
          <AdsInput
            v-model="apiTokenInput[company.provider]"
            type="password"
            autocomplete="new-password"
            :placeholder="company.hasApiToken ? '•••••••••••••••••••• (configured)' : 'API token'"
            style="flex: 1 1 240px"
          />
          <AdsButton :loading="linking[company.provider]" :disabled="!apiTokenInput[company.provider]?.trim()" @click="link(company.provider)">
            {{ company.isLinked ? 'Update' : 'Link' }}
          </AdsButton>
        </div>
      </AdsField>

      <template v-if="company.webhookUrl">
        <AdsField label="Webhook URL" :help="`Paste this into ${company.name}'s own webhook configuration (state-webhooks settings) as the endpoint URL.`">
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
            <AdsInput :model-value="company.webhookUrl" readonly class="mono" style="flex: 1 1 240px" @focus="($event.target as HTMLInputElement)?.select()" />
            <AdsButton appearance="default" icon="i-lucide-copy" @click="copyWebhookUrl(company.webhookUrl!)">Copy</AdsButton>
          </div>
        </AdsField>

        <AdsField
          label="Webhook secret (HMAC-SHA256)"
          :help="company.hasWebhookSecret ? 'A secret is already saved — leave blank to keep it.' : 'The secret ' + company.name + ' generated (or you set) when configuring the webhook on their side — needed to verify incoming requests.'"
        >
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
            <AdsInput
              v-model="webhookSecretInput[company.provider]"
              type="password"
              autocomplete="new-password"
              :placeholder="company.hasWebhookSecret ? '•••••••••••••••••••• (configured)' : 'Webhook secret'"
              style="flex: 1 1 240px"
            />
            <AdsButton :loading="savingWebhookSecret[company.provider]" :disabled="!webhookSecretInput[company.provider]?.trim()" @click="saveWebhookSecret(company.provider)">
              Save
            </AdsButton>
          </div>
        </AdsField>
      </template>

      <div v-if="company.isLinked" style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
        <AdsButton :loading="syncing[company.provider]" appearance="default" icon="i-lucide-refresh-cw" @click="sync(company.provider)">Sync tariffs</AdsButton>
        <AdsButton :loading="syncingLocations[company.provider]" appearance="default" icon="i-lucide-refresh-cw" @click="syncLocations(company.provider)">Sync communes</AdsButton>
        <AdsButton v-if="company.lastSyncedAt" appearance="default" icon="i-lucide-table" @click="toggleTariffs(company.provider)">
          {{ tariffsByProvider[company.provider] ? 'Hide tariffs' : 'View tariffs' }}
        </AdsButton>
        <AdsButton v-if="!company.isDefault" appearance="default" icon="i-lucide-star" @click="setDefault(company.provider)">Set as default</AdsButton>
        <AdsButton v-if="company.webhookUrl" appearance="default" icon="i-lucide-history" @click="toggleWebhookLogs(company.provider)">
          {{ webhookLogsByProvider[company.provider] ? 'Hide webhook logs' : 'View webhook logs' }}
        </AdsButton>
        <AdsButton v-if="company.webhookUrl" appearance="default" icon="i-lucide-scroll-text" @click="toggleWebhookRawLogs(company.provider)">
          {{ webhookRawLogsByProvider[company.provider] ? 'Hide raw delivery log' : 'View raw delivery log' }}
        </AdsButton>
        <AdsButton appearance="danger" icon="i-lucide-unlink" @click="unlink(company.provider)">Unlink</AdsButton>
      </div>

      <p v-if="loadingTariffs[company.provider]" class="muted">Loading tariffs…</p>
      <div v-else-if="tariffsByProvider[company.provider]" class="stack">
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px">
          <p class="muted">{{ tariffsByProvider[company.provider]!.length }} wilayas synced from {{ company.name }}.</p>
          <AdsButton :loading="applying[company.provider]" size="sm" icon="i-lucide-arrow-right-left" @click="applyToRates(company.provider)">
            Apply all to Shipping Rates
          </AdsButton>
        </div>
        <div class="table-wrap" style="max-height: 320px; overflow-y: auto">
          <table style="min-width: 420px">
            <thead><tr><th>Wilaya</th><th>Home delivery</th><th>Desk delivery</th></tr></thead>
            <tbody>
              <tr v-for="t in tariffsByProvider[company.provider]" :key="t.wilayaId">
                <td class="strong">{{ t.wilayaName }}</td>
                <td><AdsPrice v-if="t.deliveryPriceCents != null" :amount-cents="t.deliveryPriceCents" /><span v-else class="muted">—</span></td>
                <td>
                  <AdsPrice v-if="t.deliveryStopdeskPriceCents" :amount-cents="t.deliveryStopdeskPriceCents" />
                  <span v-else class="muted">Not offered</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p v-if="loadingWebhookLogs[company.provider] && !webhookLogsByProvider[company.provider]" class="muted">Loading webhook logs…</p>
      <div v-else-if="webhookLogsByProvider[company.provider]" class="stack">
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px">
          <p class="muted" style="flex: 1 1 260px">Every inbound webhook delivery from {{ company.name }} — matches their own “Logs de livraison” page.</p>
          <AdsSearch v-model="webhookLogSearch[company.provider]" placeholder="Filter by tracking reference…" label="Filter webhook logs" @keyup.enter="searchWebhookLogs(company.provider)" />
        </div>

        <AdsEmptyState
          v-if="!webhookLogsByProvider[company.provider]!.items.length"
          icon="i-lucide-history"
          title="No webhook deliveries yet"
          :description="`Once ${company.name}'s webhook is configured and an order's state changes, deliveries will show up here.`"
        />
        <template v-else>
          <div class="table-wrap" style="max-height: 384px; overflow-y: auto">
            <table style="min-width: 560px">
              <thead><tr><th>Received</th><th>Tracking</th><th>Event</th><th>Order</th><th>Status</th></tr></thead>
              <tbody>
                <tr v-for="log in webhookLogsByProvider[company.provider]!.items" :key="log.id">
                  <td class="muted" style="white-space: nowrap">{{ new Date(log.receivedAt).toLocaleString() }}</td>
                  <td class="mono">{{ log.trackingReference }}</td>
                  <td>{{ log.stateTitle ?? log.event }}<span class="sub">{{ log.event }}</span></td>
                  <td>
                    <NuxtLink v-if="log.orderId" :to="`/orders/${log.orderId}`" class="link-cell">#{{ log.orderId.slice(0, 8) }}</NuxtLink>
                    <span v-else class="muted">—</span>
                  </td>
                  <td>
                    <span v-if="log.applied" class="pill confirmed">Applied</span>
                    <span v-else-if="log.error" class="pill returned" :title="log.error">Failed</span>
                    <span v-else class="pill neutral">Logged only</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <AdsPagination
            :page="webhookLogsByProvider[company.provider]!.page"
            :total="webhookLogsByProvider[company.provider]!.total"
            :page-size="webhookLogsByProvider[company.provider]!.pageSize"
            item-label="webhook deliveries"
            @update:page="(p) => loadWebhookLogs(company.provider, p)"
            @update:page-size="(size) => { webhookLogPageSize[company.provider] = size; loadWebhookLogs(company.provider, 1) }"
          />
        </template>
      </div>

      <p v-if="loadingWebhookRawLogs[company.provider] && !webhookRawLogsByProvider[company.provider]" class="muted">Loading raw delivery log…</p>
      <div v-else-if="webhookRawLogsByProvider[company.provider]" class="stack">
        <p class="muted">
          Every request that hit this webhook endpoint, unconditionally — including ones rejected before {{ company.name }}'s delivery could ever
          show up in the log above (unknown company id, missing/invalid signature, malformed payload). Use this to see exactly what was received
          when something 401s or 400s.
        </p>

        <AdsEmptyState
          v-if="!webhookRawLogsByProvider[company.provider]!.items.length"
          icon="i-lucide-scroll-text"
          title="No requests recorded yet"
          description="Every request to this webhook URL — successful or not — will show up here."
        />
        <template v-else>
          <div class="table-wrap" style="max-height: 384px; overflow-y: auto">
            <table style="min-width: 560px">
              <thead><tr><th>Received</th><th>Status</th><th>Signature</th><th>Error</th><th><span class="sr">Details</span></th></tr></thead>
              <tbody>
                <template v-for="log in webhookRawLogsByProvider[company.provider]!.items" :key="log.id">
                  <tr>
                    <td class="muted" style="white-space: nowrap">{{ new Date(log.receivedAt).toLocaleString() }}</td>
                    <td><span class="pill" :class="log.statusCode < 300 ? 'confirmed' : 'returned'">{{ log.statusCode }}</span></td>
                    <td>
                      <span v-if="log.signatureValid === null" class="pill new">No header</span>
                      <span v-else-if="log.signatureValid" class="pill confirmed">Valid</span>
                      <span v-else class="pill returned">Invalid</span>
                    </td>
                    <td style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; color: var(--danger-fg)" :title="log.errorMessage ?? ''">{{ log.errorMessage ?? '—' }}</td>
                    <td class="num">
                      <AdsButton appearance="subtle" size="sm" :icon="expandedRawLogId === log.id ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" @click="expandedRawLogId = expandedRawLogId === log.id ? null : log.id">
                        {{ expandedRawLogId === log.id ? 'Hide' : 'View' }}
                      </AdsButton>
                    </td>
                  </tr>
                  <tr v-if="expandedRawLogId === log.id">
                    <td colspan="5" style="background: var(--ivory); white-space: normal">
                      <p class="muted" style="margin-bottom: 4px">Headers</p>
                      <pre class="mono" style="max-height: 192px; overflow: auto; margin: 0 0 12px; padding: 10px; background: var(--white); border: 1px solid var(--line-soft); border-radius: var(--r)">{{ JSON.stringify(log.headers, null, 2) }}</pre>
                      <p class="muted" style="margin-bottom: 4px">Body</p>
                      <pre class="mono" style="max-height: 192px; overflow: auto; margin: 0; padding: 10px; background: var(--white); border: 1px solid var(--line-soft); border-radius: var(--r)">{{ log.rawBody ?? '(empty)' }}</pre>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <AdsPagination
            :page="webhookRawLogsByProvider[company.provider]!.page"
            :total="webhookRawLogsByProvider[company.provider]!.total"
            :page-size="webhookRawLogsByProvider[company.provider]!.pageSize"
            item-label="requests"
            @update:page="(p) => loadWebhookRawLogs(company.provider, p)"
            @update:page-size="(size) => { webhookRawLogPageSize[company.provider] = size; loadWebhookRawLogs(company.provider, 1) }"
          />
        </template>
      </div>
    </section>
  </AdsDrawer>
</template>
