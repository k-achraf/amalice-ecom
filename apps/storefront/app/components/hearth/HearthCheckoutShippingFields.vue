<script setup lang="ts">
// Hearth's cart+checkout flow wilaya/commune/shipping picker — same cascade
// logic as the shared CheckoutShippingFields.vue (GET /wilayas + GET
// /communes?wilayaId=), but built on Hearth's own primitives (HearthSelect)
// instead of @nuxt/ui, since Hearth renders zero @nuxt/ui components
// anywhere.
//
// Writes wilayaId/shippingType/shippingPriceCents plus address.region (wilaya
// name), address.city (commune name), and address.postalCode (commune post
// code) directly onto `form` — address.city/region stay in sync for display
// and backward-compatible storage, but wilayaId is what the server actually
// prices from (see priceShipping in orders.service.ts). Never trusted as the
// real price server-side.
const props = defineProps<{
  form: {
    wilayaId: string
    shippingType: string
    shippingPriceCents: number
    address: { city: string; region: string; postalCode: string; country: string }
  }
}>()

const { data: wilayas } = await useWilayas()
const wilayaItems = computed(() => (wilayas.value ?? []).map((w) => ({ label: w.name, value: w.id })))
const selectedWilaya = computed(() => (wilayas.value ?? []).find((w) => w.id === props.form.wilayaId))

const fetchCommunes = useCommuneFetcher()
const communes = ref<{ id: string; name: string; postCode: string }[]>([])
const selectedCommuneId = ref('')
const communeItems = computed(() => communes.value.map((c) => ({ label: c.name, value: c.id })))

watch(
  () => props.form.wilayaId,
  async (id, previous) => {
    if (id === previous) return
    props.form.address.region = selectedWilaya.value?.name ?? ''
    props.form.shippingType = ''
    props.form.shippingPriceCents = 0
    selectedCommuneId.value = ''
    props.form.address.city = ''
    props.form.address.postalCode = ''
    props.form.address.country = 'DZ'
    if (!id) {
      communes.value = []
      return
    }
    communes.value = await fetchCommunes(id)
  },
  { immediate: true }
)

watch(selectedCommuneId, (id) => {
  const commune = communes.value.find((c) => c.id === id)
  props.form.address.city = commune?.name ?? ''
  props.form.address.postalCode = commune?.postCode ?? ''
})

function selectShipping(type: 'Home' | 'Desk', priceCents: number) {
  props.form.shippingType = type
  props.form.shippingPriceCents = priceCents
}
</script>

<template>
  <div class="space-y-5">
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">Wilaya</label>
        <HearthSelect :model-value="props.form.wilayaId" :items="wilayaItems" placeholder="Select wilaya" @update:model-value="(v) => (props.form.wilayaId = v)" />
      </div>
      <div>
        <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">Commune</label>
        <HearthSelect v-model="selectedCommuneId" :items="communeItems" :disabled="!selectedWilaya" :placeholder="selectedWilaya ? 'Select commune' : 'Select a wilaya first'" />
      </div>
    </div>

    <div v-if="selectedWilaya" class="space-y-1.5">
      <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">Shipping method</label>
      <div v-if="!selectedWilaya.homeDeliveryEnabled && !selectedWilaya.deskDeliveryEnabled" class="border border-neutral-200 p-3 text-sm text-neutral-500">
        Delivery isn't currently available to {{ selectedWilaya.name }}.
      </div>
      <div v-else class="space-y-2">
        <button
          v-if="selectedWilaya.homeDeliveryEnabled"
          type="button"
          class="flex w-full items-center justify-between border-2 px-4 py-2.5 text-left text-sm transition-colors"
          :class="props.form.shippingType === 'Home' ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-900 hover:border-neutral-400'"
          @click="selectShipping('Home', selectedWilaya.homeDeliveryPriceCents ?? 0)"
        >
          <span class="flex items-center gap-2"><Icon name="i-lucide-home" class="size-4" /> Home delivery</span>
          <PriceDisplay :amount-cents="selectedWilaya.homeDeliveryPriceCents ?? 0" />
        </button>
        <button
          v-if="selectedWilaya.deskDeliveryEnabled"
          type="button"
          class="flex w-full items-center justify-between border-2 px-4 py-2.5 text-left text-sm transition-colors"
          :class="props.form.shippingType === 'Desk' ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 text-neutral-900 hover:border-neutral-400'"
          @click="selectShipping('Desk', selectedWilaya.deskDeliveryPriceCents ?? 0)"
        >
          <span class="flex items-center gap-2"><Icon name="i-lucide-building-2" class="size-4" /> Desk delivery</span>
          <PriceDisplay :amount-cents="selectedWilaya.deskDeliveryPriceCents ?? 0" />
        </button>
      </div>
    </div>
  </div>
</template>
