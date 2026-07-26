<script setup lang="ts">
import type { Category } from '@amalice/shared'

// Trove chrome — a cream header bar with a bold Bricolage Grotesque
// wordmark, sharp-cornered icon buttons, a custom mobile drawer (plain
// Tailwind + Vue <Transition>, no USlideover). Trove palette resolves under
// .tpl-trove. No @nuxt/ui components anywhere.
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
  <header class="sticky top-0 z-50 border-b border-neutral-200 bg-[var(--color-trove-cream)]">
    <div v-if="settings.announcementText" class="border-b border-neutral-200 bg-[var(--color-trove-teal)] py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.15em] text-white">
      {{ settings.announcementText }}
    </div>

    <!-- Centered-logo layout: a true 3-zone grid (not flex justify-between,
         which only reads as centered on mobile) — left zone carries nav,
         center zone is the wordmark, right zone carries search + actions.
         Left/right zones are wrapped in single elements so the grid always
         has exactly 3 items, at every breakpoint. -->
    <div class="mx-auto grid h-20 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
      <div class="flex items-center">
        <TroveButton variant="ghost" size="sm" square class="lg:hidden" aria-label="Open menu" @click="mobileOpen = true">
          <Icon name="i-lucide-menu" class="size-5" />
        </TroveButton>

        <nav class="hidden items-center gap-7 lg:flex">
          <NuxtLink to="/catalog" class="text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-trove-ink)]/70 transition-colors hover:text-[var(--color-trove-teal)]">Shop</NuxtLink>
          <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-trove-ink)]/70 transition-colors hover:text-[var(--color-trove-teal)]">
            {{ cat.name }}
          </NuxtLink>
          <NuxtLink to="/deals" class="text-xs font-bold uppercase tracking-[0.15em] text-primary-700 transition-colors hover:text-primary-600">Deals</NuxtLink>
        </nav>
      </div>

      <NuxtLink to="/" class="font-display flex items-center justify-center gap-2 justify-self-center text-2xl text-[var(--color-trove-ink)] sm:text-3xl">
        <span class="flex size-9 items-center justify-center rounded-full bg-primary-500 text-[var(--color-trove-ink)]">
          <Icon name="i-lucide-gem" class="size-4" />
        </span>
        {{ settings.storeName }}
      </NuxtLink>

      <div class="flex items-center justify-end gap-3">
        <form class="hidden max-w-[11rem] flex-1 md:block" @submit.prevent="onSearch">
          <TroveInput v-model="searchInput" placeholder="Search…" icon="i-lucide-search" />
        </form>
        <TroveButton to="/wishlist" variant="ghost" size="sm" square class="hidden sm:inline-flex" aria-label="Wishlist">
          <Icon name="i-lucide-heart" class="size-4" />
        </TroveButton>
        <TroveButton v-if="settings.displayCart" to="/cart" variant="ghost" size="sm" square class="relative" aria-label="Cart">
          <Icon name="i-lucide-shopping-bag" class="size-4" />
          <ClientOnly>
            <span
              v-if="cart.itemCount > 0"
              class="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--color-trove-teal)] text-[9px] font-bold text-white"
            >{{ cart.itemCount }}</span>
          </ClientOnly>
        </TroveButton>
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
      <div v-if="mobileOpen" class="fixed inset-y-0 left-0 z-[70] flex w-80 max-w-[85vw] flex-col bg-[var(--color-trove-cream)] p-6 lg:hidden">
        <div class="mb-6 flex items-center justify-between">
          <span class="font-display text-2xl text-[var(--color-trove-ink)]">Menu</span>
          <TroveButton variant="ghost" size="sm" square aria-label="Close menu" @click="mobileOpen = false">
            <Icon name="i-lucide-x" class="size-4" />
          </TroveButton>
        </div>
        <form class="mb-6" @submit.prevent="onSearch">
          <TroveInput v-model="searchInput" placeholder="Search…" icon="i-lucide-search" />
        </form>
        <nav class="flex flex-1 flex-col gap-1 overflow-y-auto text-sm font-bold uppercase tracking-wide text-[var(--color-trove-ink)]/80">
          <NuxtLink to="/catalog" class="border-b border-neutral-200 py-3" @click="mobileOpen = false">All finds</NuxtLink>
          <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="border-b border-neutral-200 py-3" @click="mobileOpen = false">{{ cat.name }}</NuxtLink>
          <NuxtLink to="/deals" class="border-b border-neutral-200 py-3" @click="mobileOpen = false">Deals</NuxtLink>
          <NuxtLink to="/new-arrivals" class="border-b border-neutral-200 py-3" @click="mobileOpen = false">New arrivals</NuxtLink>
          <NuxtLink to="/wishlist" class="py-3" @click="mobileOpen = false">Wishlist</NuxtLink>
        </nav>
      </div>
    </Transition>
  </header>
</template>
