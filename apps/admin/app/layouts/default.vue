<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { AdminRoleName } from '@amalice/shared'

const auth = useAuthStore()
const colorMode = useColorMode()

// ADM-01 — role-filtered nav. Client-side hiding is UX only; the server
// re-checks every route via JwtAuthGuard + RolesGuard (plan §ADM-02). Each
// item lists the roles allowed to see it; a Warehouse user sees only
// inventory, per plan §8's role table.
const allLinks: (NavigationMenuItem & { roles: AdminRoleName[] })[] = [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/', roles: ['SuperAdmin', 'OpsManager', 'Finance', 'Warehouse'] },
  { label: 'Orders', icon: 'i-lucide-package', to: '/orders', roles: ['SuperAdmin', 'OpsManager', 'Finance', 'Support'] },
  { label: 'Call Center', icon: 'i-lucide-phone-call', to: '/call-center', roles: ['SuperAdmin', 'OpsManager', 'Support'] },
  { label: 'Abandoned Carts', icon: 'i-lucide-shopping-cart', to: '/abandoned-carts', roles: ['SuperAdmin', 'OpsManager', 'Support'] },
  { label: 'Inventory', icon: 'i-lucide-boxes', to: '/inventory', roles: ['SuperAdmin', 'OpsManager', 'Warehouse'] },
  { label: 'Customers', icon: 'i-lucide-users', to: '/customers', roles: ['SuperAdmin', 'OpsManager', 'Finance', 'Support'] },
  { label: 'Reconciliation', icon: 'i-lucide-receipt', to: '/reconciliation', roles: ['SuperAdmin', 'Finance'] },
  { label: 'Fulfillment', icon: 'i-lucide-package-check', to: '/fulfillment', roles: ['SuperAdmin', 'OpsManager'] },
  { label: 'Shipping', icon: 'i-lucide-truck', to: '/shipping', roles: ['SuperAdmin', 'OpsManager'] },
  { label: 'Product Sourcing', icon: 'i-lucide-search-code', to: '/sourcing', roles: ['SuperAdmin', 'OpsManager'] },
  { label: 'Users & Roles', icon: 'i-lucide-user-cog', to: '/users', roles: ['SuperAdmin'] },
  { label: 'Apps', icon: 'i-lucide-layout-grid', to: '/apps', roles: ['SuperAdmin'] },
  { label: 'Storefront', icon: 'i-lucide-palette', to: '/settings/storefront', roles: ['SuperAdmin'] },
  { label: 'Attributes', icon: 'i-lucide-layers', to: '/settings/attributes', roles: ['SuperAdmin'] },
  { label: 'Shipping Rates', icon: 'i-lucide-map-pinned', to: '/settings/shipping', roles: ['SuperAdmin', 'OpsManager'] },
  { label: 'Shipping Companies', icon: 'i-lucide-plug', to: '/settings/shipping-companies', roles: ['SuperAdmin', 'OpsManager'] },
  { label: 'Audit Log', icon: 'i-lucide-history', to: '/audit-log', roles: ['SuperAdmin', 'Finance', 'OpsManager'] }
]

const links = computed<NavigationMenuItem[]>(() =>
  allLinks
    .filter((l) => auth.role && l.roles.includes(auth.role))
    .map(({ roles: _roles, ...item }) => item)
)

async function logout() {
  auth.clear()
  await navigateTo('/login')
}
</script>

<template>
  <div class="admin-surface">
    <UDashboardGroup storage="local" storage-key="amalice-admin-sidebar">
      <UDashboardSidebar collapsible resizable :ui="{ footer: 'border-t border-default' }">
        <template #header="{ collapsed }">
          <NuxtLink to="/" class="flex items-center gap-2">
            <span v-if="!collapsed" class="truncate text-lg font-semibold text-highlighted">Amalice Admin</span>
            <UIcon v-else name="i-lucide-package" class="mx-auto size-5 text-primary" />
          </NuxtLink>
        </template>

        <template #default="{ collapsed }">
          <UNavigationMenu :collapsed="collapsed" :items="links" orientation="vertical" />
        </template>

        <template #footer="{ collapsed }">
          <!-- User chip + logout -->
          <div v-if="!collapsed" class="px-2 pb-2">
            <UDropdownMenu
              :items="[
                [{ label: auth.user?.email, disabled: true }],
                [{ label: `${auth.role}`, disabled: true }],
                [{ label: 'Sign out', icon: 'i-lucide-log-out', onSelect: logout }]
              ]"
            >
              <UButton color="neutral" variant="ghost" block class="justify-start">
                <UIcon name="i-lucide-user" class="size-4" />
                <span class="truncate">{{ auth.user?.email }}</span>
              </UButton>
            </UDropdownMenu>
          </div>
          <UButton
            v-else
            icon="i-lucide-log-out"
            color="neutral"
            variant="ghost"
            square
            block
            @click="logout"
          />

          <UButton
            :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
            :label="collapsed ? undefined : colorMode.value === 'dark' ? 'Light mode' : 'Dark mode'"
            color="neutral"
            variant="ghost"
            :block="!collapsed"
            :square="collapsed"
            @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"
          />
        </template>
      </UDashboardSidebar>

      <slot />
    </UDashboardGroup>
  </div>
</template>
