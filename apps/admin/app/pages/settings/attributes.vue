<script setup lang="ts">
// Attribute management — create store-wide attribute definitions and their
// options. Each type renders options differently in the UI:
//   Text        → plain labels (default)
//   Color       → hex swatch dot before the label
//   Swatch      → image thumbnail (the displayValue holds the image URL)
//   Size        → bold uppercase chip (clothing-size visual)
//   Number      → tabular number label
//   Boolean     → Yes / No (only two options; rendered as toggle chips)
//   Measurement → value + unit label (e.g. "500 g")
definePageMeta({ requiredRole: 'SuperAdmin' })
useHead({ title: 'Attributes & options' })

const api = useAdminApi()
const toast = useToast()

interface AttrOption { id: string; value: string; displayValue?: string | null; colorHex?: string | null; sortOrder: number }
interface Attr { id: string; name: string; type: string; sortOrder: number; options: AttrOption[] }

const { data: attributes, refresh } = await useAdminFetch<Attr[]>('/admin/attributes', { key: 'admin-attributes-page' })

// Type metadata — drives the selector, the badges, and the hint text.
const TYPE_OPTIONS = [
  { label: 'Text', value: 'Text', hint: 'Plain text labels (default)' },
  { label: 'Color', value: 'Color', hint: 'Hex color swatch per option' },
  { label: 'Swatch', value: 'Swatch', hint: 'Image thumbnail per option (fabric, material)' },
  { label: 'Size', value: 'Size', hint: 'Clothing-size scale (S, M, L, XL)' },
  { label: 'Number', value: 'Number', hint: 'Numeric values (1, 2, 3)' },
  { label: 'Boolean', value: 'Boolean', hint: 'Yes / No toggle (only two options)' },
  { label: 'Measurement', value: 'Measurement', hint: 'Value with a unit (500 g, 1.5 m)' }
]

function typeLabel(t: string) {
  return TYPE_OPTIONS.find((x) => x.value === t)?.label ?? t
}
function typeHint(t: string) {
  return TYPE_OPTIONS.find((x) => x.value === t)?.hint ?? ''
}

// --- Create attribute ---
const showCreate = ref(false)
const newName = ref('')
const newType = ref<string>('Text')
const creating = ref(false)

