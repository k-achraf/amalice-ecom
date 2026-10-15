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

// ---- Design chrome: filters, selection, price check, save bar ----
const zoneFilter = ref('all')
const search = ref('')
const selected = ref<Set<string>>(new Set())
const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  return rows.value.filter((r) => {
    const on = r.homeDeliveryEnabled || r.deskDeliveryEnabled
    return (zoneFilter.value === 'all' || (zoneFilter.value === 'on' ? on : !on)) && (!q || r.wilayaName.toLowerCase().includes(q))
  })
})
function toggleAll(on: boolean) { selected.value = on ? new Set(shown.value.map((r) => r.wilayaId)) : new Set() }
function toggleOne(id: string, on: boolean) {
  const next = new Set(selected.value)
  if (on) next.add(id)
  else next.delete(id)
  selected.value = next
}
function setSelected(on: boolean) {
  for (const r of rows.value) if (selected.value.has(r.wilayaId)) { r.homeDeliveryEnabled = on; r.deskDeliveryEnabled = on }
}
function priceCents(v: string) {
  const n = Number(v.replace(/[^\d.]/g, ''))
  return v.trim() === '' || Number.isNaN(n) ? null : Math.round(n * 100)
}
const previewWilaya = ref<string | undefined>(undefined)
const previewRow = computed(() => rows.value.find((r) => r.wilayaId === (previewWilaya.value ?? rows.value[0]?.wilayaId)) ?? null)
// The save bar appears once the editable copy differs from what the server returned.
const dirty = computed(() => !!rates.value && JSON.stringify(rows.value) !== JSON.stringify(rates.value))
function discard() { if (rates.value) rows.value = rates.value.map((r) => ({ ...r })) }

</script>

