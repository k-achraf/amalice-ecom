<script setup lang="ts">
import type { WilayaShippingRate } from '@amalice/shared'

// Per-wilaya delivery pricing — home delivery and desk (courier office
// pickup) delivery are enabled/priced independently per wilaya (common for
// Algeria couriers: remote wilayas often only offer desk delivery). The
// whole table (58 rows) is edited locally and saved in one bulk PUT, not
// row-by-row network calls — editing 58 rows one save at a time would be
// painful.
useHead({ title: 'Shipping rates' })

const api = useAdminApi()
const toast = useToast()

const { data: rates, pending, refresh } = await useAdminFetch<WilayaShippingRate[]>('/admin/shipping/rates', {
  key: 'admin-shipping-rates'
})

// Local editable copy — Save pushes this back; refresh() re-syncs after.
const rows = ref<WilayaShippingRate[]>([])
watch(rates, (v) => {
  if (v) rows.value = v.map((r) => ({ ...r }))
}, { immediate: true })

// Admins think in plain DZD, not centimes — these two are DZD amounts;
// they're converted to cents only when applied into the *Cents rows below
// (the one internal money convention every *Cents field shares).
const bulkHomePriceDzd = ref<number | null>(null)
const bulkDeskPriceDzd = ref<number | null>(null)

function applyHomeToEnabled() {
  if (bulkHomePriceDzd.value == null) return
  const cents = Math.round(bulkHomePriceDzd.value * 100)
  for (const row of rows.value) {
    if (row.homeDeliveryEnabled) row.homeDeliveryPriceCents = cents
  }
}
function applyDeskToEnabled() {
  if (bulkDeskPriceDzd.value == null) return
  const cents = Math.round(bulkDeskPriceDzd.value * 100)
  for (const row of rows.value) {
    if (row.deskDeliveryEnabled) row.deskDeliveryPriceCents = cents
  }
}

// Enable/disable a delivery type across every wilaya at once — flipping 58
// switches one at a time to open up (or shut down) a whole delivery type is
// impractical. Disabling clears nothing else; a wilaya's price stays put so
// re-enabling later doesn't lose it.
function setAllEnabled(type: 'home' | 'desk', value: boolean) {
  for (const row of rows.value) {
    if (type === 'home') row.homeDeliveryEnabled = value
    else row.deskDeliveryEnabled = value
  }
}

const enabledCount = computed(() => rows.value.filter((r) => r.homeDeliveryEnabled || r.deskDeliveryEnabled).length)

