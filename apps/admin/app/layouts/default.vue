<script setup lang="ts">
import type { Component } from 'vue'
import type { AdminRoleName, DashboardStats } from '@amalice/shared'
import { Filter, SearchCode, PackageCheck, Receipt, History, Server, FileWarning, Truck, PackageSearch, LayoutDashboard, Megaphone, Link2, Wallet, ShieldBan, Palette, BellRing, ClipboardList, Handshake, Sparkles } from 'lucide-vue-next'

const auth = useAuthStore()
const route = useRoute()
const config = useRuntimeConfig()
const api = useAdminApi()

// ADM-01: role-filtered nav. Client-side hiding is UX only; the server re-checks every
// route via JwtAuthGuard + RolesGuard (plan §ADM-02). Groups/labels follow design/ (app.js NAV);
// pages the design doesn't have (fulfillment, sourcing, reconciliation, logs...) sit in the
// closest group. `design` icons come from the design's own set, the rest are lucide.
interface NavItem { label: string; to: string; roles: AdminRoleName[]; design?: string; icon?: Component; short?: string; count?: 'calls' }
interface NavGroup { title: string; items: NavItem[] }

const groups: NavGroup[] = [
  {
    title: 'Store',
    items: [
      { label: 'Overview', design: 'overview', to: '/', roles: ['SuperAdmin', 'OpsManager', 'Finance', 'Warehouse'], short: 'Home' },
      { label: 'Orders', design: 'orders', to: '/orders', roles: ['SuperAdmin', 'OpsManager', 'Finance', 'Support'] },
      { label: 'Call center', design: 'headset', to: '/call-center', roles: ['SuperAdmin', 'OpsManager', 'Support', 'CallCenterAgent'], count: 'calls', short: 'Calls' },
      { label: 'Abandoned carts', design: 'cart', to: '/abandoned-carts', roles: ['SuperAdmin', 'OpsManager', 'Support'] },
      { label: 'Customers', design: 'customers', to: '/customers', roles: ['SuperAdmin', 'OpsManager', 'Finance', 'Support'] },
      { label: 'Blacklist', icon: ShieldBan, to: '/blacklist', roles: ['SuperAdmin', 'OpsManager', 'Support'] }
    ]
  },
  {
    title: 'Catalogue',
    items: [
      { label: 'Products', design: 'products', to: '/inventory', roles: ['SuperAdmin', 'OpsManager', 'Warehouse'] },
      { label: 'Stocktake', icon: ClipboardList, to: '/inventory/stocktake', roles: ['SuperAdmin', 'OpsManager', 'Warehouse'] },
      { label: 'Suppliers', icon: Handshake, to: '/inventory/suppliers', roles: ['SuperAdmin', 'OpsManager', 'Warehouse'] },
      { label: 'Attributes & options', design: 'layers', to: '/settings/attributes', roles: ['SuperAdmin'] },
      { label: 'Funnels', icon: Filter, to: '/funnels', roles: ['SuperAdmin', 'OpsManager'] },
      { label: 'Product sourcing', icon: SearchCode, to: '/sourcing', roles: ['SuperAdmin', 'OpsManager'] }
    ]
  },
  {
    title: 'Fulfilment',
    items: [
      { label: 'Fulfillment', icon: PackageCheck, to: '/fulfillment', roles: ['SuperAdmin', 'OpsManager'] },
      { label: 'Shipments', icon: Truck, to: '/shipping', roles: ['SuperAdmin', 'OpsManager'] },
      { label: 'Delivery details', icon: PackageSearch, to: '/deliveries', roles: ['SuperAdmin', 'OpsManager', 'Finance', 'Support', 'Warehouse'] },
      { label: 'Reconciliation', icon: Receipt, to: '/reconciliation', roles: ['SuperAdmin', 'Finance'] }
    ]
  },
  {
    title: 'Shipping',
    items: [
      { label: 'Shipping rates', design: 'rates', to: '/settings/shipping', roles: ['SuperAdmin', 'OpsManager'] },
      { label: 'Shipping companies', design: 'delivery', to: '/settings/shipping-companies', roles: ['SuperAdmin', 'OpsManager'] }
    ]
  },
  {
    title: 'Meta Ads',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, to: '/meta-ads', roles: ['SuperAdmin', 'OpsManager'] },
      { label: 'Campaigns', icon: Megaphone, to: '/meta-ads/campaigns', roles: ['SuperAdmin', 'OpsManager'] },
      { label: 'Profitability', icon: Wallet, to: '/meta-ads/profitability', roles: ['SuperAdmin', 'OpsManager'] },
      { label: 'Connection & accounts', icon: Link2, to: '/meta-ads/accounts', roles: ['SuperAdmin', 'OpsManager'] }
    ]
  },
  {
    title: 'Online store',
    items: [
      { label: 'Storefront', design: 'store', to: '/settings/storefront', roles: ['SuperAdmin'] },
      { label: 'Brand identity', icon: Palette, to: '/settings/brand', roles: ['SuperAdmin'] },
      { label: 'Reports & alerts', icon: BellRing, to: '/settings/reports', roles: ['SuperAdmin'] },
      { label: 'Apps', design: 'apps', to: '/apps', roles: ['SuperAdmin'] }
    ]
  },
  {
    title: 'AI',
    items: [
      { label: 'AI assistant', icon: Sparkles, to: '/ai', roles: ['SuperAdmin', 'OpsManager', 'Finance'] }
    ]
  },
  {
    title: 'Admin',
    items: [
      { label: 'Users & roles', design: 'shield', to: '/users', roles: ['SuperAdmin'] },
      { label: 'Audit log', icon: History, to: '/audit-log', roles: ['SuperAdmin', 'Finance', 'OpsManager'] },
      { label: 'Server performance', icon: Server, to: '/server-performance', roles: ['SuperAdmin'] },
      { label: 'Server logs', icon: FileWarning, to: '/logs', roles: ['SuperAdmin'] }
    ]
  }
]

