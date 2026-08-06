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
useHead({ title: 'Attributes' })

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
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Attributes">
        <template #leading><UDashboardSidebarCollapse /></template>
        <template #right>
          <UButton icon="i-lucide-plus" size="sm" label="New attribute" @click="showCreate = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-3xl space-y-5">
        <p class="text-sm text-muted">
          Attributes are store-wide definitions reused across products. Each type controls how options appear
          in the variant selector on the storefront.
        </p>

        <div v-if="attributes?.length" class="space-y-4">
          <div v-for="attr in attributes" :key="attr.id" class="admin-kpi-card p-5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <h3 class="text-base font-semibold text-highlighted">{{ attr.name }}</h3>
                <UBadge size="sm" :color="(attr.type === 'Color' || attr.type === 'Swatch') ? 'primary' : 'neutral'" variant="subtle">
                  {{ typeLabel(attr.type) }}
                </UBadge>
              </div>
              <UButton icon="i-lucide-trash-2" size="xs" variant="ghost" color="error" aria-label="Delete attribute" @click="deleteAttribute(attr.id, attr.name)" />
            </div>

            <!-- Options rendered per type -->
            <div class="mt-3 flex flex-wrap gap-2">
              <div
                v-for="opt in attr.options"
                :key="opt.id"
                class="flex items-center gap-1.5 rounded-lg border border-[var(--color-admin-border)] bg-[var(--color-admin-bg)] px-2.5 py-1 text-sm"
              >
                <!-- Color: hex swatch -->
                <span
                  v-if="attr.type === 'Color' && opt.colorHex"
                  class="size-4 rounded-full border border-[var(--color-admin-border)]"
                  :style="{ backgroundColor: opt.colorHex }"
                />
                <!-- Swatch: image thumbnail -->
                <img
                  v-if="attr.type === 'Swatch' && opt.displayValue"
                  :src="opt.displayValue"
                  :alt="opt.value"
                  class="size-5 rounded object-cover"
                />
                <!-- Size: bold uppercase -->
                <span v-if="attr.type === 'Size'" class="font-bold uppercase tabular">{{ opt.value }}</span>
                <!-- Number: tabular -->
                <span v-else-if="attr.type === 'Number'" class="tabular">{{ opt.value }}</span>
                <!-- Boolean: icon -->
                <UIcon v-else-if="attr.type === 'Boolean'" :name="opt.value === 'Yes' ? 'i-lucide-check' : 'i-lucide-x'" class="size-4" :class="opt.value === 'Yes' ? 'text-success' : 'text-muted'" />
                <!-- Measurement: value + unit -->
                <span v-else-if="attr.type === 'Measurement'">{{ opt.value }}<span v-if="opt.displayValue" class="text-muted"> {{ opt.displayValue }}</span></span>
                <!-- Text (default) -->
                <span v-else>{{ opt.value }}</span>
              </div>
              <span v-if="!attr.options.length" class="text-sm text-muted">No options yet.</span>
            </div>

            <!-- Add option inline (fields depend on type) -->
            <div v-if="addingOptionTo === attr.id" class="mt-3 flex flex-wrap items-center gap-2">
              <UInput v-model="optValue" :placeholder="attr.type === 'Boolean' ? 'Yes or No' : attr.type === 'Measurement' ? '500' : 'Option value'" size="sm" class="w-36" @keydown.enter="addOption(attr)" />

              <!-- Color: hex picker -->
              <template v-if="attr.type === 'Color'">
                <input v-model="optColor" type="color" class="size-7 cursor-pointer rounded border border-[var(--color-admin-border)]" />
                <UInput v-model="optColor" placeholder="#dc2626" size="sm" class="w-24" />
              </template>

              <!-- Swatch: image URL -->
              <UInput v-if="attr.type === 'Swatch'" v-model="optDisplay" placeholder="https://…/fabric.jpg" size="sm" class="w-48" />

              <!-- Measurement: unit -->
              <UInput v-if="attr.type === 'Measurement'" v-model="optDisplay" placeholder="unit (g, m, ml…)" size="sm" class="w-24" />

              <UButton size="xs" color="primary" label="Add" @click="addOption(attr)" />
              <UButton size="xs" color="neutral" variant="ghost" label="Cancel" @click="addingOptionTo = null" />
            </div>
            <UButton
              v-else-if="attr.type !== 'Boolean' || attr.options.length < 2"
              size="xs"
              variant="outline"
              color="neutral"
              icon="i-lucide-plus"
              label="Add option"
              class="mt-3"
              @click="startAddOption(attr.id)"
            />
            <p v-else class="mt-3 text-xs text-muted">Boolean attributes are limited to two options.</p>
          </div>
        </div>

        <EmptyState v-else icon="i-lucide-layers" title="No attributes yet" description="Create your first attribute (e.g. Color or Size) to start building product variants.">
          <UButton class="mt-4" color="primary" icon="i-lucide-plus" label="New attribute" @click="showCreate = true" />
        </EmptyState>
      </div>

      <!-- Create attribute modal -->
      <UModal v-model:open="showCreateBool">
        <template #content>
          <div class="w-full max-w-md space-y-4 p-6">
            <h3 class="text-lg font-semibold">New attribute</h3>
            <UFormField label="Name" hint="e.g. Color, Size, Material, With charger">
              <UInput v-model="newName" placeholder="Color" class="w-full" />
            </UFormField>
            <UFormField label="Type" :hint="typeHint(newType)">
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  v-for="t in TYPE_OPTIONS"
                  :key="t.value"
                  type="button"
                  class="rounded-lg border-2 px-3 py-2 text-left text-sm transition-colors"
                  :class="newType === t.value ? 'border-primary bg-primary/5 text-primary' : 'border-[var(--color-admin-border)] text-muted hover:border-primary/40'"
                  @click="newType = t.value"
                >
                  <span class="font-medium">{{ t.label }}</span>
                </button>
              </div>
            </UFormField>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" label="Cancel" @click="showCreate = false" />
              <UButton :loading="creating" :disabled="!newName" label="Create" color="primary" @click="createAttribute" />
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
