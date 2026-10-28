<script setup lang="ts">
import type { CourierCommuneOption, OrderCourierLocation } from '@amalice/shared'

// "Convert location": maps the customer's wilaya/commune to the courier's own list for ONE
// order. Pre-fills a proposal but never applies anything: the agent must press Save.
const props = defineProps<{ orderId: string; open: boolean }>()
const emit = defineEmits<{ saved: []; close: []; 'update:open': [value: boolean] }>()

const locApi = useCourierLocationApi()
const { run } = useApiAction()

const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => {
    emit('update:open', v)
    if (!v) emit('close')
  }
})

const loc = ref<OrderCourierLocation | null>(null)
const loading = ref(false)
const loadError = ref('')
const communes = ref<CourierCommuneOption[]>([])
const loadingCommunes = ref(false)
const wilayaId = ref('')
const commune = ref<string | null>(null)
const search = ref('')
const saving = ref(false)

const SOURCE_LABELS: Record<string, string> = {
  order: 'Saved on this order',
  map: 'From saved mapping',
  auto: 'Automatic near match — please check',
  default: 'Default wilaya',
  none: 'None'
}
const sourceLabel = computed(() => SOURCE_LABELS[loc.value?.proposal.source ?? 'none'] ?? 'None')

async function loadCommunes(keep: string | null) {
  communes.value = []
  const companyId = loc.value?.company?.provider
  if (!companyId || !wilayaId.value) return
  loadingCommunes.value = true
  try {
    communes.value = await locApi.communes(companyId, wilayaId.value)
  } catch {
    communes.value = []
  }
  loadingCommunes.value = false
  commune.value = keep && communes.value.some((c) => c.name === keep) ? keep : null
}

async function load() {
  loading.value = true
  loadError.value = ''
  loc.value = null
  search.value = ''
  try {
    const data = await locApi.get(props.orderId)
    loc.value = data
    wilayaId.value = data.proposal.courierWilayaId
    commune.value = null
    await loadCommunes(data.proposal.courierCommune)
  } catch (err: unknown) {
    loadError.value = (err as { data?: { message?: string } })?.data?.message ?? 'Could not load the location data'
  }
  loading.value = false
}
watch(() => props.open, (o) => { if (o) load() }, { immediate: true })

async function onWilaya(v: unknown) {
  if (typeof v !== 'string') return
  wilayaId.value = v
  search.value = ''
  await loadCommunes(null)
}

const wilayaOptions = computed(() => {
  const ids = new Set(loc.value?.courierWilayaIds ?? [])
  if (wilayaId.value) ids.add(wilayaId.value)
  return [...ids].sort((a, b) => Number(a) - Number(b)).map((id) => ({ label: `Wilaya ${id}`, value: id }))
})
const communeOptions = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = q ? communes.value.filter((c) => c.name.toLowerCase().includes(q) || c.name === commune.value) : communes.value
  return list.map((c) => ({ label: c.name, value: c.name }))
})
const chosen = computed(() => communes.value.find((c) => c.name === commune.value) ?? null)
const postalCode = computed(() => chosen.value?.postalCode ?? null)
const noCompany = computed(() => !!loc.value && !loc.value.company)

async function save() {
  if (!commune.value || !wilayaId.value) return
  saving.value = true
  const res = await run(() => locApi.save(props.orderId, {
    courierWilayaId: wilayaId.value,
    courierCommune: commune.value!,
    courierPostalCode: postalCode.value
  }), { success: 'Courier location saved', errorFallback: 'Could not save the courier location' })
  saving.value = false
  if (res !== undefined) {
    emit('saved')
    isOpen.value = false
  }
}

async function clear() {
  saving.value = true
  const res = await run(() => locApi.clear(props.orderId), { success: 'Conversion cleared', errorFallback: 'Could not clear the conversion' })
  saving.value = false
  if (res !== undefined) {
    emit('saved')
    isOpen.value = false
  }
}
</script>

<template>
  <AdsDialog v-model:open="isOpen" title="Convert location" description="Match this order's wilaya and commune to the courier's own list. Nothing is applied until you save." width="md">
    <p v-if="loading" class="muted">Loading…</p>
    <p v-else-if="loadError" class="muted">{{ loadError }}</p>
    <p v-else-if="noCompany" class="muted">Assign a shipping company to this order first.</p>
    <div v-else-if="loc" class="stack" style="gap: 14px">
      <div>
        <div class="muted" style="font-size: 12px; text-transform: uppercase; letter-spacing: .12em; font-weight: 600">Our location</div>
        <div><b>{{ loc.ourCommune }}</b>, {{ loc.ourWilaya.name }}<template v-if="loc.ourWilaya.id"> ({{ loc.ourWilaya.id }})</template></div>
        <div class="muted" style="font-size: 12px">Courier: {{ loc.company?.name }}</div>
      </div>

      <div class="grid-2">
        <AdsField label="Courier wilaya">
          <AdsSelect :model-value="wilayaId" :options="wilayaOptions" placeholder="Choose a wilaya…" @update:model-value="onWilaya" />
        </AdsField>
        <AdsField label="Postal code">
          <AdsInput :model-value="postalCode ?? ''" readonly placeholder="—" />
        </AdsField>
      </div>

      <AdsField label="Courier commune">
        <AdsInput v-model="search" placeholder="Search communes…" style="margin-bottom: 6px" />
        <AdsSelect v-model="commune" :options="communeOptions" :disabled="loadingCommunes || !communes.length" :placeholder="loadingCommunes ? 'Loading communes…' : communes.length ? 'Choose a commune…' : 'No communes for this wilaya'" />
      </AdsField>

      <p class="muted" style="font-size: 12px">Suggestion: {{ sourceLabel }}<template v-if="loc.current"> · saved on the order: {{ loc.current.courierCommune }} ({{ loc.current.courierWilayaId }})</template></p>
    </div>

    <template #footer>
      <button v-if="loc?.current" class="btn" type="button" :disabled="saving" style="margin-right: auto" @click="clear"><AdsIcon name="i-lucide-x" />Clear conversion</button>
      <button class="btn" type="button" @click="isOpen = false">Cancel</button>
      <button class="btn btn-primary" type="button" :disabled="!commune || saving || loading || noCompany" @click="save"><AdsIcon name="i-lucide-check" />Save</button>
    </template>
  </AdsDialog>
</template>
