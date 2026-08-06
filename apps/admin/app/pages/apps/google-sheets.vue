<script setup lang="ts">
import type { AppInstallationView, GoogleSheetView, TestGoogleSheetResult } from '@amalice/shared'

definePageMeta({ requiredRole: 'SuperAdmin' })
useHead({ title: 'Google Sheets' })

const api = useAdminApi()
const toast = useToast()

const { data: apps, pending: appsPending, refresh: refreshApps } = await useAdminFetch<AppInstallationView[]>('/admin/apps', { key: 'admin-apps' })
const app = computed(() => apps.value?.find((a) => a.appId === 'google-sheets'))

const { data: sheets, pending: sheetsPending, refresh: refreshSheets } = await useAdminFetch<GoogleSheetView[]>('/admin/google-sheets', { key: 'admin-google-sheets' })

interface ProductOption { id: string; name: string }
// pageSize capped at 100 by ProductListQuerySchema (packages/shared) — a
// larger value 400s the request, and useAdminFetch swallows that silently
// (data stays null, no toast), which is exactly what made this select look
// like it always had "No data" instead of surfacing an error.
const { data: productsRes } = await useAdminFetch<{ items: ProductOption[] }>('/admin/products?pageSize=100', { key: 'admin-products-for-sheets' })
const productOptions = computed(() => productsRes.value?.items ?? [])

