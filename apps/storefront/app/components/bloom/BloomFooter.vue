<script setup lang="ts">
import type { Category } from '@amalice/shared'

const settings = useStoreSettings()
const { data: categories } = await useApiFetch<Category[]>('/categories', { key: 'store-categories' })
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-neutral-100 bg-[var(--color-bloom-blush)]">
    <div class="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <!-- Centered brand block — no sidebar/grid anywhere in Bloom, echoing
           the catalog's own no-sidebar, everything-centered rhythm. -->
      <p class="font-display text-3xl text-[var(--color-bloom-ink)]">{{ settings.storeName }}</p>
      <p class="mx-auto mt-3 max-w-sm text-sm text-neutral-500">Soft skin, happy skin. Cash on delivery, no account required.</p>
      <div class="mt-5 flex justify-center gap-2">
        <a href="#" class="flex size-9 items-center justify-center rounded-full bg-white text-neutral-500 shadow-[var(--shadow-bloom-sm)] transition-colors hover:text-primary-600" aria-label="Instagram"><Icon name="i-lucide-instagram" class="size-4" /></a>
        <a href="#" class="flex size-9 items-center justify-center rounded-full bg-white text-neutral-500 shadow-[var(--shadow-bloom-sm)] transition-colors hover:text-primary-600" aria-label="Facebook"><Icon name="i-lucide-facebook" class="size-4" /></a>
        <a href="#" class="flex size-9 items-center justify-center rounded-full bg-white text-neutral-500 shadow-[var(--shadow-bloom-sm)] transition-colors hover:text-primary-600" aria-label="TikTok"><Icon name="i-lucide-music-2" class="size-4" /></a>
      </div>

      <!-- Link groups as a centered flex-wrap row of pill columns, not a grid -->
      <div class="mt-10 flex flex-wrap items-start justify-center gap-x-10 gap-y-8">
        <div>
          <h3 class="text-xs font-semibold uppercase tracking-[0.12em] text-primary-600">Shop</h3>
          <ul class="mt-4 space-y-2.5 text-sm text-neutral-500">
            <li><NuxtLink to="/catalog" class="transition-colors hover:text-primary-600">All products</NuxtLink></li>
            <li v-for="cat in (categories ?? []).slice(0, 4)" :key="cat.id"><NuxtLink :to="`/collections/${cat.slug}`" class="transition-colors hover:text-primary-600">{{ cat.name }}</NuxtLink></li>
            <li><NuxtLink to="/deals" class="transition-colors hover:text-primary-600">Today's deals</NuxtLink></li>
            <li><NuxtLink to="/new-arrivals" class="transition-colors hover:text-primary-600">New arrivals</NuxtLink></li>
          </ul>
        </div>

        <div>
          <h3 class="text-xs font-semibold uppercase tracking-[0.12em] text-primary-600">Support</h3>
          <ul class="mt-4 space-y-2.5 text-sm text-neutral-500">
            <li><NuxtLink to="/contact" class="transition-colors hover:text-primary-600">Contact us</NuxtLink></li>
            <li><NuxtLink to="/faq" class="transition-colors hover:text-primary-600">FAQ</NuxtLink></li>
            <li><NuxtLink to="/shipping" class="transition-colors hover:text-primary-600">Shipping</NuxtLink></li>
            <li><NuxtLink to="/returns" class="transition-colors hover:text-primary-600">Returns</NuxtLink></li>
            <li><NuxtLink to="/track" class="transition-colors hover:text-primary-600">Track order</NuxtLink></li>
          </ul>
        </div>

        <div>
          <h3 class="text-xs font-semibold uppercase tracking-[0.12em] text-primary-600">Studio</h3>
          <ul class="mt-4 space-y-2.5 text-sm text-neutral-500">
            <li><NuxtLink to="/about" class="transition-colors hover:text-primary-600">About</NuxtLink></li>
            <li><NuxtLink to="/blog" class="transition-colors hover:text-primary-600">Journal</NuxtLink></li>
            <li><NuxtLink to="/terms" class="transition-colors hover:text-primary-600">Terms</NuxtLink></li>
            <li><NuxtLink to="/privacy" class="transition-colors hover:text-primary-600">Privacy</NuxtLink></li>
          </ul>
        </div>
      </div>

      <div class="mt-12 flex flex-col items-center justify-center gap-3 border-t border-neutral-200 pt-6">
        <p class="text-xs text-neutral-400">© {{ year }} {{ settings.storeName }}. Cash on delivery commerce.</p>
        <div class="flex items-center gap-4 text-xs text-neutral-400">
          <span class="flex items-center gap-1"><Icon name="i-lucide-banknote" class="size-3.5" /> COD</span>
          <span class="flex items-center gap-1"><Icon name="i-lucide-shield-check" class="size-3.5" /> Verified</span>
        </div>
      </div>
    </div>
  </footer>
</template>
