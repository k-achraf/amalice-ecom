<script setup lang="ts">
import type { LeadFormField } from '@amalice/shared'

// Dynamic lead-form field renderer — iterates over the admin-configured field
// list and renders the right input per type (text/tel/email/number/select/
// textarea). All 4 PDP template components use this inside their own wrapper
// card, so field markup isn't duplicated 4×.
//
// wilaya/commune are special-cased ahead of the generic type dispatch: they
// render as cascading selects backed by GET /wilayas + GET /communes?wilayaId=
// (real Algeria data, see useLocations) rather than admin-typed `options`.
// Picking a wilaya loads its communes; changing the wilaya clears whatever
// commune was previously selected if it no longer belongs to the new list.
//
// A shipping-method picker (home/desk delivery, priced per wilaya — see
// WilayaShippingRate) renders right after the wilaya/commune fields once a
// wilaya is selected. Like commune, it's written into `data` by KEY
// (wilayaId/shippingType/shippingPriceCents) rather than emitted, matching
// how every other field here mutates the shared `data` object directly —
// the parent page reads data.wilayaId/shippingType/shippingPriceCents at
// submit time. Never trusted as the real price server-side (the API
// re-prices from WilayaShippingRate); this is only what the customer sees
// and what the order total display uses before it's placed.
//
// Pairs halfWidth fields into 2-col grids automatically.
const props = defineProps<{
  fields: LeadFormField[]
  data: Record<string, string>
}>()

// Group consecutive halfWidth fields into pairs for 2-col grid layout.
const rows = computed(() => {
  const result: LeadFormField[][] = []
  let currentRow: LeadFormField[] = []
  for (const field of props.fields) {
    if (field.halfWidth) {
      currentRow.push(field)
      if (currentRow.length === 2) {
        result.push(currentRow)
        currentRow = []
      }
    } else {
      if (currentRow.length > 0) {
        result.push(currentRow)
        currentRow = []
      }
      result.push([field])
    }
  }
  if (currentRow.length > 0) result.push(currentRow)
  return result
})

const { data: wilayas } = await useWilayas()
const wilayaItems = computed(() => (wilayas.value ?? []).map((w) => ({ label: w.name, value: w.name })))
const selectedWilaya = computed(() => (wilayas.value ?? []).find((w) => w.name === props.data.wilaya))

const fetchCommunes = useCommuneFetcher()
const communes = ref<{ id: string; name: string }[]>([])
const communeItems = computed(() => communes.value.map((c) => ({ label: c.name, value: c.name })))

watch(selectedWilaya, async (wilaya, previous) => {
  if (wilaya?.id === previous?.id) return
  // A wilaya change invalidates whatever shipping method was picked for the
  // old one — prices differ per wilaya, so this can't just carry over.
  props.data.wilayaId = wilaya?.id ?? ''
  props.data.shippingType = ''
  props.data.shippingPriceCents = ''
  if (!wilaya) {
    communes.value = []
    props.data.commune = ''
    return
  }
  communes.value = await fetchCommunes(wilaya.id)
  if (props.data.commune && !communes.value.some((c) => c.name === props.data.commune)) {
    props.data.commune = ''
  }
}, { immediate: true })

function selectShipping(type: 'Home' | 'Desk', priceCents: number) {
  props.data.shippingType = type
  props.data.shippingPriceCents = String(priceCents)
}
</script>

<template>
  <div class="space-y-3">
    <template v-for="(row, ri) in rows" :key="ri">
      <div :class="row.length === 2 ? 'grid grid-cols-2 gap-3' : ''">
        <div v-for="field in row" :key="field.id" class="space-y-1">
          <label class="block text-sm font-medium text-highlighted">{{ leadFieldLabel(field) }}</label>
          <Select
            v-if="field.key === 'wilaya'"
            v-model="props.data[field.key]"
            :items="wilayaItems"
            :placeholder="leadFieldPlaceholder(field)"
          />
          <Select
            v-else-if="field.key === 'commune'"
            v-model="props.data[field.key]"
            :items="communeItems"
            :disabled="!selectedWilaya"
            :placeholder="selectedWilaya ? leadFieldPlaceholder(field) : 'اختر الولاية أولاً'"
          />
          <Input
            v-else-if="field.type === 'text' || field.type === 'tel' || field.type === 'email' || field.type === 'number'"
            v-model="props.data[field.key]"
            :type="field.type"
            :placeholder="leadFieldPlaceholder(field)"
          />
          <Select
            v-else-if="field.type === 'select'"
            v-model="props.data[field.key]"
            :items="(field.options ?? []).map(o => ({ label: o, value: o }))"
            :placeholder="field.placeholder"
          />
          <Textarea
            v-else-if="field.type === 'textarea'"
            v-model="props.data[field.key]"
            :placeholder="field.placeholder"
            :rows="3"
          />
        </div>
      </div>
    </template>

    <!-- Shipping method — appears once a wilaya is selected; priced per
    wilaya, home and desk delivery independently available (see
    WilayaShippingRate). -->
    <div v-if="selectedWilaya" class="space-y-1.5">
      <label class="block text-sm font-medium text-highlighted">طريقة التوصيل</label>
      <div v-if="!selectedWilaya.homeDeliveryEnabled && !selectedWilaya.deskDeliveryEnabled" class="rounded-md border border-default bg-elevated p-3 text-sm text-muted">
        التوصيل غير متوفر حالياً إلى {{ selectedWilaya.name }}.
      </div>
      <div v-else class="space-y-2">
        <button
          v-if="selectedWilaya.homeDeliveryEnabled"
          type="button"
          class="flex w-full items-center justify-between rounded-md border-2 px-3 py-2.5 text-left text-sm transition-colors"
          :class="props.data.shippingType === 'Home' ? 'border-primary bg-primary/5' : 'border-default hover:border-primary/50'"
          @click="selectShipping('Home', selectedWilaya.homeDeliveryPriceCents ?? 0)"
        >
          <span class="flex items-center gap-2 font-medium">
            <Icon name="i-lucide-home" class="size-4" />
            التوصيل إلى المنزل
          </span>
          <PriceDisplay :amount-cents="selectedWilaya.homeDeliveryPriceCents ?? 0" class="font-medium" />
        </button>
        <button
          v-if="selectedWilaya.deskDeliveryEnabled"
          type="button"
          class="flex w-full items-center justify-between rounded-md border-2 px-3 py-2.5 text-left text-sm transition-colors"
          :class="props.data.shippingType === 'Desk' ? 'border-primary bg-primary/5' : 'border-default hover:border-primary/50'"
          @click="selectShipping('Desk', selectedWilaya.deskDeliveryPriceCents ?? 0)"
        >
          <span class="flex items-center gap-2 font-medium">
            <Icon name="i-lucide-building-2" class="size-4" />
            الاستلام من مكتب التوصيل
          </span>
          <PriceDisplay :amount-cents="selectedWilaya.deskDeliveryPriceCents ?? 0" class="font-medium" />
        </button>
      </div>
    </div>
  </div>
</template>
