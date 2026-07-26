<script setup lang="ts">
import type { Category } from '@amalice/shared'

// Forge footer — dark ink surface, hazard-stripe top edge, blocky uppercase
// columns. No @nuxt/ui.
const settings = useStoreSettings()
const { data: categories } = await useApiFetch<Category[]>('/categories', { key: 'store-categories' })
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t-[3px] border-[var(--color-forge-ink)] bg-[var(--color-forge-ink)] text-white">
    <div class="hazard-stripe h-2 w-full" aria-hidden="true" />

    <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <!-- Brand block as a full-width row up top, wordmark left / social
           right — then a numbered, divider-bordered column strip below,
           reading like a spec-sheet's indexed sections rather than a plain
           4-up grid. -->
      <div class="flex flex-col items-start justify-between gap-4 border-b-[3px] border-white/15 pb-8 sm:flex-row sm:items-center">
        <p class="font-display flex items-center gap-1 text-2xl uppercase">
          <span class="text-primary-500">[</span>{{ settings.storeName }}<span class="text-primary-500">]</span>
        </p>
        <div class="flex gap-2">
          <a href="#" class="flex size-9 items-center justify-center border-2 border-white/30 text-white transition-colors hover:border-primary-500 hover:text-primary-500" aria-label="Facebook"><Icon name="i-lucide-facebook" class="size-4" /></a>
          <a href="#" class="flex size-9 items-center justify-center border-2 border-white/30 text-white transition-colors hover:border-primary-500 hover:text-primary-500" aria-label="Instagram"><Icon name="i-lucide-instagram" class="size-4" /></a>
          <a href="#" class="flex size-9 items-center justify-center border-2 border-white/30 text-white transition-colors hover:border-primary-500 hover:text-primary-500" aria-label="Twitter"><Icon name="i-lucide-twitter" class="size-4" /></a>
        </div>
      </div>

      <div class="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 sm:divide-x-[3px] sm:divide-white/15">
        <div>
          <p class="mb-3 text-sm text-white/60">Cash on delivery, no account required. Pay when it arrives.</p>
        </div>

        <div class="sm:pl-6">
          <h3 class="font-mono text-xs font-bold uppercase tracking-wide text-primary-500">01 / Shop</h3>
          <ul class="mt-3 space-y-2 text-sm text-white/70">
            <li><NuxtLink to="/catalog" class="transition-colors hover:text-white">All products</NuxtLink></li>
            <li v-for="cat in (categories ?? []).slice(0, 4)" :key="cat.id"><NuxtLink :to="`/collections/${cat.slug}`" class="transition-colors hover:text-white">{{ cat.name }}</NuxtLink></li>
            <li><NuxtLink to="/deals" class="transition-colors hover:text-white">Today's deals</NuxtLink></li>
            <li><NuxtLink to="/new-arrivals" class="transition-colors hover:text-white">New arrivals</NuxtLink></li>
          </ul>
        </div>

        <div class="sm:pl-6">
          <h3 class="font-mono text-xs font-bold uppercase tracking-wide text-primary-500">02 / Help</h3>
          <ul class="mt-3 space-y-2 text-sm text-white/70">
            <li><NuxtLink to="/contact" class="transition-colors hover:text-white">Contact us</NuxtLink></li>
            <li><NuxtLink to="/faq" class="transition-colors hover:text-white">FAQ</NuxtLink></li>
            <li><NuxtLink to="/shipping" class="transition-colors hover:text-white">Shipping</NuxtLink></li>
            <li><NuxtLink to="/returns" class="transition-colors hover:text-white">Returns</NuxtLink></li>
            <li><NuxtLink to="/track" class="transition-colors hover:text-white">Track order</NuxtLink></li>
          </ul>
        </div>

        <div class="sm:pl-6">
          <h3 class="font-mono text-xs font-bold uppercase tracking-wide text-primary-500">03 / Company</h3>
          <ul class="mt-3 space-y-2 text-sm text-white/70">
            <li><NuxtLink to="/about" class="transition-colors hover:text-white">About</NuxtLink></li>
            <li><NuxtLink to="/blog" class="transition-colors hover:text-white">Blog</NuxtLink></li>
            <li><NuxtLink to="/careers" class="transition-colors hover:text-white">Careers</NuxtLink></li>
            <li><NuxtLink to="/terms" class="transition-colors hover:text-white">Terms</NuxtLink></li>
            <li><NuxtLink to="/privacy" class="transition-colors hover:text-white">Privacy</NuxtLink></li>
          </ul>
        </div>
      </div>

      <div class="mt-10 flex flex-col items-center justify-between gap-4 border-t-2 border-white/20 pt-6 sm:flex-row">
        <p class="text-xs text-white/50">© {{ year }} {{ settings.storeName }}. Cash on delivery commerce.</p>
        <div class="flex items-center gap-4 text-xs text-white/50">
          <span class="flex items-center gap-1"><Icon name="i-lucide-banknote" class="size-3.5" /> COD</span>
          <span class="flex items-center gap-1"><Icon name="i-lucide-shield-check" class="size-3.5" /> Verified</span>
        </div>
      </div>
    </div>
  </footer>
</template>
