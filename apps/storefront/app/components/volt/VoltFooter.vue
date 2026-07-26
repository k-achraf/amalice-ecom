<script setup lang="ts">
import type { Category } from '@amalice/shared'

const settings = useStoreSettings()
const { data: categories } = await useApiFetch<Category[]>('/categories', { key: 'store-categories' })
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-white/10 bg-black text-white">
    <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <!-- Terminal-panel header row: wordmark left, socials right, hairline below -->
      <div class="flex flex-col items-start justify-between gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-center">
        <div>
          <p class="font-display text-xl text-white">{{ settings.storeName }}<span class="text-primary-400">.</span></p>
          <p class="mt-2 max-w-sm text-sm text-white/50">Cash on delivery, no account required. Pay when it arrives.</p>
        </div>
        <div class="flex shrink-0 gap-2">
          <a href="#" class="flex size-9 items-center justify-center rounded-md border border-white/10 text-white/60 transition-colors hover:border-primary-400/60 hover:text-primary-400" aria-label="Facebook"><Icon name="i-lucide-facebook" class="size-4" /></a>
          <a href="#" class="flex size-9 items-center justify-center rounded-md border border-white/10 text-white/60 transition-colors hover:border-primary-400/60 hover:text-primary-400" aria-label="Instagram"><Icon name="i-lucide-instagram" class="size-4" /></a>
          <a href="#" class="flex size-9 items-center justify-center rounded-md border border-white/10 text-white/60 transition-colors hover:border-primary-400/60 hover:text-primary-400" aria-label="Twitter"><Icon name="i-lucide-twitter" class="size-4" /></a>
        </div>
      </div>

      <!-- Spec-sheet link row: bracket-style labels, vertical hairlines instead of grid gutters -->
      <div class="grid grid-cols-1 divide-y divide-white/10 pt-8 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div class="pb-6 sm:pb-0 sm:pr-8">
          <h3 class="spec-badge">Shop</h3>
          <ul class="mt-3 space-y-2 text-sm text-white/60">
            <li><NuxtLink to="/catalog" class="transition-colors hover:text-white">All products</NuxtLink></li>
            <li v-for="cat in (categories ?? []).slice(0, 4)" :key="cat.id"><NuxtLink :to="`/collections/${cat.slug}`" class="transition-colors hover:text-white">{{ cat.name }}</NuxtLink></li>
            <li><NuxtLink to="/deals" class="transition-colors hover:text-white">Today's deals</NuxtLink></li>
            <li><NuxtLink to="/new-arrivals" class="transition-colors hover:text-white">New arrivals</NuxtLink></li>
          </ul>
        </div>

        <div class="py-6 sm:px-8">
          <h3 class="spec-badge">Help</h3>
          <ul class="mt-3 space-y-2 text-sm text-white/60">
            <li><NuxtLink to="/contact" class="transition-colors hover:text-white">Contact us</NuxtLink></li>
            <li><NuxtLink to="/faq" class="transition-colors hover:text-white">FAQ</NuxtLink></li>
            <li><NuxtLink to="/shipping" class="transition-colors hover:text-white">Shipping</NuxtLink></li>
            <li><NuxtLink to="/returns" class="transition-colors hover:text-white">Returns</NuxtLink></li>
            <li><NuxtLink to="/track" class="transition-colors hover:text-white">Track order</NuxtLink></li>
          </ul>
        </div>

        <div class="pt-6 sm:pl-8 sm:pt-0">
          <h3 class="spec-badge">Company</h3>
          <ul class="mt-3 space-y-2 text-sm text-white/60">
            <li><NuxtLink to="/about" class="transition-colors hover:text-white">About</NuxtLink></li>
            <li><NuxtLink to="/blog" class="transition-colors hover:text-white">Blog</NuxtLink></li>
            <li><NuxtLink to="/careers" class="transition-colors hover:text-white">Careers</NuxtLink></li>
            <li><NuxtLink to="/terms" class="transition-colors hover:text-white">Terms</NuxtLink></li>
            <li><NuxtLink to="/privacy" class="transition-colors hover:text-white">Privacy</NuxtLink></li>
          </ul>
        </div>
      </div>

      <!-- Status bar -->
      <div class="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
        <p class="text-xs text-white/40">© {{ year }} {{ settings.storeName }}. Cash on delivery commerce.</p>
        <div class="font-mono-spec flex items-center gap-4 text-[11px] uppercase tracking-wide text-white/40">
          <span class="flex items-center gap-1"><Icon name="i-lucide-banknote" class="size-3.5" /> COD</span>
          <span class="flex items-center gap-1"><Icon name="i-lucide-shield-check" class="size-3.5" /> Verified</span>
        </div>
      </div>
    </div>
  </footer>
</template>
