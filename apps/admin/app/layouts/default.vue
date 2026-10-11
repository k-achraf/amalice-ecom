<script setup lang="ts">
import type { Component } from 'vue'
import type { AdminRoleName } from '@amalice/shared'
import {
  LayoutDashboard, Package, PhoneCall, ShoppingCart, Boxes, Users, Receipt, PackageCheck, Truck, SearchCode,
  UserCog, LayoutGrid, Palette, Layers, MapPinned, Plug, History, Server, FileWarning,
  Menu, LogOut, Sun, Moon, ChevronDown, X
} from 'lucide-vue-next'
import { DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from 'reka-ui'

const auth = useAuthStore()
const colorMode = useColorMode()
const route = useRoute()

// ADM-01 — role-filtered nav. Client-side hiding is UX only; the server
// re-checks every route via JwtAuthGuard + RolesGuard (plan §ADM-02).
interface NavItem { label: string; icon: Component; to: string; roles: AdminRoleName[] }
interface NavGroup { title?: string; items: NavItem[] }

const groups: NavGroup[] = [
  {
    items: [{ label: 'Dashboard', icon: LayoutDashboard, to: '/', roles: ['SuperAdmin', 'OpsManager', 'Finance', 'Warehouse'] }]
  },
  {
    title: 'Sales',
    items: [
      { label: 'Orders', icon: Package, to: '/orders', roles: ['SuperAdmin', 'OpsManager', 'Finance', 'Support'] },
      { label: 'Call Center', icon: PhoneCall, to: '/call-center', roles: ['SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent'] },
      { label: 'Abandoned Carts', icon: ShoppingCart, to: '/abandoned-carts', roles: ['SuperAdmin', 'OpsManager', 'Support'] },
      { label: 'Customers', icon: Users, to: '/customers', roles: ['SuperAdmin', 'OpsManager', 'Finance', 'Support'] }
    ]
  },
  {
    title: 'Operations',
    items: [
      { label: 'Inventory', icon: Boxes, to: '/inventory', roles: ['SuperAdmin', 'OpsManager', 'Warehouse'] },
      { label: 'Fulfillment', icon: PackageCheck, to: '/fulfillment', roles: ['SuperAdmin', 'OpsManager'] },
      { label: 'Shipping', icon: Truck, to: '/shipping', roles: ['SuperAdmin', 'OpsManager'] },
      { label: 'Product Sourcing', icon: SearchCode, to: '/sourcing', roles: ['SuperAdmin', 'OpsManager'] }
    ]
  },
  {
    title: 'Finance',
    items: [{ label: 'Reconciliation', icon: Receipt, to: '/reconciliation', roles: ['SuperAdmin', 'Finance'] }]
  },
  {
    title: 'Settings',
    items: [
      { label: 'Users & Roles', icon: UserCog, to: '/users', roles: ['SuperAdmin'] },
      { label: 'Apps', icon: LayoutGrid, to: '/apps', roles: ['SuperAdmin'] },
      { label: 'Storefront', icon: Palette, to: '/settings/storefront', roles: ['SuperAdmin'] },
      { label: 'Attributes', icon: Layers, to: '/settings/attributes', roles: ['SuperAdmin'] },
      { label: 'Shipping Rates', icon: MapPinned, to: '/settings/shipping', roles: ['SuperAdmin', 'OpsManager'] },
      { label: 'Shipping Companies', icon: Plug, to: '/settings/shipping-companies', roles: ['SuperAdmin', 'OpsManager'] }
    ]
  },
  {
    title: 'System',
    items: [
      { label: 'Audit Log', icon: History, to: '/audit-log', roles: ['SuperAdmin', 'Finance', 'OpsManager'] },
      { label: 'Server Performance', icon: Server, to: '/server-performance', roles: ['SuperAdmin'] },
      { label: 'Server Logs', icon: FileWarning, to: '/logs', roles: ['SuperAdmin'] }
    ]
  }
]

const visibleGroups = computed(() =>
  groups
    .map((g) => ({ ...g, items: g.items.filter((i) => auth.role && i.roles.includes(auth.role)) }))
    .filter((g) => g.items.length)
)

function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(`${to}/`)
}

const drawerOpen = ref(false)
watch(() => route.path, () => { drawerOpen.value = false })

const initials = computed(() => (auth.user?.email ?? '?').slice(0, 2).toUpperCase())
const isDark = computed(() => colorMode.value === 'dark')