<template>
  <AdsPage title="Shipping rates" description="What customers pay for delivery, by wilaya">
    <div v-if="pending" class="empty">Loading…</div>
    <template v-else>
      <section class="kpis" aria-label="Coverage">
        <AdsKpiCard label="Wilayas served" :value="enabledCount" color="dark" :meta="`of ${rows.length} wilayas`" />
        <AdsKpiCard label="Home delivery" :value="rows.filter((r) => r.homeDeliveryEnabled).length" meta="wilayas enabled" />
        <AdsKpiCard label="Stop desk" :value="rows.filter((r) => r.deskDeliveryEnabled).length" meta="wilayas enabled" />
        <AdsKpiCard label="Not served" :value="rows.length - enabledCount" color="warning" meta="Both delivery types off" />
      </section>

      <div class="split">
        <section class="card" aria-label="Rates by wilaya">
          <div class="card-head">
            <AdsTabs v-model="zoneFilter" :items="[{ label: `All ${rows.length}`, value: 'all' }, { label: 'Served', value: 'on' }, { label: 'Not served', value: 'off' }]" />
            <AdsSearch v-model="search" soft placeholder="Wilaya" label="Search wilaya" />
          </div>
          <div class="bulkbar" :class="{ on: selected.size > 0 }">
            <span class="grow">{{ selected.size }} selected</span>
            <button class="btn" type="button" @click="setSelected(true)">Enable</button>
            <button class="btn" type="button" @click="setSelected(false)">Disable</button>
          </div>
          <div class="table-wrap">
            <table style="min-width: 640px">
              <thead>
                <tr>
                  <th style="width: 28px"><input type="checkbox" aria-label="Select all wilayas" :checked="shown.length > 0 && shown.every((r) => selected.has(r.wilayaId))" @change="toggleAll(($event.target as HTMLInputElement).checked)"></th>
                  <th>Wilaya</th><th>Home delivery</th><th>Stop desk</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in shown" :key="row.wilayaId" :style="!row.homeDeliveryEnabled && !row.deskDeliveryEnabled ? 'opacity: .55' : undefined">
                  <td><input type="checkbox" :aria-label="`Select ${row.wilayaName}`" :checked="selected.has(row.wilayaId)" @change="toggleOne(row.wilayaId, ($event.target as HTMLInputElement).checked)"></td>
                  <td class="strong">{{ row.wilayaName }}</td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 10px">
                      <AdsSwitch v-model="row.homeDeliveryEnabled" :aria-label="`Home delivery to ${row.wilayaName}`" />
                      <div class="input-group" style="width: 130px">
                        <input class="input sm" inputmode="numeric" :disabled="!row.homeDeliveryEnabled" :value="row.homeDeliveryPriceCents == null ? '' : row.homeDeliveryPriceCents / 100" :aria-label="`Home delivery price for ${row.wilayaName}`" @input="row.homeDeliveryPriceCents = priceCents(($event.target as HTMLInputElement).value)"><span class="addon">DA</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 10px">
                      <AdsSwitch v-model="row.deskDeliveryEnabled" :aria-label="`Stop desk delivery to ${row.wilayaName}`" />
                      <div class="input-group" style="width: 130px">
                        <input class="input sm" inputmode="numeric" :disabled="!row.deskDeliveryEnabled" :value="row.deskDeliveryPriceCents == null ? '' : row.deskDeliveryPriceCents / 100" :aria-label="`Stop desk price for ${row.wilayaName}`" @input="row.deskDeliveryPriceCents = priceCents(($event.target as HTMLInputElement).value)"><span class="addon">DA</span>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div class="stack">
          <section class="card" aria-labelledby="qf-h">
            <div class="card-head"><h2 id="qf-h">Quick fill</h2></div>
            <p class="card-sub">Toggle a wilaya's delivery type on first, then price every enabled row at once.</p>
            <div class="field"><label class="label">Home delivery price</label><div class="input-group"><AdsNumberInput v-model="bulkHomePriceDzd" :min="0" /><span class="addon">DA</span></div></div>
            <button class="btn" type="button" @click="applyHomeToEnabled">Apply to enabled home rows</button>
            <div class="field"><label class="label">Stop desk price</label><div class="input-group"><AdsNumberInput v-model="bulkDeskPriceDzd" :min="0" /><span class="addon">DA</span></div></div>
            <button class="btn" type="button" @click="applyDeskToEnabled">Apply to enabled desk rows</button>
          </section>

          <section class="card" aria-labelledby="be-h">
            <div class="card-head"><h2 id="be-h">Enable / disable everywhere</h2></div>
            <div class="setting" style="padding-top: 0"><div class="text"><b>Home delivery</b><span>All wilayas</span></div><div style="display: flex; gap: 6px"><button class="btn btn-sm" type="button" @click="setAllEnabled('home', true)">On</button><button class="btn btn-sm" type="button" @click="setAllEnabled('home', false)">Off</button></div></div>
            <div class="setting" style="padding-bottom: 0"><div class="text"><b>Stop desk</b><span>All wilayas</span></div><div style="display: flex; gap: 6px"><button class="btn btn-sm" type="button" @click="setAllEnabled('desk', true)">On</button><button class="btn btn-sm" type="button" @click="setAllEnabled('desk', false)">Off</button></div></div>
          </section>

          <section class="card" aria-labelledby="pv-h">
            <div class="card-head"><h2 id="pv-h">Check a price</h2></div>
            <div class="field"><label class="label">Wilaya</label><AdsSelect v-model="previewWilaya" :options="rows.map((r) => ({ label: r.wilayaName, value: r.wilayaId }))" /></div>
            <div class="totals">
              <template v-if="previewRow">
                <div v-if="!previewRow.homeDeliveryEnabled && !previewRow.deskDeliveryEnabled"><span>Delivery to {{ previewRow.wilayaName }} is turned off.</span></div>
                <template v-else>
                  <div><span>Home delivery</span><b>{{ previewRow.homeDeliveryEnabled && previewRow.homeDeliveryPriceCents != null ? `${previewRow.homeDeliveryPriceCents / 100} DA` : 'Not available' }}</b></div>
                  <div><span>Stop desk</span><b>{{ previewRow.deskDeliveryEnabled && previewRow.deskDeliveryPriceCents != null ? `${previewRow.deskDeliveryPriceCents / 100} DA` : 'Not available' }}</b></div>
                </template>
              </template>
            </div>
          </section>
        </div>
      </div>
    </template>
  </AdsPage>

  <div class="savebar" :class="{ on: dirty }">
    <span>Shipping rates changed</span>
    <button class="btn" type="button" @click="discard">Discard</button>
    <button class="btn btn-brass" type="button" :disabled="saving" @click="save">Save</button>
  </div>
</template>
