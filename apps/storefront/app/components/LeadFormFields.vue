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
</script>

<template>
  <div class="space-y-3">
    <template v-for="(row, ri) in rows" :key="ri">
      <div :class="row.length === 2 ? 'grid grid-cols-2 gap-3' : ''">
        <div v-for="field in row" :key="field.id" class="space-y-1">
          <label class="block text-sm font-medium text-highlighted">{{ field.label }}</label>
          <Select
            v-if="field.key === 'wilaya'"
            v-model="props.data[field.key]"
            :items="wilayaItems"
            :placeholder="field.placeholder"
          />
          <Select
            v-else-if="field.key === 'commune'"
            v-model="props.data[field.key]"
            :items="communeItems"
            :disabled="!selectedWilaya"
            :placeholder="selectedWilaya ? field.placeholder : 'Select a wilaya first'"
          />
          <Input
            v-else-if="field.type === 'text' || field.type === 'tel' || field.type === 'email' || field.type === 'number'"
            v-model="props.data[field.key]"
            :type="field.type"
            :placeholder="field.placeholder"
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
  </div>
</template>
