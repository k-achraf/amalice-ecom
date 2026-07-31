<script setup lang="ts">
import type { ShippingCompanyProvider, ShippingCompanyTariff, ShippingCompanyView } from '@amalice/shared'

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
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
