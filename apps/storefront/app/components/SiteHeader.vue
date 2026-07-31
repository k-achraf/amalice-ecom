<script setup lang="ts">
import type { Category } from '@amalice/shared'

const cart = useCartStore()
const route = useRoute()
const router = useRouter()
const settings = useStoreSettings()

// SF-17 — categories drive the mega-menu. Fetched once, cached by Nuxt.
const { data: categories } = await useApiFetch<Category[]>('/categories', { key: 'store-categories' })

const searchInput = ref((route.query.q as string) ?? '')
function onSearch() {
  router.push({ path: '/catalog', query: { q: searchInput.value || undefined } })
  mobileOpen.value = false
}

// Announcement bar copy comes from store settings (admin-controlled) — null = no bar.
const announcementVisible = ref(true)
function dismissAnnouncement() {
  announcementVisible.value = false
}

// Mobile nav drawer — plain Tailwind + Vue <Transition>, no @nuxt/ui.
const mobileOpen = ref(false)
watch(() => route.path, () => { mobileOpen.value = false })
</script>

<template>
  <header class="border-b border-default bg-default">
    <!-- Announcement bar (only if admin has set copy) -->
    <div
      v-if="settings.announcementText && announcementVisible"
      class="flex items-center justify-center gap-3 bg-primary px-4 py-2 text-center text-sm text-white"
    >
      <span class="font-medium">{{ settings.announcementText }}</span>
      <button class="text-white/70 hover:text-white" aria-label="إغلاق" @click="dismissAnnouncement">
        <Icon name="i-lucide-x" class="size-4" />
      </button>
    </div>

    <!-- Main header -->
    <div class="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
      <!-- Mobile menu toggle -->
      <Button
        class="lg:hidden"
        icon="i-lucide-menu"
        color="neutral"
        variant="ghost"
        square
        aria-label="فتح القائمة"
        @click="mobileOpen = true"
      />

      <NuxtLink to="/" class="text-xl font-bold text-highlighted">{{ settings.storeName }}</NuxtLink>

      <!-- Desktop category nav -->
      <nav class="hidden items-center gap-6 text-sm font-medium lg:flex">
        <NuxtLink to="/catalog" class="text-muted hover:text-highlighted">كل المنتجات</NuxtLink>
        <NuxtLink
          v-for="cat in categories"
          :key="cat.id"
          :to="`/collections/${cat.slug}`"
          class="text-muted hover:text-highlighted"
        >
          {{ cat.name }}
        </NuxtLink>
      </nav>

      <!-- Search (desktop) -->
      <form class="ms-auto hidden flex-1 max-w-sm lg:block" @submit.prevent="onSearch">
        <Input v-model="searchInput" placeholder="ابحث عن المنتجات..." icon="i-lucide-search" class="w-full" />
      </form>

      <!-- Right actions -->
      <div class="ms-auto flex items-center gap-4 lg:ms-0">
        <Button to="/track" color="neutral" variant="ghost" icon="i-lucide-package-search" class="hidden sm:inline-flex">
          تتبع الطلب
        </Button>
        <Button to="/orders" color="neutral" variant="ghost" icon="i-lucide-user" class="hidden sm:inline-flex">
          طلباتي
        </Button>
        <NuxtLink v-if="settings.displayCart" to="/cart" class="relative flex items-center gap-2 text-sm font-medium">
          <Icon name="i-lucide-shopping-cart" class="size-5" />
          <ClientOnly>
            <Badge v-if="cart.itemCount > 0" color="primary" variant="solid">{{ cart.itemCount }}</Badge>
          </ClientOnly>
        </NuxtLink>
      </div>
    </div>

    <!-- Mobile search -->
    <div class="border-t border-default px-4 py-3 lg:hidden">
      <form @submit.prevent="onSearch">
        <Input v-model="searchInput" placeholder="ابحث عن المنتجات..." icon="i-lucide-search" class="w-full" />
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
      <div v-if="mobileOpen" class="fixed inset-y-0 start-0 z-[70] flex w-80 max-w-[85vw] flex-col bg-default p-6 lg:hidden">
        <div class="mb-6 flex items-center justify-between">
          <span class="text-lg font-semibold text-highlighted">القائمة</span>
          <Button variant="ghost" color="neutral" size="sm" square aria-label="إغلاق القائمة" @click="mobileOpen = false">
            <Icon name="i-lucide-x" class="size-4" />
          </Button>
        </div>
        <nav class="flex flex-1 flex-col gap-1 overflow-y-auto text-base font-medium">
          <Button to="/catalog" color="neutral" variant="ghost" block class="!justify-start" @click="mobileOpen = false">كل المنتجات</Button>
          <Button
            v-for="cat in categories"
            :key="cat.id"
            :to="`/collections/${cat.slug}`"
            color="neutral"
            variant="ghost"
            block
            class="!justify-start"
            @click="mobileOpen = false"
          >
            {{ cat.name }}
          </Button>
          <div class="my-2 border-t border-default" />
          <Button to="/track" color="neutral" variant="ghost" block class="!justify-start" icon="i-lucide-package-search" @click="mobileOpen = false">تتبع الطلب</Button>
          <Button to="/orders" color="neutral" variant="ghost" block class="!justify-start" icon="i-lucide-user" @click="mobileOpen = false">طلباتي</Button>
          <Button to="/about" color="neutral" variant="ghost" block class="!justify-start" @click="mobileOpen = false">من نحن</Button>
          <Button to="/contact" color="neutral" variant="ghost" block class="!justify-start" @click="mobileOpen = false">اتصل بنا</Button>
        </nav>
      </div>
    </Transition>
  </header>
</template>
