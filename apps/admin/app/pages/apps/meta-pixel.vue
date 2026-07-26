<script setup lang="ts">
import type { AppInstallationView, MetaPixelConfig } from '@amalice/shared'

definePageMeta({ requiredRole: 'SuperAdmin' })
useHead({ title: 'Meta Pixel' })

const api = useAdminApi()
const toast = useToast()

const { data: apps, pending } = await useAdminFetch<AppInstallationView[]>('/admin/apps', { key: 'admin-apps' })
const app = computed(() => apps.value?.find((a) => a.appId === 'meta-pixel'))

// Local editable copies — apply on save, not on click (same pattern as
// settings/storefront.vue).
const enabled = ref(false)
const pixelId = ref('')

watchEffect(() => {
  if (app.value) {
    enabled.value = app.value.enabled
    pixelId.value = (app.value.config as MetaPixelConfig | null)?.pixelId ?? ''
  }
})

const saving = ref(false)
const dirty = computed(() => !!app.value && (
  enabled.value !== app.value.enabled ||
  pixelId.value !== ((app.value.config as MetaPixelConfig | null)?.pixelId ?? '')
))

async function save() {
  if (!dirty.value) return
  saving.value = true
  try {
    const updated = await api<AppInstallationView>('/admin/apps/meta-pixel', {
      method: 'PUT',
      body: { enabled: enabled.value, config: { pixelId: pixelId.value || null } }
    })
    if (apps.value) {
      const idx = apps.value.findIndex((a) => a.appId === 'meta-pixel')
      if (idx >= 0) apps.value[idx] = updated
    }
    toast.add({ title: 'Meta Pixel updated', color: 'success' })
  } catch {
    toast.add({ title: 'Update failed', description: 'Check the Pixel ID is a valid 10-20 digit number.', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Meta Pixel">
        <template #leading><UDashboardSidebarCollapse /></template>
        <template #trailing>
          <UButton to="/apps" variant="ghost" color="neutral" icon="i-lucide-arrow-left" size="sm">Apps</UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="pending" class="py-24 text-center text-muted">Loading…</div>
      <div v-else class="max-w-2xl space-y-8">
        <div class="flex items-start gap-4">
          <div class="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UIcon name="i-lucide-target" class="size-6" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-highlighted">Meta Pixel</h2>
            <p class="text-sm text-muted">Track page views, add-to-cart, and purchase events for Meta (Facebook/Instagram) ad retargeting and measurement.</p>
          </div>
        </div>

        <section class="admin-kpi-card space-y-5 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-highlighted">Enable Meta Pixel</p>
              <p class="text-sm text-muted">When on, the pixel script loads on every storefront page.</p>
            </div>
            <USwitch v-model="enabled" />
          </div>

          <UFormField label="Pixel ID" help="Find this in Meta Events Manager — a 15-16 digit number.">
            <UInput v-model="pixelId" placeholder="1234567890123456" class="w-full max-w-sm" />
          </UFormField>

          <p v-if="enabled && !pixelId" class="flex items-center gap-1.5 text-sm text-warning">
            <UIcon name="i-lucide-alert-triangle" class="size-4" />
            Enabled but no Pixel ID set — nothing will be tracked yet.
          </p>
        </section>

        <div class="sticky bottom-4 flex items-center justify-between rounded-md border border-[var(--color-admin-border)] bg-[var(--color-admin-surface)] px-5 py-3 shadow-[var(--shadow-admin-md)]">
          <p class="text-sm" :class="dirty ? 'text-highlighted' : 'text-muted'">
            {{ dirty ? 'Unsaved changes.' : 'All changes saved.' }}
          </p>
          <UButton :loading="saving" :disabled="!dirty" color="primary" icon="i-lucide-check" @click="save">Save</UButton>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
