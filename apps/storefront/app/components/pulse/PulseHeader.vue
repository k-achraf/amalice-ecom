<script setup lang="ts">
import type { Category } from '@amalice/shared'

// Pulse chrome — a white sticky header with a soft violet glow shadow,
// gradient wordmark, rounded pill nav/search, circular icon buttons, a
// custom mobile drawer (plain Tailwind + Vue <Transition>, no USlideover).
// Pulse palette resolves under .tpl-pulse. No @nuxt/ui components anywhere.
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
  <header class="sticky top-0 z-50 border-b border-neutral-100 bg-white/95 shadow-[var(--shadow-pulse-sm)] backdrop-blur-sm">
    <div v-if="settings.announcementText" class="bg-primary-500 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-white">
      {{ settings.announcementText }}
    </div>

    <!-- Row 1: nav-left / logo-CENTERED / icons-right, three-column grid -->
    <div class="mx-auto grid h-20 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
      <div class="flex items-center gap-2">
        <PulseButton variant="ghost" color="neutral" size="sm" square class="lg:hidden" aria-label="Open menu" @click="mobileOpen = true">
          <Icon name="i-lucide-menu" class="size-5" />
        </PulseButton>
        <nav class="hidden items-center gap-1 lg:flex">
          <NuxtLink to="/catalog" class="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-primary-50 hover:text-primary-700">Shop</NuxtLink>
          <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-primary-50 hover:text-primary-700">
            {{ cat.name }}
          </NuxtLink>
        </nav>
      </div>

      <NuxtLink to="/" class="font-display justify-self-center bg-gradient-to-r from-primary-600 to-[var(--color-pulse-cyan)] bg-clip-text text-2xl font-bold text-transparent">
        {{ settings.storeName }}
      </NuxtLink>

      <div class="flex items-center justify-end gap-2">
        <NuxtLink to="/deals" class="hidden rounded-full px-4 py-2 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50 lg:inline-block">Deals</NuxtLink>
        <PulseButton to="/wishlist" variant="ghost" color="neutral" size="sm" square class="hidden sm:inline-flex" aria-label="Wishlist">
          <Icon name="i-lucide-heart" class="size-4" />
        </PulseButton>
        <PulseButton v-if="settings.displayCart" to="/cart" variant="ghost" color="neutral" size="sm" square class="relative" aria-label="Cart">
          <Icon name="i-lucide-shopping-bag" class="size-4" />
          <ClientOnly>
            <span
              v-if="cart.itemCount > 0"
              class="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary-500 text-[9px] font-bold text-white"
            >{{ cart.itemCount }}</span>
          </ClientOnly>
        </PulseButton>
      </div>
    </div>

    <!-- Row 2: a centered search bar beneath the wordmark -->
    <div class="hidden border-t border-neutral-100 py-2.5 md:block">
      <form class="mx-auto max-w-sm px-4" @submit.prevent="onSearch">
        <PulseInput v-model="searchInput" placeholder="Search gadgets…" icon="i-lucide-search" />
      </form>
    </div>

    <!-- Gradient underline accent -->
    <div class="h-0.5 bg-gradient-to-r from-primary-500 via-[var(--color-pulse-cyan)] to-primary-500" />

    <!-- Mobile drawer -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div v-if="mobileOpen" class="fixed inset-0 z-[60] bg-neutral-900/40 lg:hidden" @click="mobileOpen = false" />
    </Transition>
    <Transition
      enter-active-class="transition-transform duration-200"
      enter-from-class="-translate-x-full"
      leave-active-class="transition-transform duration-150"
      leave-to-class="-translate-x-full"
    >
      <div v-if="mobileOpen" class="fixed inset-y-0 left-0 z-[70] flex w-80 max-w-[85vw] flex-col bg-white p-6 shadow-[var(--shadow-pulse-lg)] lg:hidden">
        <div class="mb-6 flex items-center justify-between">
          <span class="font-display text-xl text-neutral-900">Menu</span>
          <PulseButton variant="ghost" color="neutral" size="sm" square aria-label="Close menu" @click="mobileOpen = false">
            <Icon name="i-lucide-x" class="size-4" />
          </PulseButton>
        </div>
        <form class="mb-6" @submit.prevent="onSearch">
          <PulseInput v-model="searchInput" placeholder="Search…" icon="i-lucide-search" />
        </form>
        <nav class="flex flex-1 flex-col gap-1 overflow-y-auto text-sm font-medium text-neutral-700">
          <NuxtLink to="/catalog" class="rounded-xl px-3 py-3 hover:bg-primary-50 hover:text-primary-700" @click="mobileOpen = false">All products</NuxtLink>
          <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="rounded-xl px-3 py-3 hover:bg-primary-50 hover:text-primary-700" @click="mobileOpen = false">{{ cat.name }}</NuxtLink>
          <NuxtLink to="/deals" class="rounded-xl px-3 py-3 hover:bg-primary-50 hover:text-primary-700" @click="mobileOpen = false">Deals</NuxtLink>
          <NuxtLink to="/new-arrivals" class="rounded-xl px-3 py-3 hover:bg-primary-50 hover:text-primary-700" @click="mobileOpen = false">New arrivals</NuxtLink>
          <NuxtLink to="/wishlist" class="rounded-xl px-3 py-3 hover:bg-primary-50 hover:text-primary-700" @click="mobileOpen = false">Wishlist</NuxtLink>
        </nav>
      </div>
    </Transition>
  </header>
</template>
