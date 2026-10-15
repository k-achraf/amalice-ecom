<script setup lang="ts">
import type { AddressCheckResult, AdminOrderDetail } from '@amalice/shared'
import { toast } from 'vue-sonner'

// What the courier needs besides the address: remark/instructions, fragile,
// GPS link and operation type — plus the pre-dispatch address check against the
// courier's own commune list (a misspelled commune is rejected at creation).
// Editable until the courier has confirmed the parcel.
const props = defineProps<{ order: AdminOrderDetail }>()
const emit = defineEmits<{ changed: [] }>()

const api = useAdminApi()
const { run } = useApiAction()

const locked = computed(() => !!props.order.shipment?.carrierConfirmedAt)
const note = ref('')
const fragile = ref(false)
const gps = ref('')
const operation = ref<'Delivery' | 'Exchange'>('Delivery')
const exchangeProduct = ref('')
const saving = ref(false)
const check = ref<AddressCheckResult | null>(null)

function sync() {
  const o = props.order
  note.value = o.deliveryNote ?? ''
  fragile.value = o.isFragile
  gps.value = o.gpsLink ?? ''
  operation.value = o.courierOperation
  exchangeProduct.value = o.exchangeProduct ?? ''
}
watch(() => props.order, sync, { immediate: true })

async function loadCheck() {
  check.value = await api<AddressCheckResult>(`/admin/fulfillment/orders/${props.order.id}/address-check`).catch(() => null)
}
watch(() => [props.order.id, props.order.address.city, props.order.address.region, props.order.shippingType, props.order.shippingCompanyId], loadCheck, { immediate: true })

async function save() {
  saving.value = true
  const res = await run(() => api(`/admin/fulfillment/orders/${props.order.id}/delivery-info`, {
    method: 'PATCH',
    body: {
      deliveryNote: note.value.trim() || null,
      isFragile: fragile.value,
      gpsLink: gps.value.trim() || null,
      courierOperation: operation.value,
      exchangeProduct: operation.value === 'Exchange' ? exchangeProduct.value.trim() || null : null
    }
  }), { success: 'Delivery details saved', errorFallback: 'Could not save the delivery details' })
  saving.value = false
  if (res !== undefined) emit('changed')
}

async function useCommune(name: string) {
  const res = await run(() => api(`/admin/orders/${props.order.id}/customer-info`, { method: 'PATCH', body: { commune: name } }), {
    success: `Commune set to ${name}`,
    errorFallback: 'Could not update the commune'
  })
  if (res !== undefined) { emit('changed'); await loadCheck() }
}

async function switchToHome() {
  const res = await run(() => api(`/admin/orders/${props.order.id}/customer-info`, { method: 'PATCH', body: { shippingType: 'Home' } }), {
    success: 'Switched to home delivery',
    errorFallback: 'Could not change the delivery type'
  })
  if (res !== undefined) { emit('changed'); toast.info('The delivery fee may need adjusting.'); await loadCheck() }
}
</script>

<template>
  <section class="card" aria-labelledby="dd-h">
    <div class="card-head"><h2 id="dd-h">Courier details</h2></div>

    <!-- Address check against the courier's own commune list -->
    <div v-if="check && check.checked && !check.ok" class="notice danger">
      <AdsIcon name="i-lucide-alert-triangle" />
      <span>
        <template v-for="(issue, i) in check.issues" :key="i">{{ issue }} </template>
        <span v-if="check.suggestions.length" style="display: block; margin-top: 6px">
          Did you mean:
          <button v-for="s in check.suggestions" :key="s" class="btn btn-sm" type="button" style="margin: 2px 4px 2px 0" :disabled="locked" @click="useCommune(s)">{{ s }}</button>
        </span>
        <button v-if="check.stopDeskAvailable === false && order.shippingType === 'Desk'" class="btn btn-sm" type="button" style="margin-top: 6px" @click="switchToHome">Switch to home delivery</button>
      </span>
    </div>
    <div v-else-if="check && check.checked && check.ok" class="notice">
      <AdsIcon name="i-lucide-check" />
      <span>Address accepted by {{ check.shippingCompanyName }}<template v-if="check.matchedCommune && check.matchedCommune !== order.address.city"> — will be sent as “{{ check.matchedCommune }}”</template>.</span>
    </div>
    <div v-else-if="check && check.issues.length" class="muted" style="font-size: 12px">{{ check.issues[0] }}</div>

    <div v-if="locked" class="muted" style="font-size: 13px">The courier already has this parcel, so these details are locked. Use “Note for the courier” instead.</div>
    <template v-else>
      <AdsField label="Remark for the courier" help="Delivery instructions the driver sees (max 255 characters)."><AdsInput v-model="note" maxlength="255" placeholder="e.g. Call before arriving, 2nd floor" /></AdsField>
      <div class="grid-2">
        <AdsField label="Customer location (GPS link)"><AdsInput v-model="gps" placeholder="https://maps.google.com/…" /></AdsField>
        <AdsField label="Operation">
          <AdsSelect v-model="operation" :options="[{ label: 'Delivery', value: 'Delivery' }, { label: 'Exchange (collect a product back)', value: 'Exchange' }]" />
        </AdsField>
      </div>
      <AdsField v-if="operation === 'Exchange'" label="Product to collect"><AdsInput v-model="exchangeProduct" placeholder="Product the driver takes back" /></AdsField>
      <label class="check"><input v-model="fragile" type="checkbox">Fragile parcel</label>
      <button class="btn" type="button" style="align-self: flex-start" :disabled="saving" @click="save"><AdsIcon name="i-lucide-check" />Save details</button>
    </template>
  </section>
</template>