async function logout() {
  auth.clear()
  await navigateTo('/login')
}
</script>

<template>
  <div class="ads-root flex h-screen flex-col overflow-hidden">
    <!-- Top bar -->
    <header class="z-30 flex h-14 shrink-0 items-center gap-2 border-b border-ads-border bg-ads-surface px-3">
      <AdsButton appearance="subtle" square class="lg:hidden" aria-label="Open navigation" @click="drawerOpen = true"><Menu /></AdsButton>
      <NuxtLink to="/" class="flex items-center gap-2 px-1">
        <span class="flex size-7 items-center justify-center rounded-ads bg-ads-primary text-sm font-bold text-white dark:text-[#161a1d]">A</span>
        <span class="text-base font-semibold text-ads-text">Amalice</span>
      </NuxtLink>

      <div class="ms-auto flex items-center gap-1">
        <AdsButton appearance="subtle" square :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'" @click="colorMode.preference = isDark ? 'light' : 'dark'">
          <Sun v-if="isDark" /><Moon v-else />
        </AdsButton>

        <DropdownMenuRoot>
          <DropdownMenuTrigger as-child>
            <button type="button" class="flex h-8 items-center gap-2 rounded-ads ps-1 pe-2 hover:bg-ads-hover" aria-label="Account menu">
              <span class="flex size-6 items-center justify-center rounded-full bg-ads-primary text-[10px] font-bold text-white dark:text-[#161a1d]">{{ initials }}</span>
              <ChevronDown class="size-3.5 text-ads-subtlest" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent align="end" :side-offset="6" class="ads-root z-50 min-w-56 rounded-ads-lg border border-ads-border bg-ads-surface p-1 shadow-ads-overlay">
              <DropdownMenuLabel class="px-3 py-2">
                <p class="truncate text-sm font-medium text-ads-text">{{ auth.user?.email }}</p>
                <p class="text-xs text-ads-subtlest">{{ auth.role }}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator class="my-1 h-px bg-ads-border" />
              <DropdownMenuItem class="flex h-8 cursor-default items-center gap-2 rounded-ads px-3 text-sm text-ads-text outline-none data-[highlighted]:bg-ads-hover" @select="logout">
                <LogOut class="size-4 text-ads-subtle" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </div>
    </header>

    <div class="flex min-h-0 flex-1">
      <!-- Drawer backdrop (mobile) -->
      <div v-if="drawerOpen" class="fixed inset-0 z-40 bg-ads-overlay lg:hidden" @click="drawerOpen = false" />

      <!-- Sidebar -->
      <aside
        class="fixed inset-y-0 start-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col border-e border-ads-border bg-ads-nav transition-transform rtl:translate-x-full lg:static lg:z-auto lg:translate-x-0 lg:rtl:translate-x-0"
        :class="{ 'translate-x-0 rtl:translate-x-0': drawerOpen }"
      >
        <div class="flex h-14 items-center justify-between px-4 lg:hidden">
          <span class="font-semibold">Navigation</span>
          <AdsButton appearance="subtle" square aria-label="Close navigation" @click="drawerOpen = false"><X /></AdsButton>
        </div>
        <nav class="flex-1 overflow-y-auto px-2 py-3" aria-label="Main">
          <div v-for="(g, gi) in visibleGroups" :key="gi" class="mb-4">
            <p v-if="g.title" class="mb-1 px-3 text-[11px] font-bold uppercase tracking-wide text-ads-subtlest">{{ g.title }}</p>
            <NuxtLink
              v-for="item in g.items"
              :key="item.to"
              :to="item.to"
              :aria-current="isActive(item.to) ? 'page' : undefined"
              class="relative flex h-9 items-center gap-3 rounded-ads px-3 text-sm font-medium"
              :class="isActive(item.to)
                ? 'bg-ads-selected text-ads-primary before:absolute before:inset-y-1 before:start-0 before:w-0.5 before:rounded-full before:bg-ads-primary'
                : 'text-ads-subtle hover:bg-ads-hover'"
            >
              <component :is="item.icon" class="size-4 shrink-0" />
              <span class="truncate">{{ item.label }}</span>
            </NuxtLink>
          </div>
        </nav>
      </aside>

      <main class="min-w-0 flex-1 overflow-y-auto">
        <slot />
      </main>
    </div>
  </div>
</template>