const visibleGroups = computed(() =>
  groups
    .map((g) => ({ ...g, items: g.items.filter((i) => auth.role && i.roles.includes(auth.role)) }))
    .filter((g) => g.items.length)
)
// Mobile tab bar: the design's four quick tabs (whatever the role can see) + More.
const QUICK = ['/', '/orders', '/call-center', '/inventory']
const tabItems = computed(() => visibleGroups.value.flatMap((g) => g.items).filter((i) => QUICK.includes(i.to)))

const allNavPaths = groups.flatMap((g) => g.items.map((i) => i.to))
function isActive(to: string) {
  if (to === '/') return route.path === '/'
  if (route.path === to) return true
  if (!route.path.startsWith(`${to}/`)) return false
  // Don't light up a parent entry (e.g. /meta-ads) while a more specific sibling (/meta-ads/campaigns) matches.
  return !allNavPaths.some((other) => other.length > to.length && other.startsWith(`${to}/`) && (route.path === other || route.path.startsWith(`${other}/`)))
}

// "Call center" badge = orders still waiting for a confirmation call.
const callCount = ref(0)
async function loadCounts() {
  if (!auth.token) return
  try {
    if (['SuperAdmin', 'OpsManager', 'Finance', 'Warehouse'].includes(auth.role ?? '')) {
      const s = await api<DashboardStats>('/admin/stats')
      callCount.value = s.pendingCallCenterCount ?? 0
    } else if (['Support', 'CallCenterAgent'].includes(auth.role ?? '')) {
      // Agents can't read the dashboard stats: use what is workable right now.
      const s = await api<{ queue: { new: number; noAnswer: number; postponed: number } }>('/admin/call-center/stats')
      callCount.value = s.queue.new + s.queue.noAnswer + s.queue.postponed
    }
  } catch { /* badge is decorative */ }
}
onMounted(() => {
  loadCounts()
  const t = setInterval(loadCounts, 60_000)
  onBeforeUnmount(() => clearInterval(t))
})

