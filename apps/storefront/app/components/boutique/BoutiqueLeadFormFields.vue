<script setup lang="ts">
import type { LeadFormField } from '@amalice/shared'

// Boutique's lead-form field renderer — same logic as the shared
// LeadFormFields (rows grouping, wilaya→commune cascade), built on
// Boutique's own primitives instead of @nuxt/ui.
const props = defineProps<{
  fields: LeadFormField[]
  data: Record<string, string>
}>()

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
  <div class="space-y-4">
    <template v-for="(row, ri) in rows" :key="ri">
      <div :class="row.length === 2 ? 'grid grid-cols-2 gap-4' : ''">
        <div v-for="field in row" :key="field.id" class="space-y-1">
          <label class="block text-[11px] uppercase tracking-widest text-muted">{{ field.label }}</label>
          <BoutiqueSelect
            v-if="field.key === 'wilaya'"
            v-model="props.data[field.key]"
            :items="wilayaItems"
            :placeholder="field.placeholder"
          />
          <BoutiqueSelect
            v-else-if="field.key === 'commune'"
            v-model="props.data[field.key]"
            :items="communeItems"
            :disabled="!selectedWilaya"
            :placeholder="selectedWilaya ? field.placeholder : 'Select a wilaya first'"
          />
          <BoutiqueInput
            v-else-if="field.type === 'text' || field.type === 'tel' || field.type === 'email' || field.type === 'number'"
            v-model="props.data[field.key]"
            :type="field.type"
            :placeholder="field.placeholder"
          />
          <BoutiqueSelect
            v-else-if="field.type === 'select'"
            v-model="props.data[field.key]"
            :items="(field.options ?? []).map(o => ({ label: o, value: o }))"
            :placeholder="field.placeholder"
          />
          <BoutiqueTextarea
            v-else-if="field.type === 'textarea'"
            v-model="props.data[field.key]"
            :placeholder="field.placeholder"
            :rows="3"
          />
        </div>
      </div>
    </template>

    <div v-if="selectedWilaya" class="space-y-1.5">
      <label class="block text-[11px] uppercase tracking-widest text-muted">Shipping method</label>
      <div v-if="!selectedWilaya.homeDeliveryEnabled && !selectedWilaya.deskDeliveryEnabled" class="border border-default p-3 text-sm text-muted">
        Delivery isn't currently available to {{ selectedWilaya.name }}.
      </div>
      <div v-else class="space-y-2">
        <button
          v-if="selectedWilaya.homeDeliveryEnabled"
          type="button"
          class="flex w-full items-center justify-between border-2 px-4 py-2.5 text-left text-sm transition-colors"
          :class="props.data.shippingType === 'Home' ? 'border-highlighted bg-highlighted text-inverted' : 'border-default text-highlighted hover:border-muted'"
          @click="selectShipping('Home', selectedWilaya.homeDeliveryPriceCents ?? 0)"
        >
          <span class="flex items-center gap-2 uppercase tracking-wide">
            <Icon name="i-lucide-home" class="size-3.5" />
            Home delivery
          </span>
          <PriceDisplay :amount-cents="selectedWilaya.homeDeliveryPriceCents ?? 0" />
        </button>
        <button
          v-if="selectedWilaya.deskDeliveryEnabled"
          type="button"
          class="flex w-full items-center justify-between border-2 px-4 py-2.5 text-left text-sm transition-colors"
          :class="props.data.shippingType === 'Desk' ? 'border-highlighted bg-highlighted text-inverted' : 'border-default text-highlighted hover:border-muted'"
          @click="selectShipping('Desk', selectedWilaya.deskDeliveryPriceCents ?? 0)"
        >
          <span class="flex items-center gap-2 uppercase tracking-wide">
            <Icon name="i-lucide-building-2" class="size-3.5" />
            Desk delivery
          </span>
          <PriceDisplay :amount-cents="selectedWilaya.deskDeliveryPriceCents ?? 0" />
        </button>
      </div>
    </div>
  </div>
</template>