// ---- Master on/off toggle — same generic AppInstallation switch every
// other app has, gates whether ANY sheet ever receives a push regardless of
// each sheet's own `enabled` flag. ----
const togglingMaster = ref(false)
async function toggleMaster(value: boolean) {
  togglingMaster.value = true
  try {
    await api('/admin/apps/google-sheets', { method: 'PUT', body: { enabled: value, config: {} } })
    await refreshApps()
    toast.add({ title: value ? 'Google Sheets enabled' : 'Google Sheets disabled', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to update', color: 'error' })
  } finally {
    togglingMaster.value = false
  }
}

// ---- Sheet create/edit modal ----
const showModal = ref(false)
const editingId = ref<string | null>(null)
const form = reactive({
  name: '',
  spreadsheetUrl: '',
  sheetName: 'Orders',
  appliesToAllProducts: false,
  enabled: true,
  productIds: [] as string[]
})
const saving = ref(false)

function openCreate() {
  editingId.value = null
  form.name = ''
  form.spreadsheetUrl = ''
  form.sheetName = 'Orders'
  form.appliesToAllProducts = false
  form.enabled = true
  form.productIds = []
  showModal.value = true
}

function openEdit(sheet: GoogleSheetView) {
  editingId.value = sheet.id
  form.name = sheet.name
  form.spreadsheetUrl = sheet.sheetUrl
  form.sheetName = sheet.sheetName
  form.appliesToAllProducts = sheet.appliesToAllProducts
  form.enabled = sheet.enabled
  form.productIds = sheet.products.map((p) => p.id)
  showModal.value = true
}

async function submitForm() {
  if (!form.name.trim() || !form.spreadsheetUrl.trim()) {
    toast.add({ title: 'Name and spreadsheet URL are required', color: 'warning' })
    return
  }
  saving.value = true
  try {
    const body = {
      name: form.name.trim(),
      spreadsheetUrl: form.spreadsheetUrl.trim(),
      sheetName: form.sheetName.trim() || 'Orders',
      appliesToAllProducts: form.appliesToAllProducts,
      enabled: form.enabled,
      productIds: form.productIds
    }
    if (editingId.value) {
      await api(`/admin/google-sheets/${editingId.value}`, { method: 'PUT', body })
      toast.add({ title: 'Sheet updated', color: 'success' })
    } else {
      await api('/admin/google-sheets', { method: 'POST', body })
      toast.add({ title: 'Sheet connected', color: 'success' })
    }
    showModal.value = false
    await refreshSheets()
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Failed to save', description: data?.message, color: 'error' })
  } finally {
    saving.value = false
  }
}

// ---- Delete ----
const deletingId = ref<string | null>(null)
async function removeSheet(sheet: GoogleSheetView) {
  if (!confirm(`Disconnect "${sheet.name}"? Orders will stop being pushed to it.`)) return
  deletingId.value = sheet.id
  try {
    await api(`/admin/google-sheets/${sheet.id}`, { method: 'DELETE' })
    await refreshSheets()
    toast.add({ title: 'Sheet disconnected', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to disconnect', color: 'error' })
  } finally {
    deletingId.value = null
  }
}

// ---- Test connection ----
const testingId = ref<string | null>(null)
async function testConnection(sheet: GoogleSheetView) {
  testingId.value = sheet.id
  try {
    const result = await api<TestGoogleSheetResult>(`/admin/google-sheets/${sheet.id}/test-connection`, { method: 'POST' })
    toast.add({ title: 'Connection OK', description: result.message, color: 'success' })
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Connection failed', description: data?.message, color: 'error' })
  } finally {
    testingId.value = null
  }
}

// ---- Manual pull sync — pulls back any manual edits made directly in a
// connected sheet's editable columns (shipping company, the 3 status
// columns, notes) right now, instead of waiting for the repeatable poll job
// (every 2 minutes — see GoogleSheetsService.onModuleInit) to pick them up.
const syncing = ref(false)
async function syncNow() {
  syncing.value = true
  try {
    await api('/admin/google-sheets/sync-now', { method: 'POST' })
    toast.add({ title: 'Synced from Google Sheets', color: 'success' })
  } catch (err) {
    const data = (err as { data?: { message?: string } })?.data
    toast.add({ title: 'Sync failed', description: data?.message, color: 'error' })
  } finally {
    syncing.value = false
  }
}

const pending = computed(() => appsPending.value || sheetsPending.value)
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Google Sheets">
        <template #leading><UDashboardSidebarCollapse /></template>
        <template #trailing>
          <UButton icon="i-lucide-refresh-cw" variant="ghost" color="neutral" size="sm" :loading="syncing" @click="syncNow">Sync now</UButton>
          <UButton to="/apps" variant="ghost" color="neutral" icon="i-lucide-arrow-left" size="sm">Apps</UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="pending" class="py-24 text-center text-muted">Loading…</div>
      <div v-else class="max-w-3xl space-y-8">
        <div class="flex items-start gap-4">
          <div class="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UIcon name="i-lucide-table" class="size-6" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-highlighted">Google Sheets</h2>
            <p class="text-sm text-muted">
              Push every order to a connected Google Sheet as it comes in, and keep its status columns in sync as you
              work the order. Connect as many sheets as you like — route all products to one sheet, or spread
              different products across different sheets.
            </p>
            <p class="mt-2 text-sm text-muted">
              The Shipping Company, Call Center Status, Fulfillment Status, Delivery Status, and Notes columns are
              editable directly in the sheet — pick from the dropdown or type a note, and it's pulled back in
              automatically within a couple of minutes, or immediately with "Sync now" above. "Sent to Shipping
              Company" is display-only (it only turns Yes once a real dispatch happens) — editing it in the sheet
              won't do anything.
            </p>
          </div>
        </div>

        <section class="admin-kpi-card space-y-2 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-highlighted">Enable Google Sheets</p>
              <p class="text-sm text-muted">Master switch — when off, no sheet (even an enabled one below) receives pushes or status updates.</p>
            </div>
            <USwitch :model-value="app?.enabled ?? false" :disabled="togglingMaster" @update:model-value="toggleMaster" />
          </div>
        </section>

        <section class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-medium text-muted">Connected sheets</h3>
            <UButton icon="i-lucide-plus" color="primary" variant="soft" size="sm" @click="openCreate">Connect a sheet</UButton>
          </div>

          <EmptyState v-if="!sheets?.length" icon="i-lucide-table" title="No sheets connected yet" description="Connect a Google Sheet to start pushing orders to it." />

          <div v-for="sheet in sheets" :key="sheet.id" class="admin-kpi-card space-y-3 p-5">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <a :href="sheet.sheetUrl" target="_blank" rel="noopener" class="truncate font-medium text-highlighted hover:underline">{{ sheet.name }}</a>
                  <UBadge v-if="sheet.enabled" color="success" variant="subtle" size="sm">Enabled</UBadge>
                  <UBadge v-else color="neutral" variant="subtle" size="sm">Disabled</UBadge>
                </div>
                <p class="text-xs text-muted">Tab: {{ sheet.sheetName }}</p>
                <p class="mt-1 text-sm text-muted">
                  <template v-if="sheet.appliesToAllProducts">Receives every order, regardless of product.</template>
                  <template v-else-if="sheet.products.length">Receives orders for: {{ sheet.products.map(p => p.name).join(', ') }}</template>
                  <template v-else>No products mapped yet — this sheet won't receive any orders.</template>
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <UButton icon="i-lucide-plug-zap" color="neutral" variant="ghost" size="sm" :loading="testingId === sheet.id" title="Test connection" @click="testConnection(sheet)" />
                <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" title="Edit" @click="openEdit(sheet)" />
                <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" :loading="deletingId === sheet.id" title="Disconnect" @click="removeSheet(sheet)" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </template>
  </UDashboardPanel>

  <UModal v-model:open="showModal">
    <template #content>
      <div class="space-y-4 p-6">
        <h3 class="text-lg font-semibold">{{ editingId ? 'Edit sheet' : 'Connect a sheet' }}</h3>

        <UFormField label="Label" help="For your own reference — not sent to Google.">
          <UInput v-model="form.name" placeholder="Main orders sheet" class="w-full" />
        </UFormField>

        <UFormField label="Spreadsheet URL" help="Paste the sheet's URL from your browser's address bar.">
          <UInput v-model="form.spreadsheetUrl" placeholder="https://docs.google.com/spreadsheets/d/…/edit" class="w-full" />
        </UFormField>

        <UFormField label="Tab name" help="Created automatically on first push if it doesn't exist yet.">
          <UInput v-model="form.sheetName" placeholder="Orders" class="w-full" />
        </UFormField>

        <div class="flex items-center justify-between rounded-md border border-[var(--color-admin-border)] p-3">
          <div>
            <p class="text-sm font-medium text-highlighted">Applies to all products</p>
            <p class="text-xs text-muted">Every order pushes here, regardless of what was bought.</p>
          </div>
          <USwitch v-model="form.appliesToAllProducts" />
        </div>

        <UFormField v-if="!form.appliesToAllProducts" label="Products" help="Only orders containing at least one of these products push to this sheet.">
          <USelectMenu
            v-model="form.productIds"
            :items="productOptions.map(p => ({ label: p.name, value: p.id }))"
            value-key="value"
            multiple
            placeholder="Choose products…"
            class="w-full"
          />
        </UFormField>

        <div class="flex items-center justify-between rounded-md border border-[var(--color-admin-border)] p-3">
          <div>
            <p class="text-sm font-medium text-highlighted">Enabled</p>
            <p class="text-xs text-muted">Turn off to pause pushes to just this sheet without disconnecting it.</p>
          </div>
          <USwitch v-model="form.enabled" />
        </div>

        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="showModal = false">Cancel</UButton>
          <UButton :loading="saving" color="primary" icon="i-lucide-check" @click="submitForm">{{ editingId ? 'Save' : 'Connect' }}</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
