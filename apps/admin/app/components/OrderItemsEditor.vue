<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { AdminOrderLineItem } from '@amalice/shared'

// Edit the lines of an order that hasn't reached a courier yet: quantity,
// line price, or remove a line. Each changed line goes through
// PATCH /admin/orders/:id/items/:itemId (the server keeps stock and the order
// total in step and re-checks that the order isn't shipped).
const props = defineProps<{ orderId: string; items: AdminOrderLineItem[] }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ changed: [] }>()

const api = useAdminApi()
const { run } = useApiAction()

interface Row { id: string; name: string; variant: string | null; quantity: number | null; totalDzd: number | null; origQty: number; origTotal: number; offerId: string; origOffer: string; remove: boolean }
const rows = ref<Row[]>([])
const saving = ref(false)

watch(open, (v) => {
  if (!v) return
  rows.value = props.items.map((i) => ({
    id: i.id,
    name: i.product.name,
    variant: i.variantLabel,
    quantity: i.quantity,
    totalDzd: i.lineTotalCents / 100,
    origQty: i.quantity,
    origTotal: i.lineTotalCents,
    offerId: i.offerId ?? '',
    origOffer: i.offerId ?? '',
    remove: false
  }))
})

// Changing the quantity re-prices the line at its unit price; the price field can still be overridden afterwards.
function onQty(r: Row, item: AdminOrderLineItem | undefined) {
  if (!item || r.quantity == null) return
  r.totalDzd = Math.round(item.unitPriceCents * r.quantity) / 100
}

function offerOptions(item: AdminOrderLineItem | undefined) {
  const list = (item?.availableOffers ?? []).map((o) => ({ label: o.label, value: o.id }))
  if (item?.offerId && !list.some((o) => o.value === item.offerId)) list.unshift({ label: item.offerLabel ?? 'Current offer', value: item.offerId })
  return [{ label: 'Plain option (no offer)', value: '' }, ...list]
}
// Picking another offer sets the quantity and price that offer stands for; both stay editable.
function onOffer(r: Row, item: AdminOrderLineItem | undefined, id: string) {
  r.offerId = id
  if (!item) return
  const o = item.availableOffers.find((x) => x.id === id)
  if (o) { r.quantity = o.quantity; r.totalDzd = o.priceCents / 100 }
  else if (!id) { r.quantity = 1; r.totalDzd = item.unitPriceCents / 100 }
}

const keptCount = computed(() => rows.value.filter((r) => !r.remove).length)

async function save() {
  saving.value = true
  let ok = true
  for (const r of rows.value) {
    if (r.remove) {
      if (keptCount.value < 1) { toast.warning('An order needs at least one item'); ok = false; break }
      const res = await run(() => api(`/admin/orders/${props.orderId}/items/${r.id}`, { method: 'DELETE' }), { errorFallback: 'Could not remove the item' })
      if (res === undefined) { ok = false; break }
      continue
    }
    const total = r.totalDzd == null ? NaN : Math.round(r.totalDzd * 100)
    if (r.quantity == null || !(r.quantity > 0) || !Number.isFinite(total) || total < 0) { toast.warning('Enter a valid quantity and price'); ok = false; break }
    const body: { quantity?: number; lineTotalCents?: number; offerId?: string | null } = {}
    if (r.offerId !== r.origOffer) body.offerId = r.offerId || null
    if (r.quantity !== r.origQty) body.quantity = r.quantity
    if (total !== r.origTotal) body.lineTotalCents = total
    if (!Object.keys(body).length) continue
    const res = await run(() => api(`/admin/orders/${props.orderId}/items/${r.id}`, { method: 'PATCH', body }), { errorFallback: 'Could not update the item' })
    if (res === undefined) { ok = false; break }
  }
  saving.value = false
  emit('changed')
  if (ok) { toast.success('Items updated'); open.value = false }
}
</script>

<template>
  <AdsDialog v-model:open="open" title="Edit items" description="Change the offer the customer picked, the quantity or the price, or remove a line. Allowed until the order is sent to the courier." width="lg">
    <div class="stack" style="gap: 10px">
      <div v-for="r in rows" :key="r.id" class="item-row" :class="{ removed: r.remove }">
        <div class="name">
          <b>{{ r.name }}</b>
          <span v-if="r.variant" class="muted">{{ r.variant }}</span>
        </div>
        <AdsField v-if="offerOptions(items.find((i) => i.id === r.id)).length > 1 || r.offerId" label="Offer" class="offer-field">
          <AdsSelect :model-value="r.offerId" :options="offerOptions(items.find((i) => i.id === r.id))" :disabled="r.remove" @update:model-value="(v) => onOffer(r, items.find((i) => i.id === r.id), String(v ?? ''))" />
        </AdsField>
        <AdsField label="Quantity"><AdsNumberInput v-model="r.quantity" :min="0.5" :step="0.5" :disabled="r.remove" @update:model-value="onQty(r, items.find((i) => i.id === r.id))" /></AdsField>
        <AdsField label="Line total (DZD)"><AdsNumberInput v-model="r.totalDzd" :min="0" :disabled="r.remove" /></AdsField>
        <button class="btn btn-sm" :class="r.remove ? '' : 'btn-danger'" type="button" :disabled="!r.remove && keptCount <= 1" @click="r.remove = !r.remove">
          <AdsIcon :name="r.remove ? 'i-lucide-undo-2' : 'i-lucide-trash-2'" />{{ r.remove ? 'Keep' : 'Remove' }}
        </button>
      </div>
    </div>
    <template #footer>
      <button class="btn" type="button" @click="open = false">Cancel</button>
      <AdsButton :loading="saving" icon="i-lucide-check" @click="save">Save items</AdsButton>
    </template>
  </AdsDialog>
</template>

<style scoped>
.item-row { display: grid; grid-template-columns: minmax(0, 1.6fr) 110px 150px auto; gap: 10px; align-items: end; padding: 10px 0; border-bottom: 1px solid var(--line-soft); }
.item-row.removed .name { text-decoration: line-through; opacity: .5; }
.offer-field { grid-column: 1 / -1; }
.name { display: flex; flex-direction: column; min-width: 0; padding-bottom: 8px; }
@media (max-width: 640px) { .item-row { grid-template-columns: 1fr 1fr; } .name { grid-column: 1 / -1; } }
</style>
