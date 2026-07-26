<script setup lang="ts">
import type { Category } from '@amalice/shared'

// Lumiere footer — stark black surface, Bodoni Moda wordmark, crimson
// section labels, thin white/10 dividers. No shadow, no @nuxt/ui.
const settings = useStoreSettings()
const { data: categories } = await useApiFetch<Category[]>('/categories', { key: 'store-categories' })
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-black bg-black text-white">
    <!-- Masthead — an oversized wordmark spanning full width, a closing cover rather than a brand column -->
    <div class="border-b border-white/15 px-4 py-12 sm:px-6 lg:px-8">
      <div class="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
        <p class="font-display text-5xl text-white sm:text-6xl">{{ settings.storeName }}<span class="text-primary-500">.</span></p>
        <div class="flex gap-2">
          <a href="#" class="flex size-9 items-center justify-center rounded border border-white/25 text-white transition-colors hover:border-primary-500 hover:text-primary-500" aria-label="Facebook"><Icon name="i-lucide-facebook" class="size-4" /></a>
          <a href="#" class="flex size-9 items-center justify-center rounded border border-white/25 text-white transition-colors hover:border-primary-500 hover:text-primary-500" aria-label="Instagram"><Icon name="i-lucide-instagram" class="size-4" /></a>
          <a href="#" class="flex size-9 items-center justify-center rounded border border-white/25 text-white transition-colors hover:border-primary-500 hover:text-primary-500" aria-label="Twitter"><Icon name="i-lucide-twitter" class="size-4" /></a>
        </div>
      </div>
      <p class="mx-auto mt-3 max-w-md text-sm text-white/55">Cash on delivery, no account required. Pay when it arrives.</p>
    </div>

    <!-- Dense index row — four columns, no card surfaces, thin dividers only -->
    <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div class="grid grid-cols-2 gap-x-8 gap-y-8 md:grid-cols-3">
        <div>
          <h3 class="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-500">Shop</h3>
          <ul class="mt-3 space-y-2 text-sm text-white/65">
            <li><NuxtLink to="/catalog" class="transition-colors hover:text-white">All products</NuxtLink></li>
            <li v-for="cat in (categories ?? []).slice(0, 4)" :key="cat.id"><NuxtLink :to="`/collections/${cat.slug}`" class="transition-colors hover:text-white">{{ cat.name }}</NuxtLink></li>
            <li><NuxtLink to="/deals" class="transition-colors hover:text-white">Today's deals</NuxtLink></li>
            <li><NuxtLink to="/new-arrivals" class="transition-colors hover:text-white">New arrivals</NuxtLink></li>
          </ul>
        </div>

        <div>
          <h3 class="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-500">Help</h3>
          <ul class="mt-3 space-y-2 text-sm text-white/65">
            <li><NuxtLink to="/contact" class="transition-colors hover:text-white">Contact us</NuxtLink></li>
            <li><NuxtLink to="/faq" class="transition-colors hover:text-white">FAQ</NuxtLink></li>
            <li><NuxtLink to="/shipping" class="transition-colors hover:text-white">Shipping</NuxtLink></li>
            <li><NuxtLink to="/returns" class="transition-colors hover:text-white">Returns</NuxtLink></li>
            <li><NuxtLink to="/track" class="transition-colors hover:text-white">Track order</NuxtLink></li>
          </ul>
        </div>

        <div>
          <h3 class="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-500">Company</h3>
          <ul class="mt-3 space-y-2 text-sm text-white/65">
            <li><NuxtLink to="/about" class="transition-colors hover:text-white">About</NuxtLink></li>
            <li><NuxtLink to="/blog" class="transition-colors hover:text-white">Blog</NuxtLink></li>
            <li><NuxtLink to="/careers" class="transition-colors hover:text-white">Careers</NuxtLink></li>
            <li><NuxtLink to="/terms" class="transition-colors hover:text-white">Terms</NuxtLink></li>
            <li><NuxtLink to="/privacy" class="transition-colors hover:text-white">Privacy</NuxtLink></li>
          </ul>
        </div>
      </div>

      <div class="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/20 pt-6 sm:flex-row">
        <p class="text-xs text-white/45">© {{ year }} {{ settings.storeName }}. Cash on delivery commerce.</p>
        <div class="flex items-center gap-4 text-xs text-white/45">
          <span class="flex items-center gap-1"><Icon name="i-lucide-banknote" class="size-3.5" /> COD</span>
          <span class="flex items-center gap-1"><Icon name="i-lucide-shield-check" class="size-3.5" /> Verified</span>
        </div>
      </div>
    </div>
  </footer>
</template>