async function createAttribute() {
  if (!newName.value) return
  creating.value = true
  try {
    await api('/admin/attributes', { method: 'POST', body: { name: newName.value, type: newType.value } })
    newName.value = ''
    newType.value = 'Text'
    showCreate.value = false
    await refresh()
    toast.add({ title: 'Attribute created', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to create attribute', color: 'error' })
  } finally {
    creating.value = false
  }
}

// --- Add option ---
const addingOptionTo = ref<string | null>(null)
const optValue = ref('')
const optColor = ref('#000000')
const optDisplay = ref('')

function startAddOption(attrId: string) {
  addingOptionTo.value = attrId
  optValue.value = ''
  optColor.value = '#000000'
  optDisplay.value = ''
}

async function addOption(attr: Attr) {
  if (!optValue.value) return
  const body: Record<string, string> = { value: optValue.value }
  if (attr.type === 'Color') body.colorHex = optColor.value
  if (attr.type === 'Swatch' && optDisplay.value) body.displayValue = optDisplay.value
  if (attr.type === 'Measurement' && optDisplay.value) body.displayValue = optDisplay.value
  try {
    await api(`/admin/attributes/${attr.id}/options`, { method: 'POST', body })
    optValue.value = ''
    optColor.value = '#000000'
    optDisplay.value = ''
    addingOptionTo.value = null
    await refresh()
    toast.add({ title: 'Option added', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to add option', color: 'error' })
  }
}

// --- Delete ---
async function deleteAttribute(id: string, name: string) {
  if (!confirm(`Delete attribute "${name}"? This removes it from all products and variants.`)) return
  try {
    await api(`/admin/attributes/${id}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: 'Attribute deleted', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to delete attribute', color: 'error' })
  }
}

const showCreateBool = computed({
  get: () => showCreate.value,
  set: (v) => { if (!v) showCreate.value = false }
})

// ---- Design two-pane layout: attribute list on the left, the selected one on the right ----
const selectedId = ref<string | null>(null)
const current = computed(() => attributes.value?.find((a) => a.id === selectedId.value) ?? attributes.value?.[0] ?? null)

</script>

<template>
  <AdsPage title="Attributes & options" description="Reusable variant options for your products">
    <template #actions>
      <button class="btn btn-primary" type="button" @click="showCreate = true"><AdsIcon name="i-lucide-plus" />New attribute</button>
    </template>

    <AdsEmptyState v-if="!attributes?.length" icon="i-lucide-layers" title="No attributes yet" description="Create your first attribute (e.g. Color or Size) to start building product variants.">
      <button class="btn btn-primary" type="button" style="margin-top: 8px" @click="showCreate = true"><AdsIcon name="i-lucide-plus" />New attribute</button>
    </AdsEmptyState>

    <div v-else class="split queue-left">
      <section class="card flush" aria-labelledby="al-h">
        <div class="card-head"><h2 id="al-h">Attributes <small>{{ attributes.length }}</small></h2></div>
        <div class="attr-list">
          <button v-for="a in attributes" :key="a.id" type="button" class="attr-item" :aria-current="a.id === current?.id" @click="selectedId = a.id">
            <span class="thumb"><AdsIcon name="i-lucide-layers" /></span>
            <span class="meta"><b>{{ a.name }}</b><span>{{ a.options.length }} options · {{ typeLabel(a.type) }}</span></span>
            <span v-if="a.type === 'Color'" style="display: flex; gap: 2px">
              <span v-for="o in a.options.slice(0, 4)" :key="o.id" class="sw" :style="{ background: o.colorHex ?? '#ccc', width: '12px', height: '12px', border: '1px solid rgba(14,41,40,.12)' }" />
            </span>
          </button>
        </div>
      </section>

      <div v-if="current" class="stack">
        <section class="card" aria-labelledby="ae-h">
          <div class="card-head"><h2 id="ae-h">Attribute</h2><span class="muted">{{ typeLabel(current.type) }}</span></div>
          <div class="grid-2">
            <div class="field"><label class="label">Name</label><input class="input" :value="current.name" readonly><span class="hint">Shown to customers, e.g. "Color".</span></div>
            <div class="field"><label class="label">How customers choose</label><input class="input" :value="`${typeLabel(current.type)}: ${typeHint(current.type)}`" readonly></div>
          </div>
        </section>

        <section class="card" aria-labelledby="ao-h">
          <div class="card-head"><h2 id="ao-h">Options</h2><span class="muted">{{ current.options.length }}</span></div>
          <div>
            <div v-for="opt in current.options" :key="opt.id" class="opt-row" style="grid-template-columns: 40px minmax(0, 1fr) auto">
              <span v-if="current.type === 'Color' && opt.colorHex" class="sw" :style="{ background: opt.colorHex, width: '32px', height: '32px', border: '1px solid rgba(14,41,40,.15)' }" />
              <img v-else-if="current.type === 'Swatch' && opt.displayValue" :src="opt.displayValue" :alt="opt.value" style="width: 32px; height: 32px; border-radius: 4px; object-fit: cover">
              <span v-else class="noswatch" aria-hidden="true" />
              <span :class="{ strong: current.type === 'Size' }">{{ opt.value }}<span v-if="current.type === 'Measurement' && opt.displayValue" class="muted"> {{ opt.displayValue }}</span></span>
              <span class="muted mono" style="font-size: 12px">{{ opt.colorHex ?? '' }}</span>
            </div>
            <p v-if="!current.options.length" class="muted">No options yet. Add the first one below.</p>
          </div>

          <div v-if="addingOptionTo === current.id" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center">
            <input v-model="optValue" class="input" style="max-width: 220px" :placeholder="current.type === 'Boolean' ? 'Yes or No' : current.type === 'Measurement' ? '500' : 'Option value'" @keydown.enter.prevent="addOption(current)">
            <template v-if="current.type === 'Color'">
              <input v-model="optColor" type="color" aria-label="Colour" style="width: 40px; height: 40px; border: 1px solid var(--line); border-radius: var(--r); padding: 2px; background: var(--white)">
              <input v-model="optColor" class="input" style="max-width: 120px" placeholder="#dc2626">
            </template>
            <input v-if="current.type === 'Swatch'" v-model="optDisplay" class="input" style="max-width: 260px" placeholder="https://…/fabric.jpg">
            <input v-if="current.type === 'Measurement'" v-model="optDisplay" class="input" style="max-width: 140px" placeholder="unit (g, m, ml…)">
            <button class="btn btn-primary" type="button" @click="addOption(current)">Add</button>
            <button class="btn btn-ghost" type="button" @click="addingOptionTo = null">Cancel</button>
          </div>
          <div v-else-if="current.type !== 'Boolean' || current.options.length < 2">
            <button class="btn" type="button" @click="startAddOption(current.id)"><AdsIcon name="i-lucide-plus" />Add option</button>
          </div>
          <p v-else class="muted">Boolean attributes are limited to two options.</p>
        </section>

        <section class="card" aria-labelledby="pv-h">
          <div class="card-head"><h2 id="pv-h">Preview on the product page</h2></div>
          <div style="background: var(--ivory); border-radius: var(--r); padding: 16px">
            <div style="font-size: 13px; font-weight: 500; margin-bottom: 8px">{{ current.name }}: <span class="muted">{{ current.options[0]?.value ?? '' }}</span></div>
            <div v-if="current.type === 'Color'" style="display: flex; gap: 8px; flex-wrap: wrap">
              <span v-for="(o, i) in current.options" :key="o.id" :title="o.value" :style="{ width: '32px', height: '32px', borderRadius: '4px', background: o.colorHex ?? '#ccc', border: '1px solid rgba(14,41,40,.15)', boxShadow: i === 0 ? '0 0 0 2px var(--ivory), 0 0 0 4px var(--teal)' : 'none' }" />
            </div>
            <select v-else-if="current.options.length > 6" class="select" style="max-width: 260px" aria-label="Preview dropdown"><option v-for="o in current.options" :key="o.id">{{ o.value }}</option></select>
            <div v-else style="display: flex; gap: 8px; flex-wrap: wrap">
              <span v-for="(o, i) in current.options" :key="o.id" :style="{ padding: '8px 14px', borderRadius: '4px', fontSize: '13px', border: '1px solid ' + (i === 0 ? 'var(--teal)' : 'var(--line)'), background: i === 0 ? 'var(--teal)' : 'var(--white)', color: i === 0 ? 'var(--ivory)' : 'inherit' }">{{ o.value }}<template v-if="o.displayValue && current.type === 'Measurement'"> {{ o.displayValue }}</template></span>
            </div>
          </div>
        </section>

        <div style="display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap">
          <button class="btn btn-danger" type="button" @click="deleteAttribute(current.id, current.name)"><AdsIcon name="i-lucide-trash-2" />Delete attribute</button>
        </div>
      </div>
    </div>
  </AdsPage>

  <AdsDialog v-model:open="showCreate" title="New attribute">
    <AdsField label="Name" help="e.g. Color, Size, Material, With charger"><AdsInput v-model="newName" placeholder="Color" /></AdsField>
    <div class="field">
      <span class="label">How customers choose</span>
      <div class="type-pick" role="radiogroup" aria-label="Attribute type">
        <label v-for="t in TYPE_OPTIONS" :key="t.value"><input v-model="newType" type="radio" name="atype" :value="t.value"><b>{{ t.label }}</b><span>{{ t.hint }}</span></label>
      </div>
    </div>
    <template #footer>
      <button class="btn" type="button" @click="showCreate = false">Cancel</button>
      <button class="btn btn-primary" type="button" :disabled="!newName || creating" @click="createAttribute">Create</button>
    </template>
  </AdsDialog>
</template>
