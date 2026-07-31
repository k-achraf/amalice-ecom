<script setup lang="ts">
// Cart+checkout flow's wilaya/commune/shipping picker — mirrors
// LeadFormFields.vue's cascade logic (GET /wilayas + GET /communes?wilayaId=)
// but mutates the checkout page's typed `form` object directly instead of a
// generic Record<string,string>, since checkout.vue's form isn't admin-
// configurable like the lead form is.
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
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-1">
        <label class="block text-sm font-medium text-highlighted">الولاية</label>
        <Select :model-value="props.form.wilayaId" :items="wilayaItems" placeholder="اختر الولاية" @update:model-value="(v) => (props.form.wilayaId = v)" />
      </div>
      <div class="space-y-1">
        <label class="block text-sm font-medium text-highlighted">البلدية</label>
        <Select v-model="selectedCommuneId" :items="communeItems" :disabled="!selectedWilaya" :placeholder="selectedWilaya ? 'اختر البلدية' : 'اختر الولاية أولاً'" />
      </div>
    </div>

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
          :class="props.form.shippingType === 'Home' ? 'border-primary bg-primary/5' : 'border-default hover:border-primary/50'"
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
          :class="props.form.shippingType === 'Desk' ? 'border-primary bg-primary/5' : 'border-default hover:border-primary/50'"
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
