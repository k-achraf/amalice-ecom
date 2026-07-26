<script setup lang="ts">
import type { Category } from '@amalice/shared'

// Volt chrome — near-black sticky header, thin hairline bottom border,
// geometric Sora wordmark, a custom mobile drawer (plain Tailwind + Vue
// <Transition>, no USlideover). Volt palette resolves under .tpl-volt. No
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
  <header class="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur">
    <!-- Announcement strip -->
    <div v-if="settings.announcementText" class="border-b border-white/10 bg-[#0c1113] py-1.5 text-center">
      <p class="font-mono-spec truncate px-4 text-[11px] uppercase tracking-wide text-primary-400">{{ settings.announcementText }}</p>
    </div>

    <div class="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
      <!-- Mobile menu toggle -->
      <VoltButton color="neutral" variant="outline" size="sm" square class="lg:hidden" aria-label="Open menu" @click="mobileOpen = true">
        <Icon name="i-lucide-menu" class="size-4" />
      </VoltButton>

      <!-- Left cluster: wordmark + nav, hard-anchored left like a spec-sheet header row -->
      <div class="flex min-w-0 items-center gap-7">
        <NuxtLink to="/" class="font-display shrink-0 text-xl text-white">
          {{ settings.storeName }}<span class="text-primary-400">.</span>
        </NuxtLink>

        <nav class="hidden items-center gap-6 lg:flex">
          <NuxtLink to="/catalog" class="text-sm text-white/70 transition-colors hover:text-white">Shop</NuxtLink>
          <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="text-sm text-white/70 transition-colors hover:text-white">
            {{ cat.name }}
          </NuxtLink>
          <NuxtLink to="/deals" class="text-sm text-primary-400 transition-colors hover:text-primary-300">Deals</NuxtLink>
          <NuxtLink to="/new-arrivals" class="text-sm text-white/70 transition-colors hover:text-white">New</NuxtLink>
        </nav>
      </div>

      <!-- Right cluster: search + actions -->
      <div class="ml-auto flex flex-1 items-center justify-end gap-4">
        <form class="hidden max-w-xs flex-1 md:block" @submit.prevent="onSearch">
          <VoltInput v-model="searchInput" placeholder="Search products…" icon="i-lucide-search" />
        </form>

        <div class="flex shrink-0 items-center gap-2">
          <VoltButton to="/wishlist" color="neutral" variant="outline" size="sm" square class="hidden sm:inline-flex" aria-label="Wishlist">
            <Icon name="i-lucide-heart" class="size-4" />
          </VoltButton>
          <VoltButton v-if="settings.displayCart" to="/cart" color="primary" variant="solid" size="sm" square aria-label="Cart" class="relative">
            <Icon name="i-lucide-shopping-bag" class="size-4" />
            <ClientOnly>
              <span
                v-if="cart.itemCount > 0"
                class="font-mono-spec absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-md border border-black bg-black text-[10px] text-primary-400"
              >{{ cart.itemCount }}</span>
            </ClientOnly>
          </VoltButton>
        </div>
      </div>
    </div>

    <!-- Mobile drawer -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div v-if="mobileOpen" class="fixed inset-0 z-[60] bg-black/70 lg:hidden" @click="mobileOpen = false" />
    </Transition>
    <Transition
      enter-active-class="transition-transform duration-200"
      enter-from-class="-translate-x-full"
      leave-active-class="transition-transform duration-150"
      leave-to-class="-translate-x-full"
    >
      <div v-if="mobileOpen" class="fixed inset-y-0 left-0 z-[70] flex w-80 max-w-[85vw] flex-col border-r border-white/10 bg-black p-5 lg:hidden">
        <div class="mb-6 flex items-center justify-between">
          <span class="font-display text-lg text-white">Menu</span>
          <VoltButton color="neutral" variant="outline" size="sm" square aria-label="Close menu" @click="mobileOpen = false">
            <Icon name="i-lucide-x" class="size-4" />
          </VoltButton>
        </div>
        <form class="mb-6" @submit.prevent="onSearch">
          <VoltInput v-model="searchInput" placeholder="Search products…" icon="i-lucide-search" />
        </form>
        <nav class="flex flex-1 flex-col gap-1 overflow-y-auto text-sm">
          <NuxtLink to="/catalog" class="border-b border-white/10 py-3 text-white/80 hover:text-white" @click="mobileOpen = false">All products</NuxtLink>
          <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="border-b border-white/10 py-3 text-white/80 hover:text-white" @click="mobileOpen = false">{{ cat.name }}</NuxtLink>
          <NuxtLink to="/deals" class="border-b border-white/10 py-3 text-primary-400" @click="mobileOpen = false">Deals</NuxtLink>
          <NuxtLink to="/new-arrivals" class="border-b border-white/10 py-3 text-white/80 hover:text-white" @click="mobileOpen = false">New arrivals</NuxtLink>
          <NuxtLink to="/wishlist" class="py-3 text-white/80 hover:text-white" @click="mobileOpen = false">Wishlist</NuxtLink>
        </nav>
      </div>
    </Transition>
  </header>
</template>
