<script setup lang="ts">
import type { Category } from '@amalice/shared'

const settings = useStoreSettings()
const { data: categories } = await useApiFetch<Category[]>('/categories', { key: 'store-categories' })
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-white/10 bg-black text-white">
    <!-- Dense top row — logo + socials, full width, no columns yet -->
    <div class="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 border-b border-white/10 px-4 py-6 sm:flex-row sm:items-center sm:px-6 lg:px-8">
      <p class="font-display text-2xl text-white">{{ settings.storeName }}<span class="text-primary-500">.</span></p>
      <div class="flex gap-2">
        <a href="#" class="flex size-9 items-center justify-center border border-white/20 text-white transition-colors hover:border-primary-500 hover:text-primary-500" aria-label="Facebook"><Icon name="i-lucide-facebook" class="size-4" /></a>
        <a href="#" class="flex size-9 items-center justify-center border border-white/20 text-white transition-colors hover:border-primary-500 hover:text-primary-500" aria-label="Instagram"><Icon name="i-lucide-instagram" class="size-4" /></a>
        <a href="#" class="flex size-9 items-center justify-center border border-white/20 text-white transition-colors hover:border-primary-500 hover:text-primary-500" aria-label="Twitter"><Icon name="i-lucide-twitter" class="size-4" /></a>
      </div>
    </div>

    <!-- Dense link columns, divided by hairline rules instead of grid gaps -->
    <div class="mx-auto grid max-w-7xl grid-cols-2 divide-y divide-white/10 sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
      <div class="px-4 py-6 sm:px-6 lg:px-8">
        <h3 class="text-xs font-bold uppercase tracking-wide text-primary-500">Shop</h3>
        <ul class="mt-3 space-y-2 text-sm text-white/60">
          <li><NuxtLink to="/catalog" class="transition-colors hover:text-white">All products</NuxtLink></li>
          <li v-for="cat in (categories ?? []).slice(0, 4)" :key="cat.id"><NuxtLink :to="`/collections/${cat.slug}`" class="transition-colors hover:text-white">{{ cat.name }}</NuxtLink></li>
          <li><NuxtLink to="/deals" class="transition-colors hover:text-white">Today's deals</NuxtLink></li>
          <li><NuxtLink to="/new-arrivals" class="transition-colors hover:text-white">New arrivals</NuxtLink></li>
        </ul>
      </div>

      <div class="px-4 py-6 sm:px-6 lg:px-8">
        <h3 class="text-xs font-bold uppercase tracking-wide text-primary-500">Help</h3>
        <ul class="mt-3 space-y-2 text-sm text-white/60">
          <li><NuxtLink to="/contact" class="transition-colors hover:text-white">Contact us</NuxtLink></li>
          <li><NuxtLink to="/faq" class="transition-colors hover:text-white">FAQ</NuxtLink></li>
          <li><NuxtLink to="/shipping" class="transition-colors hover:text-white">Shipping</NuxtLink></li>
          <li><NuxtLink to="/returns" class="transition-colors hover:text-white">Returns</NuxtLink></li>
          <li><NuxtLink to="/track" class="transition-colors hover:text-white">Track order</NuxtLink></li>
        </ul>
      </div>

      <div class="px-4 py-6 sm:px-6 lg:px-8">
        <h3 class="text-xs font-bold uppercase tracking-wide text-primary-500">Company</h3>
        <ul class="mt-3 space-y-2 text-sm text-white/60">
          <li><NuxtLink to="/about" class="transition-colors hover:text-white">About</NuxtLink></li>
          <li><NuxtLink to="/blog" class="transition-colors hover:text-white">Blog</NuxtLink></li>
          <li><NuxtLink to="/careers" class="transition-colors hover:text-white">Careers</NuxtLink></li>
          <li><NuxtLink to="/terms" class="transition-colors hover:text-white">Terms</NuxtLink></li>
          <li><NuxtLink to="/privacy" class="transition-colors hover:text-white">Privacy</NuxtLink></li>
        </ul>
      </div>
    </div>

    <div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 border-t border-white/10 px-4 py-5 sm:flex-row sm:px-6 lg:px-8">
      <p class="text-xs text-white/40">© {{ year }} {{ settings.storeName }}. Cash on delivery commerce.</p>
      <div class="flex items-center gap-2">
        <span class="sticker sticker-outline">COD</span>
        <span class="sticker sticker-dark">Verified</span>
      </div>
    </div>
  </footer>
</template>
