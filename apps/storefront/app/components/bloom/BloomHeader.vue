<script setup lang="ts">
import type { Category } from '@amalice/shared'

// Bloom chrome — a light, airy blush-white header bar (no dark "velvet"
// moment anywhere in Bloom), pink nav accents, fully pill icon buttons, a
// custom mobile drawer (plain Tailwind + Vue <Transition>, no USlideover).
// Bloom palette resolves under .tpl-bloom. No @nuxt/ui components anywhere.
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
  <header class="sticky top-0 z-50 border-b border-neutral-100 bg-white/90 backdrop-blur-md">
    <div v-if="settings.announcementText" class="bg-primary-50 py-1.5 text-center text-[11px] font-medium uppercase tracking-[0.1em] text-primary-600">
      {{ settings.announcementText }}
    </div>

    <div class="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
      <BloomButton variant="ghost" color="neutral" size="sm" square class="lg:hidden" aria-label="Open menu" @click="mobileOpen = true">
        <Icon name="i-lucide-menu" class="size-5" />
      </BloomButton>

      <NuxtLink to="/" class="font-display text-3xl text-[var(--color-bloom-ink)]">
        {{ settings.storeName }}
      </NuxtLink>

      <nav class="hidden items-center gap-7 lg:flex">
        <NuxtLink to="/catalog" class="text-sm font-medium text-neutral-600 transition-colors hover:text-primary-600">Shop</NuxtLink>
        <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="text-sm font-medium text-neutral-600 transition-colors hover:text-primary-600">
          {{ cat.name }}
        </NuxtLink>
        <NuxtLink to="/deals" class="text-sm font-medium text-primary-600 transition-colors hover:text-primary-700">Deals</NuxtLink>
      </nav>

      <form class="hidden max-w-xs flex-1 md:block" @submit.prevent="onSearch">
        <BloomInput v-model="searchInput" placeholder="Search for glow…" icon="i-lucide-search" />
      </form>

      <div class="flex items-center gap-2">
        <BloomButton to="/wishlist" variant="ghost" color="neutral" size="sm" square class="hidden sm:inline-flex" aria-label="Wishlist">
          <Icon name="i-lucide-heart" class="size-4" />
        </BloomButton>
        <BloomButton v-if="settings.displayCart" to="/cart" variant="ghost" color="neutral" size="sm" square class="relative" aria-label="Cart">
          <Icon name="i-lucide-shopping-bag" class="size-4" />
          <ClientOnly>
            <span
              v-if="cart.itemCount > 0"
              class="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary-500 text-[9px] font-bold text-white"
            >{{ cart.itemCount }}</span>
          </ClientOnly>
        </BloomButton>
      </div>
    </div>

    <!-- Mobile drawer -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div v-if="mobileOpen" class="fixed inset-0 z-[60] bg-black/30 lg:hidden" @click="mobileOpen = false" />
    </Transition>
    <Transition
      enter-active-class="transition-transform duration-200"
      enter-from-class="-translate-x-full"
      leave-active-class="transition-transform duration-150"
      leave-to-class="-translate-x-full"
    >
      <div v-if="mobileOpen" class="fixed inset-y-0 left-0 z-[70] flex w-80 max-w-[85vw] flex-col bg-white p-6 lg:hidden">
        <div class="mb-6 flex items-center justify-between">
          <span class="font-display text-2xl text-[var(--color-bloom-ink)]">Menu</span>
          <BloomButton variant="ghost" color="neutral" size="sm" square aria-label="Close menu" @click="mobileOpen = false">
            <Icon name="i-lucide-x" class="size-4" />
          </BloomButton>
        </div>
        <form class="mb-6" @submit.prevent="onSearch">
          <BloomInput v-model="searchInput" placeholder="Search…" icon="i-lucide-search" />
        </form>
        <nav class="flex flex-1 flex-col gap-1 overflow-y-auto text-sm font-medium text-neutral-600">
          <NuxtLink to="/catalog" class="border-b border-neutral-100 py-3" @click="mobileOpen = false">All products</NuxtLink>
          <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="border-b border-neutral-100 py-3" @click="mobileOpen = false">{{ cat.name }}</NuxtLink>
          <NuxtLink to="/deals" class="border-b border-neutral-100 py-3" @click="mobileOpen = false">Deals</NuxtLink>
          <NuxtLink to="/new-arrivals" class="border-b border-neutral-100 py-3" @click="mobileOpen = false">New arrivals</NuxtLink>
          <NuxtLink to="/wishlist" class="py-3" @click="mobileOpen = false">Wishlist</NuxtLink>
        </nav>
      </div>
    </Transition>
  </header>
</template>
