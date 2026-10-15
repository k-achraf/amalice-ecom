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
  <AdsPage title="Google Sheets" description="Orders sync app">
    <template #actions>
      <AdsButton appearance="default" icon="i-lucide-refresh-cw" :loading="syncing" @click="syncNow">Sync now</AdsButton>
      <NuxtLink to="/apps" class="btn"><AdsIcon name="i-lucide-arrow-left" />Apps</NuxtLink>
    </template>

    <div v-if="pending" class="empty">Loading…</div>
    <div v-else class="stack" style="width: 100%; max-width: 820px">
      <div class="prod" style="align-items: flex-start">
        <span class="app-logo" style="background: var(--teal); color: var(--ivory)" aria-hidden="true"><AdsIcon name="i-lucide-table" /></span>
        <div class="grow">
          <h2 style="font-size: 18px">Google Sheets</h2>
          <p class="muted">
            Push every order to a connected Google Sheet as it comes in, and keep its status columns in sync as you
            work the order. Connect as many sheets as you like — route all products to one sheet, or spread
            different products across different sheets.
          </p>
          <p class="muted" style="margin-top: 8px">
            The Shipping Company, Call Center Status, Fulfillment Status, Delivery Status, and Notes columns are
            editable directly in the sheet — pick from the dropdown or type a note, and it's pulled back in
            automatically within a couple of minutes, or immediately with “Sync now” above. “Sent to Shipping
            Company” is display-only (it only turns Yes once a real dispatch happens) — editing it in the sheet
            won't do anything.
          </p>
        </div>
      </div>

      <section class="card" aria-label="Master switch">
        <div class="setting">
          <div class="text"><b>Enable Google Sheets</b><span>Master switch — when off, no sheet (even an enabled one below) receives pushes or status updates.</span></div>
          <AdsSwitch :model-value="app?.enabled ?? false" :disabled="togglingMaster" aria-label="Enable Google Sheets" @update:model-value="toggleMaster" />
        </div>
      </section>

      <section class="card" aria-label="Connected sheets">
        <div class="card-head">
          <h2>Connected sheets</h2>
          <button class="btn btn-sm btn-primary" type="button" @click="openCreate"><AdsIcon name="i-lucide-plus" />Connect a sheet</button>
        </div>

        <AdsEmptyState v-if="!sheets?.length" icon="i-lucide-table" title="No sheets connected yet" description="Connect a Google Sheet to start pushing orders to it." />

        <ul v-else class="list">
          <li v-for="sheet in sheets" :key="sheet.id" style="align-items: flex-start; padding: 14px 0">
            <div class="grow" style="min-width: 0">
              <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px">
                <a :href="sheet.sheetUrl" target="_blank" rel="noopener" class="link-cell">{{ sheet.name }}</a>
                <span v-if="sheet.enabled" class="pill confirmed">Enabled</span>
                <span v-else class="pill neutral">Disabled</span>
              </div>
              <p class="muted">Tab: {{ sheet.sheetName }}</p>
              <p class="muted" style="margin-top: 4px">
                <template v-if="sheet.appliesToAllProducts">Receives every order, regardless of product.</template>
                <template v-else-if="sheet.products.length">Receives orders for: {{ sheet.products.map((p) => p.name).join(', ') }}</template>
                <template v-else>No products mapped yet — this sheet won't receive any orders.</template>
              </p>
            </div>
            <div style="display: flex; gap: 4px; flex-shrink: 0">
              <AdsButton square appearance="subtle" size="sm" icon="i-lucide-plug-zap" :loading="testingId === sheet.id" title="Test connection" aria-label="Test connection" @click="testConnection(sheet)" />
              <AdsButton square appearance="subtle" size="sm" icon="i-lucide-pencil" title="Edit" aria-label="Edit" @click="openEdit(sheet)" />
              <AdsButton square appearance="subtle" size="sm" icon="i-lucide-trash-2" :loading="deletingId === sheet.id" title="Disconnect" aria-label="Disconnect" @click="removeSheet(sheet)" />
            </div>
          </li>
        </ul>
      </section>
    </div>
  </AdsPage>

  <AdsDialog v-model:open="showModal" :title="editingId ? 'Edit sheet' : 'Connect a sheet'">
    <AdsField label="Label" help="For your own reference — not sent to Google.">
      <AdsInput v-model="form.name" placeholder="Main orders sheet" />
    </AdsField>

    <AdsField label="Spreadsheet URL" help="Paste the sheet's URL from your browser's address bar.">
      <AdsInput v-model="form.spreadsheetUrl" placeholder="https://docs.google.com/spreadsheets/d/…/edit" />
    </AdsField>

    <AdsField label="Tab name" help="Created automatically on first push if it doesn't exist yet.">
      <AdsInput v-model="form.sheetName" placeholder="Orders" />
    </AdsField>

    <div class="setting">
      <div class="text"><b>Applies to all products</b><span>Every order pushes here, regardless of what was bought.</span></div>
      <AdsSwitch v-model="form.appliesToAllProducts" aria-label="Applies to all products" />
    </div>

    <AdsField v-if="!form.appliesToAllProducts" label="Products" help="Only orders containing at least one of these products push to this sheet.">
      <AdsSelect v-model="form.productIds" :items="productOptions.map((p) => ({ label: p.name, value: p.id }))" value-key="value" multiple placeholder="Choose products…" />
    </AdsField>

    <div class="setting">
      <div class="text"><b>Enabled</b><span>Turn off to pause pushes to just this sheet without disconnecting it.</span></div>
      <AdsSwitch v-model="form.enabled" aria-label="Enabled" />
    </div>

    <template #footer>
      <button class="btn" type="button" @click="showModal = false">Cancel</button>
      <AdsButton :loading="saving" icon="i-lucide-check" @click="submitForm">{{ editingId ? 'Save' : 'Connect' }}</AdsButton>
    </template>
  </AdsDialog>
</template>