const saving = ref(false)
async function save() {
  // A row toggled on but never given a price would fail the server's
  // validation — catch it here with a clear message instead of a generic
  // 400 from the bulk endpoint.
  const missing = rows.value.find(
    (r) => (r.homeDeliveryEnabled && r.homeDeliveryPriceCents == null) || (r.deskDeliveryEnabled && r.deskDeliveryPriceCents == null)
  )
  if (missing) {
    toast.add({ title: `Set a price for ${missing.wilayaName} before saving`, color: 'warning' })
    return
  }

  saving.value = true
  try {
    await api('/admin/shipping/rates', {
      method: 'PUT',
      body: {
        rates: rows.value.map((r) => ({
          wilayaId: r.wilayaId,
          homeDeliveryEnabled: r.homeDeliveryEnabled,
          homeDeliveryPriceCents: r.homeDeliveryEnabled ? r.homeDeliveryPriceCents : null,
          deskDeliveryEnabled: r.deskDeliveryEnabled,
          deskDeliveryPriceCents: r.deskDeliveryEnabled ? r.deskDeliveryPriceCents : null
        }))
      }
    })
    await refresh()
    toast.add({ title: 'Shipping rates saved', color: 'success' })
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Failed to save', description: data?.message, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Shipping rates">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton :loading="saving" icon="i-lucide-save" @click="save">Save changes</UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="pending" class="py-24 text-center text-muted">Loading…</div>
      <div v-else class="max-w-4xl space-y-6">
        <div class="admin-kpi-card space-y-1 p-6">
          <h2 class="font-medium text-highlighted">Home &amp; desk delivery, per wilaya</h2>
          <p class="text-sm text-muted">
            Each wilaya's home delivery (to the door) and desk delivery (courier office pickup) can be priced and
            enabled independently — leave both off to make a wilaya unavailable for delivery entirely.
            <span class="font-medium text-highlighted">{{ enabledCount }} of {{ rows.length }}</span> wilayas currently have at least one option enabled.
          </p>
        </div>

        <div class="admin-kpi-card space-y-3 p-6">
          <h3 class="text-sm font-medium text-muted">Quick fill</h3>
          <div class="flex flex-wrap items-end gap-3">
            <UFormField label="Home delivery price (DZD)">
              <UInputNumber v-model="bulkHomePriceDzd" :min="0" class="w-40" />
            </UFormField>
            <UButton variant="outline" color="neutral" @click="applyHomeToEnabled">Apply to enabled rows</UButton>
            <UFormField label="Desk delivery price (DZD)">
              <UInputNumber v-model="bulkDeskPriceDzd" :min="0" class="w-40" />
            </UFormField>
            <UButton variant="outline" color="neutral" @click="applyDeskToEnabled">Apply to enabled rows</UButton>
          </div>
          <p class="text-xs text-muted">Toggle a wilaya's delivery type on below first, then use quick fill to price every enabled row at once.</p>
        </div>

        <div class="admin-kpi-card space-y-3 p-6">
          <h3 class="text-sm font-medium text-muted">Bulk enable / disable</h3>
          <div class="flex flex-wrap gap-3">
            <UButton variant="outline" color="neutral" icon="i-lucide-check-check" @click="setAllEnabled('home', true)">Enable home delivery — all wilayas</UButton>
            <UButton variant="outline" color="neutral" icon="i-lucide-x" @click="setAllEnabled('home', false)">Disable home delivery — all wilayas</UButton>
            <UButton variant="outline" color="neutral" icon="i-lucide-check-check" @click="setAllEnabled('desk', true)">Enable desk delivery — all wilayas</UButton>
            <UButton variant="outline" color="neutral" icon="i-lucide-x" @click="setAllEnabled('desk', false)">Disable desk delivery — all wilayas</UButton>
          </div>
        </div>

        <div class="admin-kpi-card overflow-hidden">
          <table class="w-full text-sm">
            <thead class="border-b border-[var(--color-admin-border)] text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th class="px-4 py-3 font-medium">Wilaya</th>
                <th class="px-4 py-3 font-medium">Home delivery</th>
                <th class="px-4 py-3 font-medium">Desk delivery</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--color-admin-border)]">
              <tr v-for="row in rows" :key="row.wilayaId">
                <td class="px-4 py-2.5 font-medium text-highlighted">{{ row.wilayaName }}</td>
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-2">
                    <USwitch v-model="row.homeDeliveryEnabled" />
                    <UInputNumber
                      :model-value="row.homeDeliveryPriceCents == null ? null : row.homeDeliveryPriceCents / 100"
                      :min="0"
                      :disabled="!row.homeDeliveryEnabled"
                      size="sm"
                      class="w-32"
                      placeholder="DZD"
                      @update:model-value="(v) => (row.homeDeliveryPriceCents = v == null ? null : Math.round(Number(v) * 100))"
                    />
                  </div>
                </td>
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-2">
                    <USwitch v-model="row.deskDeliveryEnabled" />
                    <UInputNumber
                      :model-value="row.deskDeliveryPriceCents == null ? null : row.deskDeliveryPriceCents / 100"
                      :min="0"
                      :disabled="!row.deskDeliveryEnabled"
                      size="sm"
                      class="w-32"
                      placeholder="DZD"
                      @update:model-value="(v) => (row.deskDeliveryPriceCents = v == null ? null : Math.round(Number(v) * 100))"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
