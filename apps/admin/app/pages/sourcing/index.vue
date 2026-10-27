<script setup lang="ts">

import type { SourcedProductListItem, SourcedProductStatus } from '@amalice/shared'

// Product Sourcing / Ad-Testing operations — deliberately separate from the
// live storefront-facing Product catalog (see SourcedProduct's Prisma
// comment): research-phase noise (ad spend, creative experiments) never
// touches the real Product model until a candidate is explicitly linked
// once it goes live. No supplier/wholesaler tracking here — that concept
// was removed; sourcing requests are just "we requested N units."
useHead({ title: 'Product Sourcing' })

const router = useRouter()
const api = useAdminApi()
const toast = useToast()

const { data: sourcedProducts, pending: productsPending, refresh: refreshSourced } = await useAdminFetch<SourcedProductListItem[]>('/admin/sourcing/products', { key: 'admin-sourcing-products' })

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

void productsPending

// ---- Bulk select + permanent delete (SuperAdmin only) ----
const { isSuperAdmin } = useDangerDelete()
const { selected: selIds, allChecked: selAll, indeterminate: selSome, toggleAll: selToggleAll, toggle: selToggle, clear: selClear, count: selCount } = useBulkSelect(computed(() => sourcedProducts.value ?? []))
const { bulkDelete, busy: bulkBusy } = useBulkDelete()
const bulkApi = useAdminApi()

async function deleteSelected() {
  const deleted = await bulkDelete([...selIds.value], { noun: 'sourced product', remove: (id) => bulkApi(`/admin/sourcing/products/__ID__`.replace('__ID__', id), { method: 'DELETE' }) })
  if (deleted.length) {
    selClear()
    await refreshSourced()
  }
}
</script>

<template>
  <AdsPage title="Product sourcing" :description="`${sourcedProducts?.length ?? 0} products · Candidate products, ad tests and supplier requests`">
    <template #actions>
      <button class="btn btn-primary" type="button" @click="openCreateProduct"><AdsIcon name="i-lucide-plus" />New sourced product</button>
    </template>

    <section class="card" aria-label="Sourced products">
      <BulkBar v-if="isSuperAdmin" :count="selCount" :busy="bulkBusy" can-delete @delete="deleteSelected" @clear="selClear" />
      <div class="table-wrap">
        <table style="min-width: 760px">
          <thead><tr><th v-if="isSuperAdmin" style="width: 28px"><input type="checkbox" aria-label="Select all" :checked="selAll" :indeterminate="selSome" @change="selToggleAll(($event.target as HTMLInputElement).checked)"></th><th>Product</th><th>Niche</th><th>Status</th><th>Linked product</th><th class="num">Ad tests</th><th class="num">Sourcing requests</th></tr></thead>
          <tbody>
            <tr v-if="productsPending"><td :colspan="6 + (isSuperAdmin ? 1 : 0)" class="empty">Loading…</td></tr>
            <tr v-else-if="!sourcedProducts?.length"><td :colspan="6 + (isSuperAdmin ? 1 : 0)" class="empty">No sourced products yet. Click “New sourced product” to start tracking one.</td></tr>
            <tr v-for="p in sourcedProducts" v-else :key="p.id" class="clickable" @click="router.push(`/sourcing/${p.id}`)"><td v-if="isSuperAdmin" @click.stop><input type="checkbox" :aria-label="`Select ${p.name}`" :checked="selIds.has(p.id)" @change="selToggle(p.id, ($event.target as HTMLInputElement).checked)"></td>
              <td>
                <div class="prod">
                  <img v-if="p.imageUrl" :src="p.imageUrl" class="thumb" style="object-fit: cover" alt="">
                  <span v-else class="thumb"><AdsIcon name="i-lucide-package-search" /></span>
                  <span class="strong">{{ p.name }}</span>
                </div>
              </td>
              <td class="muted">{{ p.niche || '—' }}</td>
              <td><AdsBadge :color="statusColor[p.status]" variant="subtle">{{ p.status }}</AdsBadge></td>
              <td>
                <NuxtLink v-if="p.linkedProduct" :to="`/products/${p.linkedProduct.id}`" class="link-cell" @click.stop>{{ p.linkedProduct.name }}</NuxtLink>
                <span v-else class="muted">—</span>
              </td>
              <td class="num">{{ p.adTestCount }}</td>
              <td class="num">{{ p.sourcingRequestCount }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <AdsDialog v-model:open="showCreateProduct" title="New sourced product" width="sm">
      <AdsField label="Name"><AdsInput v-model="newProductName" placeholder="e.g. Portable Neck Fan" /></AdsField>
      <AdsField label="Niche"><AdsInput v-model="newProductNiche" placeholder="e.g. Summer gadgets" /></AdsField>
      <template #footer>
        <button class="btn" type="button" @click="showCreateProduct = false">Cancel</button>
        <AdsButton :loading="creatingProduct" :disabled="!newProductName.trim()" @click="createProduct">Create</AdsButton>
      </template>
    </AdsDialog>
  </AdsPage>
</template>
