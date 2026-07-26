<script setup lang="ts">
import type { Category } from '@amalice/shared'

// Editorial chrome — magazine-scale layout (centered masthead, bold display
// type, thin rules, centered category nav) carrying Atlassian Design System
// tokens from editorial.css: ADS blue, small radius, sentence-case labels.
// Distinct from Minimal's left-aligned utility bar and from Polaris. No
// @nuxt/ui anywhere — mobile drawer is plain Tailwind + Vue <Transition>.
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
  <header class="border-b border-default bg-default">
    <!-- Announcement -->
    <div
      v-if="settings.announcementText && announcementVisible"
      class="flex items-center justify-center gap-3 bg-primary px-4 py-2 text-center text-xs font-medium text-white"
    >
      <span>{{ settings.announcementText }}</span>
      <button class="text-white/70 hover:text-white" aria-label="Dismiss" @click="announcementVisible = false">
        <Icon name="i-lucide-x" class="size-3.5" />
      </button>
    </div>

    <!-- Masthead — centered, magazine-style -->
    <div class="border-b border-default">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <EditorialButton class="lg:hidden" icon="i-lucide-menu" color="neutral" variant="ghost" square aria-label="Open menu" @click="mobileOpen = true" />
        <div class="flex-1" />
        <NuxtLink to="/" class="text-center text-3xl font-bold uppercase tracking-tight text-highlighted">
          {{ settings.storeName }}
        </NuxtLink>
        <div class="flex flex-1 items-center justify-end gap-3">
          <EditorialButton to="/track" color="neutral" variant="ghost" size="sm" class="hidden sm:inline-flex">Track</EditorialButton>
          <NuxtLink v-if="settings.displayCart" to="/cart" class="relative">
            <Icon name="i-lucide-shopping-cart" class="size-5" />
            <ClientOnly>
              <EditorialBadge v-if="cart.itemCount > 0" color="primary" variant="solid" class="absolute -right-2 -top-2">{{ cart.itemCount }}</EditorialBadge>
            </ClientOnly>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Centered category nav + search -->
    <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-6 px-4 py-3 text-sm font-medium">
      <NuxtLink to="/catalog" class="text-muted hover:text-highlighted">All</NuxtLink>
      <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="text-muted hover:text-highlighted">
        {{ cat.name }}
      </NuxtLink>
      <form class="ml-2" @submit.prevent="onSearch">
        <EditorialInput v-model="searchInput" placeholder="Search…" icon="i-lucide-search" class="w-36" />
      </form>
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
          <span class="text-lg font-bold uppercase tracking-tight text-highlighted">Menu</span>
          <EditorialButton variant="ghost" color="neutral" size="sm" square aria-label="Close menu" @click="mobileOpen = false">
            <Icon name="i-lucide-x" class="size-4" />
          </EditorialButton>
        </div>
        <nav class="flex flex-1 flex-col gap-1 overflow-y-auto text-base font-medium">
          <EditorialButton to="/catalog" color="neutral" variant="ghost" block class="!justify-start" @click="mobileOpen = false">All products</EditorialButton>
          <EditorialButton v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" color="neutral" variant="ghost" block class="!justify-start" @click="mobileOpen = false">{{ cat.name }}</EditorialButton>
          <div class="my-2 border-t border-default" />
          <EditorialButton to="/orders" color="neutral" variant="ghost" block class="!justify-start" @click="mobileOpen = false">My orders</EditorialButton>
          <EditorialButton to="/about" color="neutral" variant="ghost" block class="!justify-start" @click="mobileOpen = false">About</EditorialButton>
        </nav>
      </div>
    </Transition>
  </header>
</template>