const { logoSrc } = useAdminBrand()

const menuOpen = ref(false)
watch(() => route.path, () => { menuOpen.value = false })
onMounted(() => {
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') menuOpen.value = false }
  document.addEventListener('keydown', esc)
  onBeforeUnmount(() => document.removeEventListener('keydown', esc))
})

const storefrontHost = computed(() => {
  try { return new URL(config.public.storefrontBase).host } catch { return config.public.storefrontBase }
})

async function logout() {
  auth.clear()
  await navigateTo('/login')
}
</script>

<template>
  <div class="app">
    <aside id="sidebar" class="sidebar" :class="{ open: menuOpen }">
      <NuxtLink to="/" aria-label="Admin home"><span v-if="logoSrc" class="brand-chip"><img :src="logoSrc" alt="Logo"></span><img v-else class="logo" src="/img/leezil-logo-ivory.svg" alt="Leezil"></NuxtLink>
      <nav class="nav" aria-label="Main">
        <template v-for="g in visibleGroups" :key="g.title">
          <span class="nav-label">{{ g.title }}</span>
          <NuxtLink v-for="item in g.items" :key="item.to" :to="item.to" :class="{ active: isActive(item.to) }" :aria-current="isActive(item.to) ? 'page' : undefined">
            <AdsDesignIcon v-if="item.design" :name="item.design" />
            <component :is="item.icon" v-else class="i" />
            <span>{{ item.label }}</span>
            <span v-if="item.count === 'calls' && callCount" class="count">{{ callCount }}</span>
          </NuxtLink>
        </template>
      </nav>
      <div class="store-card">
        <div class="live"><i />Store is online</div>
        <div style="font-size: 15px; font-weight: 600">{{ storefrontHost }}</div>
        <a :href="config.public.storefrontBase" target="_blank" rel="noopener">View storefront<AdsDesignIcon name="external" style="width: 14px; height: 14px" /></a>
        <div style="border-top: 1px solid rgba(241, 237, 226, 0.18); padding-top: 10px; display: flex; align-items: center; gap: 8px">
          <span style="min-width: 0; flex-grow: 1; font-size: 13px">
            <b style="display: block; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{{ auth.user?.email }}</b>
            <span style="opacity: 0.7; font-size: 12px">{{ auth.role }}</span>
          </span>
          <button class="icon-btn sm" type="button" style="background: transparent; color: var(--ivory); border-color: rgba(241, 237, 226, 0.25)" aria-label="Sign out" title="Sign out" @click="logout"><AdsDesignIcon name="logout" style="width: 16px; height: 16px" /></button>
        </div>
      </div>
    </aside>
    <div class="scrim" :class="{ on: menuOpen }" @click="menuOpen = false" />

    <div class="mobile-bar">
      <button class="icon-btn" type="button" aria-label="Open menu" aria-controls="sidebar" @click="menuOpen = true"><AdsDesignIcon name="menu" /></button>
      <img :src="logoSrc ?? '/img/leezil-icon-teal.svg'" alt="" style="height: 28px; width: auto; max-width: 120px; object-fit: contain">
      <span class="grow">{{ logoSrc ? 'Admin' : 'Leezil Admin' }}</span>
    </div>

    <main class="main">
      <slot />
    </main>

    <nav class="tabbar" aria-label="Quick">
      <NuxtLink v-for="item in tabItems" :key="item.to" :to="item.to" :class="{ active: isActive(item.to) }" :aria-current="isActive(item.to) ? 'page' : undefined">
        <span><AdsDesignIcon :name="item.design!" /></span>{{ item.short ?? item.label }}
      </NuxtLink>
      <button type="button" aria-controls="sidebar" @click="menuOpen = true"><span><AdsDesignIcon name="menu" /></span>More</button>
    </nav>
  </div>
</template>
