<script setup lang="ts">
import type { AppInstallationView } from '@amalice/shared'

definePageMeta({ requiredRole: 'SuperAdmin' })
useHead({ title: 'Apps' })

const { data: apps, pending } = await useAdminFetch<AppInstallationView[]>('/admin/apps', { key: 'admin-apps' })
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Apps">
        <template #leading><UDashboardSidebarCollapse /></template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="pending" class="py-24 text-center text-muted">Loading…</div>
      <div v-else class="max-w-5xl space-y-6">
        <div>
          <h2 class="text-lg font-semibold text-highlighted">Installed &amp; available apps</h2>
          <p class="text-sm text-muted">Connect third-party tools to your storefront — analytics, marketing pixels, and more.</p>
        </div>

        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <NuxtLink
            v-for="app in apps"
            :key="app.appId"
            :to="`/apps/${app.appId}`"
            class="admin-kpi-card group flex flex-col gap-4 p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-admin-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div class="flex items-start justify-between">
              <div class="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UIcon :name="app.icon" class="size-6" />
              </div>
              <UBadge v-if="app.enabled" color="success" variant="subtle" size="sm">Connected</UBadge>
              <UBadge v-else color="neutral" variant="subtle" size="sm">Not connected</UBadge>
            </div>
            <div>
              <h3 class="font-semibold text-highlighted">{{ app.name }}</h3>
              <p class="mt-1 text-xs uppercase tracking-wide text-muted">{{ app.category }}</p>
              <p class="mt-2 text-sm text-muted">{{ app.description }}</p>
            </div>
          </NuxtLink>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
