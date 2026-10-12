<script setup lang="ts">
import type { AppInstallationView } from '@amalice/shared'

definePageMeta({ requiredRole: 'SuperAdmin' })
useHead({ title: 'Apps' })

const { data: apps, pending } = await useAdminFetch<AppInstallationView[]>('/admin/apps', { key: 'admin-apps' })

// ---- Design chrome: tabs, category chips, search ----
const view = ref<'all' | 'installed'>('all')
const cat = ref('All')
const search = ref('')
const cats = computed(() => ['All', ...new Set((apps.value ?? []).map((a) => a.category))])
const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (apps.value ?? []).filter((a) =>
    (view.value === 'all' || a.enabled) && (cat.value === 'All' || a.category === cat.value) && (!q || `${a.name} ${a.description}`.toLowerCase().includes(q))
  )
})

</script>

<template>
  <AdsPage title="Apps" description="Add tracking, messaging and sales tools to your store">
    <template #actions>
      <label class="search"><AdsIcon name="i-lucide-search" /><span class="sr">Search apps</span><input v-model="search" type="search" placeholder="Search apps"></label>
    </template>

    <div v-if="pending" class="empty">Loading…</div>
    <template v-else>
      <div class="tabs" role="tablist" aria-label="Apps view">
        <button type="button" role="tab" :aria-selected="view === 'all'" @click="view = 'all'">All apps</button>
        <button type="button" role="tab" :aria-selected="view === 'installed'" @click="view = 'installed'">Installed <span class="pill neutral" style="margin-left: 4px">{{ (apps ?? []).filter((a) => a.enabled).length }}</span></button>
      </div>
      <AdsTabs v-model="cat" :items="cats.map((c) => ({ label: c, value: c }))" />

      <div class="cards-grid">
        <p v-if="!shown.length" class="empty" style="grid-column: 1 / -1">No apps match your search.</p>
        <article v-for="app in shown" :key="app.appId" class="app-card">
          <div class="top">
            <span class="app-logo" style="background: var(--teal); color: var(--ivory)" aria-hidden="true"><AdsIcon :name="app.icon" /></span>
            <div class="grow"><h3>{{ app.name }}</h3><span class="by">{{ app.category }}</span></div>
            <span v-if="app.enabled" class="pill installed">Connected</span>
            <span v-else class="pill outline">{{ app.category }}</span>
          </div>
          <p>{{ app.description }}</p>
          <div class="foot">
            <span class="grow muted">{{ app.enabled ? 'On' : 'Not connected' }}</span>
            <NuxtLink class="btn btn-sm" :class="{ 'btn-primary': !app.enabled }" :to="`/apps/${app.appId}`"><AdsIcon :name="app.enabled ? 'i-lucide-settings' : 'i-lucide-plus'" />{{ app.enabled ? 'Settings' : 'Connect' }}</NuxtLink>
          </div>
        </article>
      </div>
    </template>
  </AdsPage>
</template>
