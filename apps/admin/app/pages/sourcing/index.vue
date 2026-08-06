<script setup lang="ts">
import type { SourcedProductListItem, SourcedProductStatus, WholesalerView } from '@amalice/shared'

// Plain-string local form state — UInput's v-model wants string | undefined,
// not the nullable() shape CreateWholesaler's optional fields have; blank
// strings are converted to null only when building the request body.
interface WholesalerFormState {
  name: string
  country: string
  contactName: string
  contactPhone: string
  contactEmail: string
  website: string
  notes: string
}

// Product Sourcing / Ad-Testing operations — deliberately separate from the
// live storefront-facing Product catalog (see SourcedProduct's Prisma
// comment): research-phase noise (ad spend, creative experiments,
// wholesaler back-and-forth) never touches the real Product model until a
// candidate is explicitly linked once it goes live. Two tabs on one page,
// mirroring the pattern used by /apps/google-sheets and products/[id].vue.
useHead({ title: 'Product Sourcing' })

const router = useRouter()
const api = useAdminApi()
const toast = useToast()

const activeTab = ref<'products' | 'wholesalers'>('products')

const { data: sourcedProducts, pending: productsPending, refresh: refreshProducts } = await useAdminFetch<SourcedProductListItem[]>('/admin/sourcing/products', { key: 'admin-sourcing-products' })
const { data: wholesalers, pending: wholesalersPending, refresh: refreshWholesalers } = await useAdminFetch<WholesalerView[]>('/admin/sourcing/wholesalers', { key: 'admin-sourcing-wholesalers' })

const statusColor: Record<SourcedProductStatus, 'neutral' | 'info' | 'warning' | 'error' | 'success' | 'primary'> = {
  Researching: 'neutral',
  Testing: 'info',
  TestPassed: 'success',
  TestFailed: 'error',
  Sourcing: 'warning',
  Received: 'primary',
  Live: 'success',
  Discontinued: 'neutral'
}

// ---- New sourced product ----
const showCreateProduct = ref(false)
const newProductName = ref('')
const newProductNiche = ref('')
const creatingProduct = ref(false)

function openCreateProduct() {
  newProductName.value = ''
  newProductNiche.value = ''
  showCreateProduct.value = true
}

async function createProduct() {
  if (!newProductName.value.trim()) return
  creatingProduct.value = true
  try {
    const created = await api<{ id: string }>('/admin/sourcing/products', {
      method: 'POST',
      body: { name: newProductName.value.trim(), niche: newProductNiche.value || undefined }
    })
    showCreateProduct.value = false
    await router.push(`/sourcing/${created.id}`)
  } catch {
    toast.add({ title: 'Failed to create sourced product', color: 'error' })
  } finally {
    creatingProduct.value = false
  }
}

// ---- New wholesaler ----
const showCreateWholesaler = ref(false)
const newWholesaler = reactive<WholesalerFormState>({ name: '', country: '', contactName: '', contactPhone: '', contactEmail: '', website: '', notes: '' })
const creatingWholesaler = ref(false)

function openCreateWholesaler() {
  Object.assign(newWholesaler, { name: '', country: '', contactName: '', contactPhone: '', contactEmail: '', website: '', notes: '' })
  showCreateWholesaler.value = true
}

