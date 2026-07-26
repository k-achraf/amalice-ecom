<script setup lang="ts">
import type { Category } from '@amalice/shared'

// Lumiere chrome — a stark black/white masthead with a crimson announcement
// strip, an oversized Bodoni Moda wordmark, uppercase tracked-out nav, and a
// custom mobile drawer (plain Tailwind + Vue <Transition>, no USlideover).
// Lumiere palette resolves under .tpl-lumiere. No @nuxt/ui components
// anywhere in this file.
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
  <header class="sticky top-0 z-50 border-b border-black bg-white">
    <!-- Announcement strip -->
    <div v-if="settings.announcementText" class="overflow-hidden bg-black py-1.5 text-white">
      <div class="lumiere-marquee-track">
        <span v-for="n in 8" :key="n" class="mx-6 shrink-0 text-[11px] font-medium uppercase tracking-[0.18em]">{{ settings.announcementText }}</span>
        <span v-for="n in 8" :key="`b${n}`" class="mx-6 shrink-0 text-[11px] font-medium uppercase tracking-[0.18em]" aria-hidden="true">{{ settings.announcementText }}</span>
      </div>
    </div>

    <div class="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
      <!-- Mobile menu toggle -->
      <LumiereButton color="neutral" variant="outline" size="sm" square class="lg:hidden" aria-label="Open menu" @click="mobileOpen = true">
        <Icon name="i-lucide-menu" class="size-4" />
      </LumiereButton>

      <!-- Wordmark — bold serif, logo-left, the sole anchor of the bar -->
      <NuxtLink to="/" class="font-display text-3xl text-black">
        {{ settings.storeName }}<span class="text-primary-600">.</span>
      </NuxtLink>

      <!-- Desktop nav — deliberately sparse: three words, nothing more. Category browsing
           lives in the catalog's own filters, not duplicated across the whole category list here. -->
      <nav class="hidden items-center gap-8 lg:flex">
        <NuxtLink to="/catalog" class="text-xs font-semibold uppercase tracking-[0.14em] text-black/80 transition-colors hover:text-primary-600">Shop</NuxtLink>
        <NuxtLink to="/new-arrivals" class="text-xs font-semibold uppercase tracking-[0.14em] text-black/80 transition-colors hover:text-primary-600">New</NuxtLink>
        <NuxtLink to="/deals" class="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600 transition-colors hover:text-primary-700">Deals</NuxtLink>
      </nav>

      <!-- Actions — search collapses to an icon-only affordance to keep the bar spare -->
      <div class="flex items-center gap-1">
        <LumiereButton to="/wishlist" color="neutral" variant="outline" size="sm" square class="hidden sm:inline-flex" aria-label="Wishlist">
          <Icon name="i-lucide-heart" class="size-4" />
        </LumiereButton>
        <LumiereButton v-if="settings.displayCart" to="/cart" color="neutral" variant="solid" size="sm" square aria-label="Cart" class="relative">
          <Icon name="i-lucide-shopping-bag" class="size-4" />
          <ClientOnly>
            <span
              v-if="cart.itemCount > 0"
              class="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-white bg-primary-600 text-[10px] font-bold text-white"
            >{{ cart.itemCount }}</span>
          </ClientOnly>
        </LumiereButton>
      </div>
    </div>

    <!-- Search — a slim, understated strip beneath the sparse nav, not competing for space in it -->
    <div class="hidden border-t border-black/10 md:block">
      <form class="mx-auto max-w-xs px-4 py-2.5 sm:px-6 lg:px-8" @submit.prevent="onSearch">
        <LumiereInput v-model="searchInput" placeholder="Search products…" icon="i-lucide-search" />
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
      <div v-if="mobileOpen" class="fixed inset-y-0 left-0 z-[70] flex w-80 max-w-[85vw] flex-col border-r border-black bg-white p-5 lg:hidden">
        <div class="mb-6 flex items-center justify-between">
          <span class="font-display text-2xl text-black">Menu</span>
          <LumiereButton color="neutral" variant="outline" size="sm" square aria-label="Close menu" @click="mobileOpen = false">
            <Icon name="i-lucide-x" class="size-4" />
          </LumiereButton>
        </div>
        <form class="mb-6" @submit.prevent="onSearch">
          <LumiereInput v-model="searchInput" placeholder="Search products…" icon="i-lucide-search" />
        </form>
        <nav class="flex flex-1 flex-col gap-1 overflow-y-auto text-xs font-semibold uppercase tracking-[0.14em]">
          <NuxtLink to="/catalog" class="border-b border-black/10 py-3" @click="mobileOpen = false">All products</NuxtLink>
          <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="border-b border-black/10 py-3" @click="mobileOpen = false">{{ cat.name }}</NuxtLink>
          <NuxtLink to="/deals" class="border-b border-black/10 py-3 text-primary-600" @click="mobileOpen = false">Deals</NuxtLink>
          <NuxtLink to="/new-arrivals" class="border-b border-black/10 py-3" @click="mobileOpen = false">New arrivals</NuxtLink>
          <NuxtLink to="/wishlist" class="py-3" @click="mobileOpen = false">Wishlist</NuxtLink>
        </nav>
      </div>
    </Transition>
  </header>
</template>

<style scoped>
.lumiere-marquee-track {
  display: flex;
  width: max-content;
  animation: lumiere-marquee 22s linear infinite;
}
@keyframes lumiere-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
@media (prefers-reduced-motion: reduce) {
  .lumiere-marquee-track {
    animation: none;
  }
}
</style>
