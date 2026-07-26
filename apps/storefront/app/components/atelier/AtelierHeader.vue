<script setup lang="ts">
import type { Category } from '@amalice/shared'

// Atelier chrome — a deep emerald-black "velvet" header bar (cream
// wordmark, rose-gold nav accents), circular icon buttons, a custom mobile
// drawer (plain Tailwind + Vue <Transition>, no USlideover). Atelier
// palette resolves under .tpl-atelier. No @nuxt/ui components anywhere.
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
  <header class="velvet-panel sticky top-0 z-50">
    <div v-if="settings.announcementText" class="border-b border-white/10 py-1.5 text-center text-[11px] font-medium uppercase tracking-[0.15em] text-primary-300">
      {{ settings.announcementText }}
    </div>

    <!-- Row 1: mobile toggle / centered wordmark / actions -->
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 pt-3 sm:px-6 lg:px-8">
      <AtelierButton variant="ghost" size="sm" square class="text-[var(--color-atelier-cream)] hover:text-primary-300 lg:hidden" aria-label="Open menu" @click="mobileOpen = true">
        <Icon name="i-lucide-menu" class="size-5" />
      </AtelierButton>

      <NuxtLink to="/" class="font-display text-3xl tracking-wide text-[var(--color-atelier-cream)] lg:mx-auto">
        {{ settings.storeName }}
      </NuxtLink>

      <div class="flex items-center gap-2">
        <AtelierButton to="/wishlist" variant="ghost" size="sm" square class="hidden text-[var(--color-atelier-cream)] hover:text-primary-300 sm:inline-flex" aria-label="Wishlist">
          <Icon name="i-lucide-heart" class="size-4" />
        </AtelierButton>
        <AtelierButton v-if="settings.displayCart" to="/cart" variant="ghost" size="sm" square class="relative text-[var(--color-atelier-cream)] hover:text-primary-300" aria-label="Cart">
          <Icon name="i-lucide-shopping-bag" class="size-4" />
          <ClientOnly>
            <span
              v-if="cart.itemCount > 0"
              class="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary-500 text-[9px] font-bold text-white"
            >{{ cart.itemCount }}</span>
          </ClientOnly>
        </AtelierButton>
      </div>
    </div>

    <!-- Row 2: nav, centered, below the wordmark — plus search -->
    <div class="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 pb-4 pt-2 sm:px-6 lg:px-8">
      <nav class="hidden items-center gap-8 lg:flex">
        <NuxtLink to="/catalog" class="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-atelier-cream)]/80 transition-colors hover:text-primary-300">Shop</NuxtLink>
        <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-atelier-cream)]/80 transition-colors hover:text-primary-300">
          {{ cat.name }}
        </NuxtLink>
        <NuxtLink to="/deals" class="text-xs font-medium uppercase tracking-[0.15em] text-primary-300 transition-colors hover:text-primary-200">Deals</NuxtLink>
      </nav>
      <form class="hidden max-w-xs md:block" @submit.prevent="onSearch">
        <AtelierInput v-model="searchInput" placeholder="Search the collection…" icon="i-lucide-search" />
      </form>
    </div>

    <!-- Mobile drawer -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div v-if="mobileOpen" class="fixed inset-0 z-[60] bg-black/50 lg:hidden" @click="mobileOpen = false" />
    </Transition>
    <Transition
      enter-active-class="transition-transform duration-200"
      enter-from-class="-translate-x-full"
      leave-active-class="transition-transform duration-150"
      leave-to-class="-translate-x-full"
    >
      <div v-if="mobileOpen" class="velvet-panel fixed inset-y-0 left-0 z-[70] flex w-80 max-w-[85vw] flex-col p-6 lg:hidden">
        <div class="mb-6 flex items-center justify-between">
          <span class="font-display text-2xl text-[var(--color-atelier-cream)]">Menu</span>
          <AtelierButton variant="ghost" size="sm" square class="text-[var(--color-atelier-cream)]" aria-label="Close menu" @click="mobileOpen = false">
            <Icon name="i-lucide-x" class="size-4" />
          </AtelierButton>
        </div>
        <form class="mb-6" @submit.prevent="onSearch">
          <AtelierInput v-model="searchInput" placeholder="Search…" icon="i-lucide-search" />
        </form>
        <nav class="flex flex-1 flex-col gap-1 overflow-y-auto text-sm font-medium uppercase tracking-wide text-[var(--color-atelier-cream)]/80">
          <NuxtLink to="/catalog" class="border-b border-white/10 py-3" @click="mobileOpen = false">All pieces</NuxtLink>
          <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="border-b border-white/10 py-3" @click="mobileOpen = false">{{ cat.name }}</NuxtLink>
          <NuxtLink to="/deals" class="border-b border-white/10 py-3" @click="mobileOpen = false">Deals</NuxtLink>
          <NuxtLink to="/new-arrivals" class="border-b border-white/10 py-3" @click="mobileOpen = false">New arrivals</NuxtLink>
          <NuxtLink to="/wishlist" class="py-3" @click="mobileOpen = false">Wishlist</NuxtLink>
        </nav>
      </div>
    </Transition>
  </header>
</template>
