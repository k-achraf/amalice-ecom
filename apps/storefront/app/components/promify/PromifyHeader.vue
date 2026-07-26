<script setup lang="ts">
import type { Category } from '@amalice/shared'

// Promify chrome — glassy sticky header (bg-white/80 backdrop-blur), logo,
// desktop nav, search, wishlist + cart actions, mobile drawer. The signature
// is the translucent blur + the blue brand mark + the rounded-full ghost
// icon buttons. Promify palette resolves via the .tpl-promify wrapper.
const cart = useCartStore()
const route = useRoute()
const router = useRouter()
const settings = useStoreSettings()
const { data: categories } = await useApiFetch<Category[]>('/categories', { key: 'store-categories' })

const searchInput = ref((route.query.q as string) ?? '')
function onSearch() {
  router.push({ path: '/catalog', query: { q: searchInput.value || undefined } })
}

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Shop', to: '/catalog' },
  { label: 'Deals', to: '/deals' },
  { label: 'New', to: '/new-arrivals' }
]

const isMobileMenuOpen = ref(false)
watch(() => route.path, () => {
  isMobileMenuOpen.value = false
})
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-md">
    <!-- Relative positioning lets the search bar center on the FULL bar width,
         independent of how wide the logo/nav or the actions cluster are. -->
    <div class="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <!-- Logo + nav (left) -->
      <div class="flex items-center gap-8">
        <NuxtLink to="/" class="flex items-center gap-2">
          <div class="flex size-8 items-center justify-center rounded-lg bg-primary-600">
            <span class="text-sm font-bold text-white">{{ settings.storeName.charAt(0) }}</span>
          </div>
          <span class="text-xl font-bold text-neutral-900">{{ settings.storeName }}</span>
        </NuxtLink>

        <nav class="hidden items-center gap-6 lg:flex">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="text-sm font-medium text-neutral-600 transition-colors hover:text-primary-600"
            active-class="!text-primary-600"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>
      </div>

      <!-- Search — absolutely centered on the bar, not on the remaining space -->
      <form
        class="pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 justify-center md:flex"
        @submit.prevent="onSearch"
      >
        <PromifyInput
          v-model="searchInput"
          placeholder="Search products…"
          icon="i-lucide-search"
          class="pointer-events-auto w-full max-w-xs"
        />
      </form>

      <!-- Actions (right) -->
      <div class="flex items-center gap-1">
        <PromifyButton
          to="/wishlist"
          icon="i-lucide-heart"
          color="neutral"
          variant="ghost"
          square
          class="hidden !rounded-full sm:inline-flex"
          aria-label="Wishlist"
        />
        <NuxtLink v-if="settings.displayCart" to="/cart" class="relative ml-1 flex items-center justify-center rounded-full p-2 text-neutral-600 hover:bg-neutral-100 hover:text-primary-600">
          <Icon name="i-lucide-shopping-cart" class="size-5" />
          <ClientOnly>
            <span
              v-if="cart.itemCount > 0"
              class="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white"
            >{{ cart.itemCount }}</span>
          </ClientOnly>
        </NuxtLink>
        <!-- Mobile menu toggle -->
        <PromifyButton
          :icon="isMobileMenuOpen ? 'i-lucide-x' : 'i-lucide-menu'"
          color="neutral"
          variant="ghost"
          square
          class="ml-1 !rounded-full lg:hidden"
          aria-label="Toggle menu"
          @click="isMobileMenuOpen = !isMobileMenuOpen"
        />
      </div>
    </div>

    <!-- Mobile nav drawer -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div v-if="isMobileMenuOpen" class="border-t border-neutral-100 bg-white px-4 pb-4 lg:hidden">
        <form class="pt-3 md:hidden" @submit.prevent="onSearch">
          <PromifyInput v-model="searchInput" placeholder="Search products…" icon="i-lucide-search" class="w-full" />
        </form>
        <nav class="mt-2 flex flex-col gap-1">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-primary-600"
            active-class="!bg-primary-50 !text-primary-600"
          >
            {{ link.label }}
          </NuxtLink>
          <NuxtLink to="/wishlist" class="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-primary-600">Wishlist</NuxtLink>
        </nav>
      </div>
    </Transition>
  </header>
</template>
