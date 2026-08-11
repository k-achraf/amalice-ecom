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

const { data: sourcedProducts, pending: productsPending } = await useAdminFetch<SourcedProductListItem[]>('/admin/sourcing/products', { key: 'admin-sourcing-products' })

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
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Product Sourcing">
        <template #leading><UDashboardSidebarCollapse /></template>
        <template #right>
          <UButton icon="i-lucide-plus" size="sm" aria-label="New sourced product" @click="openCreateProduct">
            <span class="hidden sm:inline">New sourced product</span>
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-6xl space-y-5">
        <div class="admin-table-wrap">
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
    </template>
  </UDashboardPanel>
</template>
