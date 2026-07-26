<script setup lang="ts">
import type { Category } from '@amalice/shared'

// Nova chrome — scrolling marquee announcement strip, bold black wordmark,
// uppercase nav with underline hover, a custom mobile drawer (plain
// Tailwind + Vue <Transition>, no USlideover). Nova palette resolves under
// .tpl-nova. No @nuxt/ui components anywhere in this file.
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
  <header class="sticky top-0 z-50 border-b-2 border-black bg-white">
    <!-- Marquee announcement strip -->
    <div v-if="settings.announcementText" class="overflow-hidden border-b-2 border-black bg-primary-500 py-1.5 text-black">
      <div class="nova-marquee-track">
        <span v-for="n in 8" :key="n" class="mx-6 shrink-0 text-xs font-bold uppercase tracking-wide">{{ settings.announcementText }}</span>
        <span v-for="n in 8" :key="`b${n}`" class="mx-6 shrink-0 text-xs font-bold uppercase tracking-wide" aria-hidden="true">{{ settings.announcementText }}</span>
      </div>
    </div>

    <div class="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
      <!-- Mobile menu toggle -->
      <NovaButton variant="outline" size="sm" square class="lg:hidden" aria-label="Open menu" @click="mobileOpen = true">
        <Icon name="i-lucide-menu" class="size-4" />
      </NovaButton>

      <!-- Wordmark -->
      <NuxtLink to="/" class="font-display text-2xl uppercase text-black">
        {{ settings.storeName }}<span class="text-primary-500">.</span>
      </NuxtLink>

      <!-- Desktop nav -->
      <nav class="hidden items-center gap-6 lg:flex">
        <NuxtLink to="/catalog" class="text-sm font-bold uppercase tracking-wide decoration-2 underline-offset-4 hover:underline">Shop</NuxtLink>
        <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="text-sm font-bold uppercase tracking-wide decoration-2 underline-offset-4 hover:underline">
          {{ cat.name }}
        </NuxtLink>
        <NuxtLink to="/deals" class="text-sm font-bold uppercase tracking-wide text-[var(--color-nova-pop)] decoration-2 underline-offset-4 hover:underline">Deals</NuxtLink>
      </nav>

      <!-- Search (desktop) -->
      <form class="hidden max-w-xs flex-1 md:block" @submit.prevent="onSearch">
        <NovaInput v-model="searchInput" placeholder="Search products…" icon="i-lucide-search" />
      </form>

      <!-- Actions -->
      <div class="flex items-center gap-2">
        <NovaButton to="/wishlist" variant="outline" size="sm" square class="hidden sm:inline-flex" aria-label="Wishlist">
          <Icon name="i-lucide-heart" class="size-4" />
        </NovaButton>
        <NovaButton v-if="settings.displayCart" to="/cart" variant="dark" size="sm" square aria-label="Cart" class="relative">
          <Icon name="i-lucide-shopping-bag" class="size-4" />
          <ClientOnly>
            <span
              v-if="cart.itemCount > 0"
              class="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border-2 border-black bg-primary-500 text-[10px] font-bold text-black"
            >{{ cart.itemCount }}</span>
          </ClientOnly>
        </NovaButton>
      </div>
    </div>

    <!-- Quick category strip — punchy, always-visible shortcut row (Nova's
         catalog itself drops the sidebar in favor of a top filter bar, so
         the header echoes that "everything up top" rhythm). -->
    <div class="hidden border-t-2 border-black bg-white lg:block">
      <div class="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
        <NuxtLink
          v-for="cat in categories"
          :key="cat.id"
          :to="`/collections/${cat.slug}`"
          class="shrink-0 border-2 border-transparent px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-black/50 transition-all hover:border-black hover:text-black"
        >
          {{ cat.name }}
        </NuxtLink>
      </div>
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
      <div v-if="mobileOpen" class="fixed inset-y-0 left-0 z-[70] flex w-80 max-w-[85vw] flex-col border-r-2 border-black bg-white p-5 lg:hidden">
        <div class="mb-6 flex items-center justify-between">
          <span class="font-display text-xl uppercase">Menu</span>
          <NovaButton variant="outline" size="sm" square aria-label="Close menu" @click="mobileOpen = false">
            <Icon name="i-lucide-x" class="size-4" />
          </NovaButton>
        </div>
        <form class="mb-6" @submit.prevent="onSearch">
          <NovaInput v-model="searchInput" placeholder="Search products…" icon="i-lucide-search" />
        </form>
        <nav class="flex flex-1 flex-col gap-1 overflow-y-auto text-sm font-bold uppercase tracking-wide">
          <NuxtLink to="/catalog" class="border-b-2 border-black/10 py-3" @click="mobileOpen = false">All products</NuxtLink>
          <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="border-b-2 border-black/10 py-3" @click="mobileOpen = false">{{ cat.name }}</NuxtLink>
          <NuxtLink to="/deals" class="border-b-2 border-black/10 py-3" @click="mobileOpen = false">Deals</NuxtLink>
          <NuxtLink to="/new-arrivals" class="border-b-2 border-black/10 py-3" @click="mobileOpen = false">New arrivals</NuxtLink>
          <NuxtLink to="/wishlist" class="py-3" @click="mobileOpen = false">Wishlist</NuxtLink>
        </nav>
      </div>
    </Transition>
  </header>
</template>
