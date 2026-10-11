<script setup lang="ts">
import type { Component } from 'vue'
import type { AdminRoleName } from '@amalice/shared'
import {
  PhoneCall, ShoppingCart, Receipt, PackageCheck, SearchCode,
  UserCog, LayoutGrid, Palette, Layers, MapPinned, Plug, History, Server, FileWarning, LogOut
} from 'lucide-vue-next'
import { DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuPortal, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from 'reka-ui'

const auth = useAuthStore()
const route = useRoute()
const config = useRuntimeConfig()

// ADM-01: role-filtered nav. Client-side hiding is UX only; the server
// re-checks every route via JwtAuthGuard + RolesGuard (plan §ADM-02).
// `design` icons come from the design's own set; the rest are lucide at the same stroke.
interface NavItem { label: string; to: string; roles: AdminRoleName[]; design?: string; icon?: Component; short?: string }
interface NavGroup { title: string; items: NavItem[] }

const groups: NavGroup[] = [
  {
    title: 'Store',
    items: [
      { label: 'Overview', design: 'overview', to: '/', roles: ['SuperAdmin', 'OpsManager', 'Finance', 'Warehouse'] },
      { label: 'Orders', design: 'orders', to: '/orders', roles: ['SuperAdmin', 'OpsManager', 'Finance', 'Support'] },
      { label: 'Products & stock', short: 'Products', design: 'products', to: '/inventory', roles: ['SuperAdmin', 'OpsManager', 'Warehouse'] },
      { label: 'Customers', design: 'customers', to: '/customers', roles: ['SuperAdmin', 'OpsManager', 'Finance', 'Support'] },
      { label: 'Call Center', icon: PhoneCall, to: '/call-center', roles: ['SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent'] },
      { label: 'Abandoned Carts', icon: ShoppingCart, to: '/abandoned-carts', roles: ['SuperAdmin', 'OpsManager', 'Support'] }
    ]
  },
  {
    title: 'Operations',
    items: [
      { label: 'Fulfillment', icon: PackageCheck, to: '/fulfillment', roles: ['SuperAdmin', 'OpsManager'] },
      { label: 'Shipping', design: 'delivery', to: '/shipping', roles: ['SuperAdmin', 'OpsManager'] },
      { label: 'Product Sourcing', icon: SearchCode, to: '/sourcing', roles: ['SuperAdmin', 'OpsManager'] },
      { label: 'Reconciliation', icon: Receipt, to: '/reconciliation', roles: ['SuperAdmin', 'Finance'] }
    ]
  },
  {
    title: 'Manage',
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
// Mobile tab bar: the design's four primary tabs (whatever the role can see) + "More".
const tabItems = computed(() => visibleGroups.value.flatMap((g) => g.items).filter((i) => i.design && ['/', '/orders', '/inventory', '/customers'].includes(i.to)))

function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(`${to}/`)
}

const drawerOpen = ref(false)
watch(() => route.path, () => { drawerOpen.value = false })

const initials = computed(() => (auth.user?.email ?? '?').slice(0, 2).toUpperCase())
const storefrontHost = computed(() => {
  try { return new URL(config.public.storefrontBase).host } catch { return config.public.storefrontBase }
})

async function logout() {
  auth.clear()
  await navigateTo('/login')
}
</script>

<template>
  <div class="app ads-root">
    <aside class="sidebar">
      <NuxtLink to="/" aria-label="Leezil admin home"><img class="logo" src="/img/leezil-logo-ivory.svg" alt="Leezil"></NuxtLink>
      <nav class="nav" aria-label="Main">
        <template v-for="g in visibleGroups" :key="g.title">
          <span class="nav-label">{{ g.title }}</span>
          <NuxtLink v-for="item in g.items" :key="item.to" :to="item.to" :class="{ active: isActive(item.to) }" :aria-current="isActive(item.to) ? 'page' : undefined">
            <AdsDesignIcon v-if="item.design" :name="item.design" />
            <component :is="item.icon" v-else class="i" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </template>
      </nav>
      <div class="store-card">
        <div style="font-size: 13px"><span class="dot" />Store is online</div>
        <div style="font-size: 16px; font-weight: 600">{{ storefrontHost }}</div>
        <a :href="config.public.storefrontBase" target="_blank" rel="noopener">View storefront<AdsDesignIcon name="external" style="width: 14px; height: 14px" /></a>
        <div class="account">
          <span class="who"><b>{{ auth.user?.email }}</b><span>{{ auth.role }}</span></span>
          <button type="button" aria-label="Sign out" title="Sign out" @click="logout"><LogOut class="i" style="width: 18px; height: 18px" /></button>
        </div>
      </div>
    </aside>

    <div class="mobile-bar">
      <img src="/img/leezil-icon-teal.svg" alt="Leezil">
      <span class="grow">Leezil Admin</span>
      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child><button class="avatar-btn" type="button" aria-label="Account">{{ initials }}</button></DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent align="end" :side-offset="6" class="panel z-50" style="min-width: 220px">
            <DropdownMenuLabel class="menu-label" style="text-transform: none; letter-spacing: 0; font-size: 13px; font-weight: 500">{{ auth.user?.email }}<br><span class="muted">{{ auth.role }}</span></DropdownMenuLabel>
            <DropdownMenuSeparator class="menu-sep" />
            <DropdownMenuItem class="menu-item" @select="logout"><LogOut class="i" style="width: 18px; height: 18px" />Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>

    <main class="main">
      <slot />
    </main>

    <nav class="tabbar five" aria-label="Main">
      <NuxtLink v-for="item in tabItems" :key="item.to" :to="item.to" :class="{ active: isActive(item.to) }" :aria-current="isActive(item.to) ? 'page' : undefined">
        <span><AdsDesignIcon :name="item.design!" /></span>{{ item.short ?? item.label }}
      </NuxtLink>
      <button type="button" @click="drawerOpen = true"><span><AdsDesignIcon name="menu" /></span>More</button>
    </nav>

    <template v-if="drawerOpen">
      <div class="scrim" @click="drawerOpen = false" />
      <aside class="drawer" aria-label="All pages">
        <img class="logo" style="width: 116px; margin: 4px 12px" src="/img/leezil-logo-ivory.svg" alt="Leezil">
        <nav class="nav">
          <template v-for="g in visibleGroups" :key="g.title">
            <span class="nav-label">{{ g.title }}</span>
            <NuxtLink v-for="item in g.items" :key="item.to" :to="item.to" :class="{ active: isActive(item.to) }">
              <AdsDesignIcon v-if="item.design" :name="item.design" />
              <component :is="item.icon" v-else class="i" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </template>
        </nav>
      </aside>
    </template>
  </div>
</template>
