<script setup lang="ts">
useHead({ title: 'Stocktake' })

interface Sheet { id: string; name: string; stockQuantity: number; variants: { id: string; sku: string; stockQuantity: number }[] }
interface Line { key: string; productId: string; variantId?: string; label: string; sub: string; recorded: number }

const api = useAdminApi()
const toast = useToast()

const { data: sheet, pending, refresh } = await useAdminFetch<Sheet[]>('/admin/inventory/count-sheet', { key: 'admin-count-sheet' })

// A product with variants is counted per variant (its own quantity is not
// the sum); one without is counted directly.
const lines = computed<Line[]>(() =>
  (sheet.value ?? []).flatMap((p) =>
    p.variants.length
      ? p.variants.map((v) => ({ key: v.id, productId: p.id, variantId: v.id, label: p.name, sub: v.sku, recorded: v.stockQuantity }))
      : [{ key: p.id, productId: p.id, label: p.name, sub: '', recorded: p.stockQuantity }]
  )
)

const counted = reactive<Record<string, number | null>>({})
const search = ref('')
const note = ref('')
const saving = ref(false)

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  return lines.value.filter((l) => !q || `${l.label} ${l.sub}`.toLowerCase().includes(q))
})
const diffs = computed(() => lines.value.filter((l) => counted[l.key] != null && counted[l.key] !== l.recorded))

async function submit() {
  if (!diffs.value.length) {
    toast.add({ title: 'Enter at least one counted quantity that differs', color: 'warning' })
    return
  }
  saving.value = true
  try {
    const res = await api<{ adjusted: number }>('/admin/inventory/stocktake', {
      method: 'POST',
      body: {
        note: note.value || undefined,
        counts: lines.value.filter((l) => counted[l.key] != null).map((l) => ({ productId: l.productId, variantId: l.variantId, counted: counted[l.key] }))
      }
    })
    for (const k of Object.keys(counted)) delete counted[k]
    note.value = ''
    await refresh()
    toast.add({ title: `Stocktake saved — ${res.adjusted} item(s) corrected`, color: 'success' })
  } catch {
    toast.add({ title: 'Failed to save stocktake', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AdsPage title="Stocktake" description="Count what is on the shelf and correct the system">
    <template #actions>
      <NuxtLink class="btn" to="/inventory">Products</NuxtLink>
      <AdsButton :loading="saving" :label="`Apply ${diffs.length} correction(s)`" @click="submit" />
    </template>

    <section class="card" aria-label="Count sheet">
      <div class="card-head">
        <AdsSearch v-model="search" soft placeholder="Product or SKU" label="Search items" />
        <AdsInput v-model="note" placeholder="Note (optional), e.g. monthly count" style="max-width: 320px" />
      </div>
      <div class="table-wrap">
        <table style="min-width: 640px">
          <thead><tr><th>Item</th><th class="num">In system</th><th class="num">Counted</th><th class="num">Difference</th></tr></thead>
          <tbody>
            <tr v-if="pending"><td colspan="4" class="empty">Loading…</td></tr>
            <tr v-else-if="!visible.length"><td colspan="4" class="empty">Nothing to count.</td></tr>
            <tr v-for="l in visible" v-else :key="l.key">
              <td><span class="strong">{{ l.label }}</span><span v-if="l.sub" class="sub">{{ l.sub }}</span></td>
              <td class="num">{{ l.recorded }}</td>
              <td class="num"><input v-model.number="counted[l.key]" class="input sm" type="number" min="0" step="0.5" style="width: 90px; text-align: right" :aria-label="`Counted ${l.label} ${l.sub}`"></td>
              <td class="num strong" :style="{ color: counted[l.key] == null || counted[l.key] === l.recorded ? '' : counted[l.key]! < l.recorded ? 'var(--danger)' : 'var(--teal)' }">
                {{ counted[l.key] == null || counted[l.key] === (l.recorded) ? '—' : (counted[l.key]! - l.recorded > 0 ? '+' : '') + Math.round((counted[l.key]! - l.recorded) * 1000) / 1000 }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </AdsPage>
</template>
