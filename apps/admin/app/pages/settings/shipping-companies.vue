<script setup lang="ts">
import type { CourierWebhookLogResponse, ShippingCompanyProvider, ShippingCompanyTariff, ShippingCompanyView } from '@amalice/shared'

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
  Dhd: 'i-lucide-truck'
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
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Shipping companies">
        <template #leading><UDashboardSidebarCollapse /></template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="pending" class="py-24 text-center text-muted">Loading…</div>
      <div v-else class="max-w-3xl space-y-6">
        <div>
          <h2 class="text-lg font-semibold text-highlighted">Courier integrations</h2>
          <p class="text-sm text-muted">
            Link a courier's API to pull its own per-wilaya delivery tariffs for reference, and apply them into
            <NuxtLink to="/settings/shipping" class="text-primary underline">Shipping Rates</NuxtLink> with one click.
          </p>
        </div>

        <section v-for="company in companies" :key="company.provider" class="admin-kpi-card space-y-5 p-6">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-4">
              <div class="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UIcon :name="iconByProvider[company.provider]" class="size-6" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-highlighted">{{ company.name }}</h3>
                  <UBadge v-if="company.isLinked" color="success" variant="subtle" size="sm">Linked</UBadge>
                  <UBadge v-else color="neutral" variant="subtle" size="sm">Not linked</UBadge>
                  <UBadge v-if="company.isDefault" color="primary" variant="subtle" size="sm">Default</UBadge>
                </div>
                <p class="mt-1 text-xs text-muted">{{ company.baseUrl }}</p>
                <p v-if="company.lastSyncedAt" class="mt-1 text-xs text-muted">Tariffs last synced {{ new Date(company.lastSyncedAt).toLocaleString() }}</p>
              </div>
            </div>
          </div>

          <UFormField label="API token" :help="company.hasApiToken ? 'A token is already saved — leave blank to keep it.' : 'From your ' + company.name + ' account settings.'">
            <div class="flex items-center gap-2">
              <UInput
                v-model="apiTokenInput[company.provider]"
                type="password"
                autocomplete="new-password"
                :placeholder="company.hasApiToken ? '•••••••••••••••••••• (configured)' : 'API token'"
                class="w-full max-w-sm"
              />
              <UButton :loading="linking[company.provider]" :disabled="!apiTokenInput[company.provider]?.trim()" color="primary" @click="link(company.provider)">
                {{ company.isLinked ? 'Update' : 'Link' }}
              </UButton>
            </div>
          </UFormField>

          <template v-if="company.webhookUrl">
            <UFormField label="Webhook URL" help="Paste this into DHD's own webhook configuration (state-webhooks settings) as the endpoint URL.">
              <div class="flex items-center gap-2">
                <UInput :model-value="company.webhookUrl" readonly class="w-full max-w-lg font-mono text-xs" @focus="($event.target as HTMLInputElement)?.select()" />
                <UButton variant="outline" color="neutral" icon="i-lucide-copy" @click="copyWebhookUrl(company.webhookUrl!)">Copy</UButton>
              </div>
            </UFormField>

            <UFormField
              label="Webhook secret (HMAC-SHA256)"
              :help="company.hasWebhookSecret ? 'A secret is already saved — leave blank to keep it.' : 'The secret DHD generated (or you set) when configuring the webhook on their side — needed to verify incoming requests.'"
            >
              <div class="flex items-center gap-2">
                <UInput
                  v-model="webhookSecretInput[company.provider]"
                  type="password"
                  autocomplete="new-password"
                  :placeholder="company.hasWebhookSecret ? '•••••••••••••••••••• (configured)' : 'Webhook secret'"
                  class="w-full max-w-sm"
                />
                <UButton :loading="savingWebhookSecret[company.provider]" :disabled="!webhookSecretInput[company.provider]?.trim()" color="primary" @click="saveWebhookSecret(company.provider)">
                  Save
                </UButton>
              </div>
            </UFormField>
          </template>

          <div v-if="company.isLinked" class="flex flex-wrap items-center gap-3">
            <UButton :loading="syncing[company.provider]" variant="soft" icon="i-lucide-refresh-cw" @click="sync(company.provider)">Sync tariffs</UButton>
            <UButton
              v-if="company.lastSyncedAt"
              variant="outline"
              color="neutral"
              icon="i-lucide-table"
              @click="toggleTariffs(company.provider)"
            >
              {{ tariffsByProvider[company.provider] ? 'Hide tariffs' : 'View tariffs' }}
            </UButton>
            <UButton v-if="!company.isDefault" variant="outline" color="neutral" icon="i-lucide-star" @click="setDefault(company.provider)">Set as default</UButton>
            <UButton v-if="company.webhookUrl" variant="outline" color="neutral" icon="i-lucide-history" @click="toggleWebhookLogs(company.provider)">
              {{ webhookLogsByProvider[company.provider] ? 'Hide webhook logs' : 'View webhook logs' }}
            </UButton>
            <UButton variant="ghost" color="error" icon="i-lucide-unlink" @click="unlink(company.provider)">Unlink</UButton>
          </div>

          <div v-if="loadingTariffs[company.provider]" class="text-sm text-muted">Loading tariffs…</div>
          <div v-else-if="tariffsByProvider[company.provider]" class="space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-sm text-muted">{{ tariffsByProvider[company.provider]!.length }} wilayas synced from {{ company.name }}.</p>
              <UButton :loading="applying[company.provider]" size="sm" color="primary" icon="i-lucide-arrow-right-left" @click="applyToRates(company.provider)">
                Apply all to Shipping Rates
              </UButton>
            </div>
            <div class="max-h-80 overflow-y-auto rounded-md border border-[var(--color-admin-border)]">
              <table class="w-full text-sm">
                <thead class="sticky top-0 border-b border-[var(--color-admin-border)] bg-[var(--color-admin-surface)] text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th class="px-3 py-2 font-medium">Wilaya</th>
                    <th class="px-3 py-2 font-medium">Home delivery</th>
                    <th class="px-3 py-2 font-medium">Desk delivery</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[var(--color-admin-border)]">
                  <tr v-for="t in tariffsByProvider[company.provider]" :key="t.wilayaId">
                    <td class="px-3 py-2 text-highlighted">{{ t.wilayaName }}</td>
                    <td class="px-3 py-2"><PriceDisplay v-if="t.deliveryPriceCents != null" :amount-cents="t.deliveryPriceCents" /><span v-else class="text-muted">—</span></td>
                    <td class="px-3 py-2">
                      <PriceDisplay v-if="t.deliveryStopdeskPriceCents" :amount-cents="t.deliveryStopdeskPriceCents" />
                      <span v-else class="text-muted">Not offered</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="loadingWebhookLogs[company.provider] && !webhookLogsByProvider[company.provider]" class="text-sm text-muted">Loading webhook logs…</div>
          <div v-else-if="webhookLogsByProvider[company.provider]" class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm text-muted">Every inbound webhook delivery from {{ company.name }} — matches their own "Logs de livraison" page.</p>
              <div class="flex items-center gap-2">
                <UInput
                  v-model="webhookLogSearch[company.provider]"
                  icon="i-lucide-search"
                  placeholder="Filter by tracking reference…"
                  size="sm"
                  class="w-56"
                  @keyup.enter="searchWebhookLogs(company.provider)"
                />
                <UButton size="sm" variant="outline" color="neutral" :loading="loadingWebhookLogs[company.provider]" @click="searchWebhookLogs(company.provider)">Search</UButton>
              </div>
            </div>

            <EmptyState
              v-if="!webhookLogsByProvider[company.provider]!.items.length"
              icon="i-lucide-history"
              title="No webhook deliveries yet"
              description="Once DHD's webhook is configured and an order's state changes, deliveries will show up here."
            />
            <template v-else>
              <div class="max-h-96 overflow-y-auto rounded-md border border-[var(--color-admin-border)]">
                <table class="w-full text-sm">
                  <thead class="sticky top-0 border-b border-[var(--color-admin-border)] bg-[var(--color-admin-surface)] text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th class="px-3 py-2 font-medium">Received</th>
                      <th class="px-3 py-2 font-medium">Tracking</th>
                      <th class="px-3 py-2 font-medium">Event</th>
                      <th class="px-3 py-2 font-medium">Order</th>
                      <th class="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[var(--color-admin-border)]">
                    <tr v-for="log in webhookLogsByProvider[company.provider]!.items" :key="log.id">
                      <td class="px-3 py-2 whitespace-nowrap text-muted">{{ new Date(log.receivedAt).toLocaleString() }}</td>
                      <td class="px-3 py-2 tabular">{{ log.trackingReference }}</td>
                      <td class="px-3 py-2">
                        <div class="text-highlighted">{{ log.stateTitle ?? log.event }}</div>
                        <div class="text-xs text-muted">{{ log.event }}</div>
                      </td>
                      <td class="px-3 py-2">
                        <NuxtLink v-if="log.orderId" :to="`/orders/${log.orderId}`" class="tabular text-primary hover:underline">{{ log.orderId.slice(0, 8) }}</NuxtLink>
                        <span v-else class="text-muted">—</span>
                      </td>
                      <td class="px-3 py-2">
                        <UBadge v-if="log.applied" color="success" variant="subtle" size="sm">Applied</UBadge>
                        <UBadge v-else-if="log.error" color="error" variant="subtle" size="sm" :title="log.error">Failed</UBadge>
                        <UBadge v-else color="neutral" variant="subtle" size="sm">Logged only</UBadge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <AdminPagination
                :page="webhookLogsByProvider[company.provider]!.page"
                :total="webhookLogsByProvider[company.provider]!.total"
                :page-size="webhookLogsByProvider[company.provider]!.pageSize"
                item-label="webhook deliveries"
                @update:page="(p) => loadWebhookLogs(company.provider, p)"
                @update:page-size="(size) => { webhookLogPageSize[company.provider] = size; loadWebhookLogs(company.provider, 1) }"
              />
            </template>
          </div>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
