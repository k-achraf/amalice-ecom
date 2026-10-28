<script setup lang="ts">
import { FUNNEL_NONE, ORDER_FILTER_KEYS } from '@amalice/shared'
import type { OrderFilterKey, OrderFilters } from '@amalice/shared'

// Shared filter bar for every order-based page.
//   <OrderFilters v-model="filters" :fields="['productId', 'funnelId', ...]" @change="reload" />
// Only the controls named in `fields` are rendered. Selects emit immediately;
// text / number inputs are debounced (400 ms). The model is replaced with a new
// object AND synced in place, so it works with both a ref and a reactive() object.
const props = defineProps<{ modelValue: Partial<OrderFilters>; fields: OrderFilterKey[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: Partial<OrderFilters>]; change: [value: Partial<OrderFilters>] }>()

const { options } = useOrderFilterOptions()
const open = ref(false)

const has = (k: OrderFilterKey) => props.fields.includes(k)
const any = (...ks: OrderFilterKey[]) => ks.some(has)
const m = computed(() => props.modelValue ?? {})

const PLATFORMS = ['Meta', 'TikTok', 'Google', 'Snapchat', 'Other', 'Organic', 'Direct']
const ANY = { label: 'Any', value: '' }
const productOptions = computed(() => [{ label: 'All products', value: '' }, ...options.value.products.map((p) => ({ label: p.name, value: p.id }))])
const funnelOptions = computed(() => [ANY, { label: 'No funnel (storefront)', value: FUNNEL_NONE }, ...options.value.funnels.map((f) => ({ label: f.name, value: f.id }))])
const companyOptions = computed(() => [ANY, ...options.value.companies.map((c) => ({ label: c.name, value: c.id }))])
const regionOptions = computed(() => [ANY, ...options.value.regions.map((r) => ({ label: r, value: r }))])
const typeOptions = [ANY, { label: 'Home', value: 'Home' }, { label: 'Desk', value: 'Desk' }]
const platformOptions = [ANY, ...PLATFORMS.map((p) => ({ label: p, value: p }))]
const riskOptions = [ANY, { label: 'Low', value: 'Low' }, { label: 'Medium', value: 'Medium' }, { label: 'High', value: 'High' }]
const yesNo = [ANY, { label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]

function apply(next: Record<string, unknown>) {
  // Keep a reactive parent object in sync even if the parent can't assign v-model.
  const cur = props.modelValue as Record<string, unknown>
  if (cur && typeof cur === 'object') {
    for (const k of Object.keys(cur)) if (!(k in next)) delete cur[k]
    Object.assign(cur, next)
  }
  emit('update:modelValue', next as Partial<OrderFilters>)
  emit('change', next as Partial<OrderFilters>)
}

function commit(key: OrderFilterKey, val: unknown) {
  const next: Record<string, unknown> = { ...m.value }
  if (val === undefined || val === null || val === '') delete next[key]
  else next[key] = val
  apply(next)
}

// Debounced drafts for typed fields.
const TYPED = ['city', 'courierStatus', 'minTotal', 'maxTotal'] as const
type TypedKey = (typeof TYPED)[number]
const draft = reactive<Record<TypedKey, string>>({ city: '', courierStatus: '', minTotal: '', maxTotal: '' })
const timers: Partial<Record<TypedKey, ReturnType<typeof setTimeout>>> = {}

watch(() => TYPED.map((k) => (m.value as Record<string, unknown>)[k]), () => {
  for (const k of TYPED) {
    if (timers[k]) continue
    const v = (m.value as Record<string, unknown>)[k]
    draft[k] = v === undefined || v === null ? '' : String(v)
  }
}, { immediate: true })

function typed(key: TypedKey, raw: string | number | null | undefined) {
  const s = raw == null ? '' : String(raw)
  draft[key] = s
  clearTimeout(timers[key])
  timers[key] = setTimeout(() => {
    delete timers[key]
    const t = s.trim()
    if (key === 'minTotal' || key === 'maxTotal') commit(key, t === '' || Number.isNaN(Number(t)) ? undefined : Number(t))
    else commit(key, t)
  }, 400)
}
onBeforeUnmount(() => { for (const k of TYPED) clearTimeout(timers[k]) })

function clearAll() {
  for (const k of TYPED) { clearTimeout(timers[k]); delete timers[k] }
  const next: Record<string, unknown> = { ...m.value }
  for (const k of props.fields) delete next[k]
  apply(next)
}

// Active chips (only for the fields this page shows).
const nameOf = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? id
const money = (n: unknown) => `${Number(n).toLocaleString('en-US')} DA`
const chips = computed(() => {
  const f = m.value as Record<string, any>
  const out: { key: OrderFilterKey; label: string }[] = []
  for (const k of ORDER_FILTER_KEYS) {
    if (!has(k)) continue
    const v = f[k]
    if (v === undefined || v === null || v === '') continue
    let label: string
    switch (k) {
      case 'productId': label = `Product: ${nameOf(options.value.products, v)}`; break
      case 'variantId': label = 'Variant selected'; break
      case 'funnelId': label = `Funnel: ${v === FUNNEL_NONE ? 'No funnel (storefront)' : nameOf(options.value.funnels, v)}`; break
      case 'companyId': label = `Company: ${nameOf(options.value.companies, v)}`; break
      case 'region': label = `Wilaya: ${v}`; break
      case 'city': label = `Commune: ${v}`; break
      case 'shippingType': label = `Delivery: ${v}`; break
      case 'platform': label = `Source: ${v}`; break
      case 'riskLevel': label = `Risk: ${v}`; break
      case 'minTotal': label = `Total ≥ ${money(v)}`; break
      case 'maxTotal': label = `Total ≤ ${money(v)}`; break
      case 'from': label = `From ${v}`; break
      case 'to': label = `To ${v}`; break
      case 'hasTracking': label = `Tracking: ${v}`; break
      case 'confirmedByCourier': label = `Courier confirmed: ${v}`; break
      case 'courierStatus': label = `Courier status: ${v}`; break
      default: label = `${k}: ${v}`
    }
    out.push({ key: k, label })
  }
  return out
})
const activeCount = computed(() => chips.value.length)
</script>

<template>
  <div class="of-wrap">
    <div class="of-bar">
      <AdsButton appearance="default" icon="i-lucide-filter" size="sm" :aria-expanded="open" @click="open = !open">
        Filters
        <span v-if="activeCount" class="pill solid">{{ activeCount }}</span>
      </AdsButton>
      <div v-if="chips.length" class="chips of-chips">
        <span v-for="c in chips" :key="c.key" class="pill neutral of-chip">
          {{ c.label }}
          <button type="button" class="of-x" :aria-label="`Remove ${c.label}`" @click="commit(c.key, undefined)">
            <AdsIcon name="i-lucide-x" style="width: 12px; height: 12px" />
          </button>
        </span>
      </div>
      <AdsButton v-if="chips.length" appearance="subtle" size="sm" @click="clearAll">Clear all</AdsButton>
    </div>

    <div v-if="open" class="card of-panel">
      <div class="of-grid">
        <section v-if="any('productId', 'funnelId', 'companyId')" class="of-group">
          <h4 class="of-title">Catalog</h4>
          <AdsField v-if="has('productId')" label="Product">
            <AdsSearchSelect :model-value="m.productId ?? ''" :options="productOptions" placeholder="All products" @update:model-value="commit('productId', $event)" />
          </AdsField>
          <AdsField v-if="has('funnelId')" label="Funnel / offer">
            <AdsSelect :model-value="m.funnelId ?? ''" :options="funnelOptions" @update:model-value="commit('funnelId', $event)" />
          </AdsField>
          <AdsField v-if="has('companyId')" label="Shipping company">
            <AdsSelect :model-value="m.companyId ?? ''" :options="companyOptions" @update:model-value="commit('companyId', $event)" />
          </AdsField>
        </section>

        <section v-if="any('region', 'city', 'shippingType')" class="of-group">
          <h4 class="of-title">Delivery</h4>
          <AdsField v-if="has('region')" label="Wilaya">
            <AdsSelect :model-value="m.region ?? ''" :options="regionOptions" @update:model-value="commit('region', $event)" />
          </AdsField>
          <AdsField v-if="has('city')" label="Commune">
            <AdsInput :model-value="draft.city" placeholder="Exact commune name" @update:model-value="typed('city', $event)" />
          </AdsField>
          <AdsField v-if="has('shippingType')" label="Delivery type">
            <AdsSelect :model-value="m.shippingType ?? ''" :options="typeOptions" @update:model-value="commit('shippingType', $event)" />
          </AdsField>
        </section>

        <section v-if="any('platform', 'riskLevel', 'minTotal', 'maxTotal', 'from', 'to')" class="of-group">
          <h4 class="of-title">Order</h4>
          <AdsField v-if="has('platform')" label="Ad source">
            <AdsSelect :model-value="m.platform ?? ''" :options="platformOptions" @update:model-value="commit('platform', $event)" />
          </AdsField>
          <AdsField v-if="has('riskLevel')" label="Risk">
            <AdsSelect :model-value="m.riskLevel ?? ''" :options="riskOptions" @update:model-value="commit('riskLevel', $event)" />
          </AdsField>
          <AdsField v-if="any('minTotal', 'maxTotal')" label="Order total (DA)">
            <div class="of-pair">
              <AdsInput v-if="has('minTotal')" type="number" :model-value="draft.minTotal" placeholder="Min" @update:model-value="typed('minTotal', $event)" />
              <AdsInput v-if="has('maxTotal')" type="number" :model-value="draft.maxTotal" placeholder="Max" @update:model-value="typed('maxTotal', $event)" />
            </div>
          </AdsField>
          <AdsField v-if="any('from', 'to')" label="Date range">
            <div class="of-pair">
              <AdsInput v-if="has('from')" type="date" :model-value="m.from ?? ''" @update:model-value="commit('from', $event)" />
              <AdsInput v-if="has('to')" type="date" :model-value="m.to ?? ''" @update:model-value="commit('to', $event)" />
            </div>
          </AdsField>
        </section>

        <section v-if="any('hasTracking', 'confirmedByCourier', 'courierStatus')" class="of-group">
          <h4 class="of-title">Courier</h4>
          <AdsField v-if="has('hasTracking')" label="Has tracking number">
            <AdsSelect :model-value="m.hasTracking ?? ''" :options="yesNo" @update:model-value="commit('hasTracking', $event)" />
          </AdsField>
          <AdsField v-if="has('confirmedByCourier')" label="Confirmed by courier">
            <AdsSelect :model-value="m.confirmedByCourier ?? ''" :options="yesNo" @update:model-value="commit('confirmedByCourier', $event)" />
          </AdsField>
          <AdsField v-if="has('courierStatus')" label="Courier status">
            <AdsInput :model-value="draft.courierStatus" placeholder="Courier's status code" @update:model-value="typed('courierStatus', $event)" />
          </AdsField>
        </section>
      </div>
      <div class="of-foot">
        <AdsButton appearance="subtle" size="sm" :disabled="!activeCount" @click="clearAll">Clear all</AdsButton>
        <AdsButton appearance="default" size="sm" @click="open = false">Close</AdsButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.of-wrap { display: flex; flex-direction: column; gap: 10px; }
.of-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.of-chips { flex-grow: 0; align-items: center; }
.of-chip { gap: 4px; }
.of-x { display: inline-flex; align-items: center; justify-content: center; border: 0; background: transparent; color: inherit; padding: 2px; border-radius: var(--r-sm); cursor: pointer; }
.of-x:hover { background: rgba(0, 0, 0, .08); }
.of-panel { padding: 16px; }
.of-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
.of-group { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.of-title { margin: 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--text-2); }
.of-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.of-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--line); }
@media (max-width: 640px) {
  .of-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
