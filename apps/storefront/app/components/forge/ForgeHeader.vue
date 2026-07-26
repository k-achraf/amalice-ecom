<script setup lang="ts">
import type { Category } from '@amalice/shared'

// Forge chrome — a thin hazard-stripe top bar, blocky uppercase Oswald
// wordmark, uppercase nav, a custom mobile drawer (plain Tailwind + Vue
// <Transition>, no USlideover). Forge palette resolves under .tpl-forge. No
// @nuxt/ui components anywhere in this file.
const cart = useCartStore()
const route = useRoute()
const router = useRouter()
const settings = useStoreSettings()
const { data: categories } = await useApiFetch<Category[]>('/categories', { key: 'store-categories' })

const searchInput = ref((route.query.q as string) ?? '')
function onSearch() {
  router.push({ path: '/catalog', query: { q: searchInput.value || undefined } })
  mobileOpen.value = false
}

const mobileOpen = ref(false)
watch(() => route.path, () => { mobileOpen.value = false })
</script>

<template>
  <header class="sticky top-0 z-50 border-b-[3px] border-[var(--color-forge-ink)] bg-white">
    <!-- Hazard-stripe top bar -->
    <div class="hazard-stripe h-2 w-full" aria-hidden="true" />

    <!-- Announcement strip -->
    <div v-if="settings.announcementText" class="border-b-[3px] border-[var(--color-forge-ink)] bg-[var(--color-forge-ink)] py-1.5 text-center text-white">
      <span class="text-xs font-bold uppercase tracking-wide">{{ settings.announcementText }}</span>
    </div>

    <div class="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
      <!-- Mobile menu toggle -->
      <ForgeButton color="neutral" variant="outline" size="sm" square class="lg:hidden" aria-label="Open menu" @click="mobileOpen = true">
        <Icon name="i-lucide-menu" class="size-4" />
      </ForgeButton>

      <!-- Wordmark -->
      <NuxtLink to="/" class="font-display flex items-center gap-1 text-2xl uppercase text-[var(--color-forge-ink)]">
        <span class="text-primary-600">[</span>{{ settings.storeName }}<span class="text-primary-600">]</span>
      </NuxtLink>

      <!-- Desktop nav -->
      <nav class="hidden items-center gap-6 lg:flex">
        <NuxtLink to="/catalog" class="text-sm font-bold uppercase tracking-wide decoration-2 underline-offset-4 hover:underline">Shop</NuxtLink>
        <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="text-sm font-bold uppercase tracking-wide decoration-2 underline-offset-4 hover:underline">
          {{ cat.name }}
        </NuxtLink>
        <NuxtLink to="/deals" class="text-sm font-bold uppercase tracking-wide text-primary-700 decoration-2 underline-offset-4 hover:underline">Deals</NuxtLink>
      </nav>

      <!-- Search (desktop) -->
      <form class="hidden max-w-xs flex-1 md:block" @submit.prevent="onSearch">
        <ForgeInput v-model="searchInput" placeholder="Search products…" icon="i-lucide-search" />
      </form>

      <!-- Actions -->
      <div class="flex items-center gap-2">
        <ForgeButton to="/wishlist" color="neutral" variant="outline" size="sm" square class="hidden sm:inline-flex" aria-label="Wishlist">
          <Icon name="i-lucide-heart" class="size-4" />
        </ForgeButton>
        <ForgeButton v-if="settings.displayCart" to="/cart" color="neutral" variant="dark" size="sm" square aria-label="Cart" class="relative">
          <Icon name="i-lucide-shopping-bag" class="size-4" />
          <ClientOnly>
            <span
              v-if="cart.itemCount > 0"
              class="tabular absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center border-2 border-[var(--color-forge-ink)] bg-primary-500 text-[10px] font-bold text-[var(--color-forge-ink)]"
            >{{ cart.itemCount }}</span>
          </ClientOnly>
        </ForgeButton>
      </div>
    </div>

    <!-- Mobile drawer -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div v-if="mobileOpen" class="fixed inset-0 z-[60] bg-[var(--color-forge-ink)]/50 lg:hidden" @click="mobileOpen = false" />
    </Transition>
    <Transition
      enter-active-class="transition-transform duration-200"
      enter-from-class="-translate-x-full"
      leave-active-class="transition-transform duration-150"
      leave-to-class="-translate-x-full"
    >
      <div v-if="mobileOpen" class="fixed inset-y-0 left-0 z-[70] flex w-80 max-w-[85vw] flex-col border-r-[3px] border-[var(--color-forge-ink)] bg-white p-5 lg:hidden">
        <div class="mb-6 flex items-center justify-between">
          <span class="font-display text-xl uppercase">Menu</span>
          <ForgeButton color="neutral" variant="outline" size="sm" square aria-label="Close menu" @click="mobileOpen = false">
            <Icon name="i-lucide-x" class="size-4" />
          </ForgeButton>
        </div>
        <form class="mb-6" @submit.prevent="onSearch">
          <ForgeInput v-model="searchInput" placeholder="Search products…" icon="i-lucide-search" />
        </form>
        <nav class="flex flex-1 flex-col gap-1 overflow-y-auto text-sm font-bold uppercase tracking-wide">
          <NuxtLink to="/catalog" class="border-b-2 border-[var(--color-forge-ink)]/10 py-3" @click="mobileOpen = false">All products</NuxtLink>
          <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="border-b-2 border-[var(--color-forge-ink)]/10 py-3" @click="mobileOpen = false">{{ cat.name }}</NuxtLink>
          <NuxtLink to="/deals" class="border-b-2 border-[var(--color-forge-ink)]/10 py-3" @click="mobileOpen = false">Deals</NuxtLink>
          <NuxtLink to="/new-arrivals" class="border-b-2 border-[var(--color-forge-ink)]/10 py-3" @click="mobileOpen = false">New arrivals</NuxtLink>
          <NuxtLink to="/wishlist" class="py-3" @click="mobileOpen = false">Wishlist</NuxtLink>
        </nav>
      </div>
    </Transition>
  </header>
</template>
