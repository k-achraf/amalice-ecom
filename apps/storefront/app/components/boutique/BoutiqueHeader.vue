<script setup lang="ts">
import type { Category } from '@amalice/shared'

// Boutique chrome — luxury feel. Generous whitespace, Fraunces serif display
// type, narrow max-width, sharp (zero-radius) edges, restrained gold accent.
// Bespoke "quiet luxury" tokens from boutique.css — not Polaris. A custom
// mobile drawer (plain Tailwind + Vue <Transition>, no USlideover) — no
// @nuxt/ui anywhere in this template.
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
const announcementVisible = ref(true)
const mobileOpen = ref(false)
watch(() => route.path, () => { mobileOpen.value = false })
</script>

<template>
  <header class="bg-default">
    <!-- Announcement -->
    <div
      v-if="settings.announcementText && announcementVisible"
      class="flex items-center justify-center gap-3 bg-primary px-4 py-2.5 text-center text-xs tracking-wide text-white"
    >
      <span>{{ settings.announcementText }}</span>
      <button class="text-white/60 hover:text-white" aria-label="Dismiss" @click="announcementVisible = false">
        <Icon name="i-lucide-x" class="size-3.5" />
      </button>
    </div>

    <!-- Refined masthead — generous vertical spacing, centered -->
    <div class="mx-auto max-w-5xl px-6 py-8">
      <div class="flex items-center justify-between">
        <BoutiqueButton class="lg:hidden" icon="i-lucide-menu" color="neutral" variant="ghost" square aria-label="Open menu" @click="mobileOpen = true" />
        <NuxtLink to="/track" class="hidden text-xs uppercase tracking-widest text-muted hover:text-highlighted lg:inline">Track order</NuxtLink>
        <NuxtLink to="/" class="font-display text-2xl tracking-[0.2em] uppercase text-highlighted">
          {{ settings.storeName }}
        </NuxtLink>
        <div class="flex items-center gap-4">
          <BoutiqueButton to="/orders" color="neutral" variant="ghost" size="sm" class="hidden lg:inline-flex">Account</BoutiqueButton>
          <NuxtLink v-if="settings.displayCart" to="/cart" class="relative">
            <Icon name="i-lucide-shopping-bag" class="size-5" />
            <ClientOnly>
              <BoutiqueBadge v-if="cart.itemCount > 0" color="primary" class="absolute -right-2 -top-2">{{ cart.itemCount }}</BoutiqueBadge>
            </ClientOnly>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Thin divider + centered nav -->
    <div class="border-y border-default">
      <div class="mx-auto flex max-w-5xl items-center justify-center gap-8 px-6 py-4 text-xs uppercase tracking-widest">
        <NuxtLink to="/catalog" class="text-muted transition-colors hover:text-highlighted">All</NuxtLink>
        <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="text-muted transition-colors hover:text-highlighted">
          {{ cat.name }}
        </NuxtLink>
        <form @submit.prevent="onSearch">
          <BoutiqueInput v-model="searchInput" placeholder="Search" icon="i-lucide-search" class="w-28" />
        </form>
      </div>
    </div>

    <!-- Mobile drawer -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div v-if="mobileOpen" class="fixed inset-0 z-[60] bg-black/40 lg:hidden" @click="mobileOpen = false" />
    </Transition>
    <Transition
      enter-active-class="transition-transform duration-200"
      enter-from-class="-translate-x-full"
      leave-active-class="transition-transform duration-150"
      leave-to-class="-translate-x-full"
    >
      <div v-if="mobileOpen" class="fixed inset-y-0 left-0 z-[70] flex w-80 max-w-[85vw] flex-col bg-default p-6 lg:hidden">
        <div class="mb-6 flex items-center justify-between">
          <span class="font-display text-xl uppercase tracking-widest text-highlighted">Menu</span>
          <BoutiqueButton variant="ghost" size="sm" square aria-label="Close menu" @click="mobileOpen = false">
            <Icon name="i-lucide-x" class="size-4" />
          </BoutiqueButton>
        </div>
        <nav class="flex flex-1 flex-col gap-1 overflow-y-auto text-sm uppercase tracking-widest">
          <BoutiqueButton to="/catalog" color="neutral" variant="ghost" block class="!justify-start" @click="mobileOpen = false">All products</BoutiqueButton>
          <BoutiqueButton v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" color="neutral" variant="ghost" block class="!justify-start" @click="mobileOpen = false">{{ cat.name }}</BoutiqueButton>
          <div class="my-2 border-t border-default" />
          <BoutiqueButton to="/orders" color="neutral" variant="ghost" block class="!justify-start" @click="mobileOpen = false">Account</BoutiqueButton>
          <BoutiqueButton to="/about" color="neutral" variant="ghost" block class="!justify-start" @click="mobileOpen = false">About</BoutiqueButton>
        </nav>
      </div>
    </Transition>
  </header>
</template>