async function createWholesaler() {
  if (!newWholesaler.name.trim()) return
  creatingWholesaler.value = true
  try {
    await api('/admin/sourcing/wholesalers', {
      method: 'POST',
      body: {
        name: newWholesaler.name,
        country: newWholesaler.country || null,
        contactName: newWholesaler.contactName || null,
        contactPhone: newWholesaler.contactPhone || null,
        contactEmail: newWholesaler.contactEmail || null,
        website: newWholesaler.website || null,
        notes: newWholesaler.notes || null
      }
    })
    showCreateWholesaler.value = false
    await refreshWholesalers()
    toast.add({ title: 'Wholesaler added', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to add wholesaler', color: 'error' })
  } finally {
    creatingWholesaler.value = false
  }
}

const editingWholesaler = ref<WholesalerView | null>(null)
const editForm = reactive<WholesalerFormState>({ name: '', country: '', contactName: '', contactPhone: '', contactEmail: '', website: '', notes: '' })
const savingWholesaler = ref(false)

function openEditWholesaler(w: WholesalerView) {
  editingWholesaler.value = w
  Object.assign(editForm, { name: w.name, country: w.country ?? '', contactName: w.contactName ?? '', contactPhone: w.contactPhone ?? '', contactEmail: w.contactEmail ?? '', website: w.website ?? '', notes: w.notes ?? '' })
}

const showEditWholesaler = computed({
  get: () => editingWholesaler.value !== null,
  set: (v) => { if (!v) editingWholesaler.value = null }
})

async function saveWholesaler() {
  if (!editingWholesaler.value) return
  savingWholesaler.value = true
  try {
    await api(`/admin/sourcing/wholesalers/${editingWholesaler.value.id}`, {
      method: 'PATCH',
      body: {
        name: editForm.name,
        country: editForm.country || null,
        contactName: editForm.contactName || null,
        contactPhone: editForm.contactPhone || null,
        contactEmail: editForm.contactEmail || null,
        website: editForm.website || null,
        notes: editForm.notes || null
      }
    })
    editingWholesaler.value = null
    await refreshWholesalers()
    toast.add({ title: 'Wholesaler updated', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to update wholesaler', color: 'error' })
  } finally {
    savingWholesaler.value = false
  }
}

async function deleteWholesaler(w: WholesalerView) {
  try {
    await api(`/admin/sourcing/wholesalers/${w.id}`, { method: 'DELETE' })
    await refreshWholesalers()
    toast.add({ title: 'Wholesaler removed', color: 'success' })
  } catch {
    toast.add({ title: w.requestCount > 0 ? 'Cannot remove — it has sourcing requests' : 'Failed to remove wholesaler', color: 'error' })
  }
}

void productsPending
void wholesalersPending
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Product Sourcing">
        <template #leading><UDashboardSidebarCollapse /></template>
        <template #right>
          <UButton v-if="activeTab === 'products'" icon="i-lucide-plus" size="sm" label="New sourced product" @click="openCreateProduct" />
          <UButton v-else icon="i-lucide-plus" size="sm" label="New wholesaler" @click="openCreateWholesaler" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-6xl space-y-5">
        <UTabs
          v-model="activeTab"
          :items="[
            { label: 'Sourced Products', value: 'products', icon: 'i-lucide-search' },
            { label: 'Wholesalers', value: 'wholesalers', icon: 'i-lucide-warehouse' }
          ]"
        />

        <!-- Sourced Products Tab -->
        <div v-show="activeTab === 'products'" class="admin-table-wrap">
          <table class="admin-table w-full text-sm">
            <thead>
              <tr>
                <th class="px-4 py-2.5 text-left">Product</th>
                <th class="px-4 py-2.5 text-left">Niche</th>
                <th class="px-4 py-2.5 text-left">Status</th>
                <th class="px-4 py-2.5 text-left">Linked product</th>
                <th class="px-4 py-2.5 text-right">Ad tests</th>
                <th class="px-4 py-2.5 text-right">Sourcing requests</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="productsPending"><td colspan="6" class="px-4 py-12 text-center text-muted">Loading…</td></tr>
              <tr v-else-if="!sourcedProducts?.length"><td colspan="6" class="px-4 py-12 text-center text-muted">No sourced products yet. Click "New sourced product" to start tracking one.</td></tr>
              <template v-else>
                <tr v-for="p in sourcedProducts" :key="p.id" class="cursor-pointer hover:bg-[var(--color-admin-row-hover)]" @click="router.push(`/sourcing/${p.id}`)">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <img v-if="p.imageUrl" :src="p.imageUrl" class="size-9 rounded-md object-cover" />
                      <div v-else class="flex size-9 items-center justify-center rounded-md bg-[var(--color-admin-surface-tint)]"><UIcon name="i-lucide-package-search" class="size-4 text-muted" /></div>
                      <span class="font-medium text-highlighted">{{ p.name }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-muted">{{ p.niche || '—' }}</td>
                  <td class="px-4 py-3"><UBadge :color="statusColor[p.status]" variant="subtle">{{ p.status }}</UBadge></td>
                  <td class="px-4 py-3 text-muted">
                    <NuxtLink v-if="p.linkedProduct" :to="`/products/${p.linkedProduct.id}`" class="text-primary hover:underline" @click.stop>{{ p.linkedProduct.name }}</NuxtLink>
                    <span v-else>—</span>
                  </td>
                  <td class="tabular px-4 py-3 text-right">{{ p.adTestCount }}</td>
                  <td class="tabular px-4 py-3 text-right">{{ p.sourcingRequestCount }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <!-- Wholesalers Tab -->
        <div v-show="activeTab === 'wholesalers'" class="admin-table-wrap">
          <table class="admin-table w-full text-sm">
            <thead>
              <tr>
                <th class="px-4 py-2.5 text-left">Name</th>
                <th class="px-4 py-2.5 text-left">Country</th>
                <th class="px-4 py-2.5 text-left">Contact</th>
                <th class="px-4 py-2.5 text-right">Requests</th>
                <th class="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="wholesalersPending"><td colspan="5" class="px-4 py-12 text-center text-muted">Loading…</td></tr>
              <tr v-else-if="!wholesalers?.length"><td colspan="5" class="px-4 py-12 text-center text-muted">No wholesalers yet. Click "New wholesaler" to add one.</td></tr>
              <template v-else>
                <tr v-for="w in wholesalers" :key="w.id">
                  <td class="px-4 py-3 font-medium text-highlighted">{{ w.name }}</td>
                  <td class="px-4 py-3 text-muted">{{ w.country || '—' }}</td>
                  <td class="px-4 py-3 text-muted">
                    <div v-if="w.contactName || w.contactPhone || w.contactEmail">
                      <p v-if="w.contactName">{{ w.contactName }}</p>
                      <p v-if="w.contactPhone" class="text-xs">{{ w.contactPhone }}</p>
                      <p v-if="w.contactEmail" class="text-xs">{{ w.contactEmail }}</p>
                    </div>
                    <span v-else>—</span>
                  </td>
                  <td class="tabular px-4 py-3 text-right">{{ w.requestCount }}</td>
                  <td class="px-4 py-3 text-right">
                    <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" @click="openEditWholesaler(w)" />
                    <UButton icon="i-lucide-trash-2" size="xs" variant="ghost" color="error" @click="deleteWholesaler(w)" />
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Create sourced product modal -->
      <UModal v-model:open="showCreateProduct">
        <template #content>
          <div class="space-y-4 p-6">
            <h3 class="text-lg font-semibold">New sourced product</h3>
            <UFormField label="Name"><UInput v-model="newProductName" class="w-full" placeholder="e.g. Portable Neck Fan" /></UFormField>
            <UFormField label="Niche"><UInput v-model="newProductNiche" class="w-full" placeholder="e.g. Summer gadgets" /></UFormField>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" label="Cancel" @click="showCreateProduct = false" />
              <UButton :loading="creatingProduct" :disabled="!newProductName.trim()" color="primary" label="Create" @click="createProduct" />
            </div>
          </div>
        </template>
      </UModal>

      <!-- Create wholesaler modal -->
      <UModal v-model:open="showCreateWholesaler">
        <template #content>
          <div class="space-y-4 p-6">
            <h3 class="text-lg font-semibold">New wholesaler</h3>
            <UFormField label="Name"><UInput v-model="newWholesaler.name" class="w-full" /></UFormField>
            <UFormField label="Country"><UInput v-model="newWholesaler.country" class="w-full" /></UFormField>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <UFormField label="Contact name"><UInput v-model="newWholesaler.contactName" class="w-full" /></UFormField>
              <UFormField label="Contact phone"><UInput v-model="newWholesaler.contactPhone" class="w-full" /></UFormField>
            </div>
            <UFormField label="Contact email"><UInput v-model="newWholesaler.contactEmail" class="w-full" /></UFormField>
            <UFormField label="Website"><UInput v-model="newWholesaler.website" class="w-full" /></UFormField>
            <UFormField label="Notes"><UTextarea v-model="newWholesaler.notes" class="w-full" :rows="3" /></UFormField>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" label="Cancel" @click="showCreateWholesaler = false" />
              <UButton :loading="creatingWholesaler" :disabled="!newWholesaler.name.trim()" color="primary" label="Create" @click="createWholesaler" />
            </div>
          </div>
        </template>
      </UModal>

      <!-- Edit wholesaler modal -->
      <UModal v-model:open="showEditWholesaler">
        <template #content>
          <div class="space-y-4 p-6">
            <h3 class="text-lg font-semibold">Edit wholesaler</h3>
            <UFormField label="Name"><UInput v-model="editForm.name" class="w-full" /></UFormField>
            <UFormField label="Country"><UInput v-model="editForm.country" class="w-full" /></UFormField>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <UFormField label="Contact name"><UInput v-model="editForm.contactName" class="w-full" /></UFormField>
              <UFormField label="Contact phone"><UInput v-model="editForm.contactPhone" class="w-full" /></UFormField>
            </div>
            <UFormField label="Contact email"><UInput v-model="editForm.contactEmail" class="w-full" /></UFormField>
            <UFormField label="Website"><UInput v-model="editForm.website" class="w-full" /></UFormField>
            <UFormField label="Notes"><UTextarea v-model="editForm.notes" class="w-full" :rows="3" /></UFormField>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" label="Cancel" @click="showEditWholesaler = false" />
              <UButton :loading="savingWholesaler" color="primary" label="Save" @click="saveWholesaler" />
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
