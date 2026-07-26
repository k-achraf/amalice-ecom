<script setup lang="ts">
import type { Category } from '@amalice/shared'

// Hearth chrome — a warm linen header bar (never dark — Hearth's surface
// stays light throughout), terracotta nav accents, cozy rounded-xl icon
// buttons, a custom mobile drawer (plain Tailwind + Vue <Transition>, no
// USlideover). Hearth palette resolves under .tpl-hearth. No @nuxt/ui
// components anywhere.
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
  <header class="sticky top-0 z-50 border-b border-neutral-200 bg-[var(--color-hearth-linen)]">
    <div v-if="settings.announcementText" class="border-b border-neutral-200 bg-primary-600 py-1.5 text-center text-[11px] font-medium uppercase tracking-[0.1em] text-white">
      {{ settings.announcementText }}
    </div>

    <div class="mx-auto flex h-20 max-w-7xl items-center gap-6 px-4 py-3 sm:px-6 lg:px-8">
      <HearthButton variant="ghost" size="sm" square class="text-[var(--color-hearth-ink)] lg:hidden" aria-label="Open menu" @click="mobileOpen = true">
        <Icon name="i-lucide-menu" class="size-5" />
      </HearthButton>

      <!-- Left cluster: wordmark hugging the nav, both anchored left -->
      <div class="flex min-w-0 items-center gap-8">
        <NuxtLink to="/" class="font-display flex shrink-0 items-center gap-2 text-2xl text-[var(--color-hearth-ink)]">
          <Icon name="i-lucide-home" class="size-6 text-primary-600" />
          {{ settings.storeName }}
        </NuxtLink>

        <nav class="hidden items-center gap-7 lg:flex">
          <NuxtLink to="/catalog" class="text-sm font-medium text-neutral-600 transition-colors hover:text-primary-600">Shop</NuxtLink>
          <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="text-sm font-medium text-neutral-600 transition-colors hover:text-primary-600">
            {{ cat.name }}
          </NuxtLink>
          <NuxtLink to="/new-arrivals" class="text-sm font-medium text-neutral-600 transition-colors hover:text-primary-600">New</NuxtLink>
          <NuxtLink to="/deals" class="text-sm font-medium text-primary-600 transition-colors hover:text-primary-700">Deals</NuxtLink>
        </nav>
      </div>

      <!-- Right cluster: search + account icons, pushed to the far edge -->
      <div class="ml-auto flex flex-1 items-center justify-end gap-4">
        <form class="hidden max-w-xs flex-1 md:block" @submit.prevent="onSearch">
          <HearthInput v-model="searchInput" placeholder="Search the shop…" icon="i-lucide-search" />
        </form>

        <div class="flex shrink-0 items-center gap-2">
          <HearthButton to="/wishlist" variant="ghost" size="sm" square class="hidden text-[var(--color-hearth-ink)] sm:inline-flex" aria-label="Wishlist">
            <Icon name="i-lucide-heart" class="size-4" />
          </HearthButton>
          <HearthButton v-if="settings.displayCart" to="/cart" variant="ghost" size="sm" square class="relative text-[var(--color-hearth-ink)]" aria-label="Cart">
            <Icon name="i-lucide-shopping-bag" class="size-4" />
            <ClientOnly>
              <span
                v-if="cart.itemCount > 0"
                class="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary-500 text-[9px] font-bold text-white"
              >{{ cart.itemCount }}</span>
            </ClientOnly>
          </HearthButton>
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
      <div v-if="mobileOpen" class="fixed inset-0 z-[60] bg-black/40 lg:hidden" @click="mobileOpen = false" />
    </Transition>
    <Transition
      enter-active-class="transition-transform duration-200"
      enter-from-class="-translate-x-full"
      leave-active-class="transition-transform duration-150"
      leave-to-class="-translate-x-full"
    >
      <div v-if="mobileOpen" class="fixed inset-y-0 left-0 z-[70] flex w-80 max-w-[85vw] flex-col bg-[var(--color-hearth-linen)] p-6 lg:hidden">
        <div class="mb-6 flex items-center justify-between">
          <span class="font-display text-xl text-[var(--color-hearth-ink)]">Menu</span>
          <HearthButton variant="ghost" size="sm" square class="text-[var(--color-hearth-ink)]" aria-label="Close menu" @click="mobileOpen = false">
            <Icon name="i-lucide-x" class="size-4" />
          </HearthButton>
        </div>
        <form class="mb-6" @submit.prevent="onSearch">
          <HearthInput v-model="searchInput" placeholder="Search…" icon="i-lucide-search" />
        </form>
        <nav class="flex flex-1 flex-col gap-1 overflow-y-auto text-sm font-medium text-neutral-600">
          <NuxtLink to="/catalog" class="border-b border-neutral-200 py-3" @click="mobileOpen = false">All products</NuxtLink>
          <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="border-b border-neutral-200 py-3" @click="mobileOpen = false">{{ cat.name }}</NuxtLink>
          <NuxtLink to="/deals" class="border-b border-neutral-200 py-3" @click="mobileOpen = false">Deals</NuxtLink>
          <NuxtLink to="/new-arrivals" class="border-b border-neutral-200 py-3" @click="mobileOpen = false">New arrivals</NuxtLink>
          <NuxtLink to="/wishlist" class="py-3" @click="mobileOpen = false">Wishlist</NuxtLink>
        </nav>
      </div>
    </Transition>
  </header>
</template>
