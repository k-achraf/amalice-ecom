<script setup lang="ts">
useHead({ title: 'Suppliers' })

interface Supplier { id: string; name: string; phone: string | null; email: string | null; address: string | null; notes: string | null; active: boolean }
interface Movement { id: string; productId: string; variantId: string | null; delta: number; reason: string; note: string | null; createdAt: string }

const api = useAdminApi()
const toast = useToast()

const { data: suppliers, pending, refresh } = await useAdminFetch<Supplier[]>('/admin/suppliers', { key: 'admin-suppliers' })
const rows = computed(() => suppliers.value ?? [])

const editing = ref<Partial<Supplier> | null>(null)
const showEdit = computed({ get: () => editing.value !== null, set: (v) => { if (!v) editing.value = null } })
const saving = ref(false)

function openNew() { editing.value = { name: '', phone: '', email: '', address: '', notes: '', active: true } }
function openEdit(s: Supplier) { editing.value = { ...s } }

async function save() {
  const s = editing.value
  if (!s?.name?.trim()) return
  saving.value = true
  try {
    const body = { name: s.name, phone: s.phone || null, email: s.email || null, address: s.address || null, notes: s.notes || null, active: s.active ?? true }
    await api(s.id ? `/admin/suppliers/${s.id}` : '/admin/suppliers', { method: s.id ? 'PATCH' : 'POST', body })
    editing.value = null
    await refresh()
    toast.add({ title: 'Supplier saved', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to save supplier', color: 'error' })
  } finally {
    saving.value = false
  }
}

const historyFor = ref<Supplier | null>(null)
const history = ref<Movement[] | 'loading'>([])
const showHistory = computed({ get: () => historyFor.value !== null, set: (v) => { if (!v) historyFor.value = null } })

async function openHistory(s: Supplier) {
  historyFor.value = s
  history.value = 'loading'
  try {
    history.value = await api<Movement[]>(`/admin/suppliers/${s.id}/history`)
  } catch {
    history.value = []
    toast.add({ title: 'Failed to load deliveries', color: 'error' })
  }
}
</script>

<template>
  <AdsPage title="Suppliers" :description="`${rows.length} suppliers · Who restocks your inventory`">
    <template #actions>
      <NuxtLink class="btn" to="/inventory">Products</NuxtLink>
      <button class="btn btn-primary" type="button" @click="openNew"><AdsIcon name="i-lucide-plus" />Add supplier</button>
    </template>

    <section class="card" aria-label="Supplier list">
      <div class="table-wrap">
        <table style="min-width: 640px">
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Status</th><th><span class="sr">Actions</span></th></tr></thead>
          <tbody>
            <tr v-if="pending"><td colspan="5" class="empty">Loading…</td></tr>
            <tr v-else-if="!rows.length"><td colspan="5" class="empty">No suppliers yet. Add one, then pick it when you restock a product.</td></tr>
            <tr v-for="s in rows" v-else :key="s.id">
              <td><span class="strong">{{ s.name }}</span><span v-if="s.address" class="sub">{{ s.address }}</span></td>
              <td>{{ s.phone ?? '—' }}</td>
              <td>{{ s.email ?? '—' }}</td>
              <td><span class="pill" :class="s.active ? 'instock' : 'draft'">{{ s.active ? 'Active' : 'Inactive' }}</span></td>
              <td class="num" style="white-space: nowrap">
                <button class="row-btn" type="button" :aria-label="`Deliveries from ${s.name}`" title="Deliveries" @click="openHistory(s)"><AdsIcon name="i-lucide-boxes" /></button>
                <button class="row-btn" type="button" :aria-label="`Edit ${s.name}`" title="Edit" @click="openEdit(s)"><AdsIcon name="i-lucide-pencil" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <AdsDialog v-model:open="showEdit" :title="editing?.id ? 'Edit supplier' : 'New supplier'" width="sm">
      <template v-if="editing">
        <AdsField label="Name"><AdsInput v-model="editing.name" /></AdsField>
        <AdsField label="Phone"><AdsInput v-model="editing.phone" /></AdsField>
        <AdsField label="Email"><AdsInput v-model="editing.email" /></AdsField>
        <AdsField label="Address"><AdsInput v-model="editing.address" /></AdsField>
        <AdsField label="Notes"><AdsInput v-model="editing.notes" /></AdsField>
        <label style="display: flex; align-items: center; gap: 8px"><input v-model="editing.active" type="checkbox">Active</label>
      </template>
      <template #footer>
        <button class="btn" type="button" @click="editing = null">Cancel</button>
        <AdsButton :loading="saving" :disabled="!editing?.name?.trim()" label="Save" @click="save" />
      </template>
    </AdsDialog>

    <AdsDialog v-model:open="showHistory" :title="`Deliveries — ${historyFor?.name ?? ''}`" width="sm">
      <p v-if="history === 'loading'" class="empty">Loading…</p>
      <p v-else-if="!history.length" class="empty">No stock received from this supplier yet.</p>
      <table v-else>
        <thead><tr><th>Date</th><th class="num">Units</th><th>Note</th></tr></thead>
        <tbody>
          <tr v-for="m in history" :key="m.id">
            <td>{{ new Date(m.createdAt).toLocaleDateString('en-GB') }}</td>
            <td class="num strong">{{ m.delta > 0 ? '+' : '' }}{{ m.delta }}</td>
            <td>{{ m.note ?? m.reason }}</td>
          </tr>
        </tbody>
      </table>
      <template #footer><button class="btn" type="button" @click="historyFor = null">Close</button></template>
    </AdsDialog>
  </AdsPage>
</template>
