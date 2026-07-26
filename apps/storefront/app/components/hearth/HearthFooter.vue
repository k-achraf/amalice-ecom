<script setup lang="ts">
import type { Category } from '@amalice/shared'

// Hearth footer — a warm, slightly deeper linen band (still light, never
// dark) with terracotta accent headings and cozy rounded-xl social icons.
const settings = useStoreSettings()
const { data: categories } = await useApiFetch<Category[]>('/categories', { key: 'store-categories' })
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-neutral-200 bg-neutral-100">
    <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <!-- Brand band — a wide hearth-card banner, not a grid column -->
      <div class="hearth-card flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="font-display flex items-center gap-2 text-2xl text-[var(--color-hearth-ink)]">
            <Icon name="i-lucide-home" class="size-5 text-primary-600" />
            {{ settings.storeName }}
          </p>
          <p class="mt-2 max-w-sm text-sm text-neutral-500">Pieces for a home well-lived-in. Cash on delivery, no account required.</p>
        </div>
        <div class="flex shrink-0 gap-2">
          <a href="#" class="flex size-9 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-500 transition-colors hover:border-primary-400 hover:text-primary-600" aria-label="Instagram"><Icon name="i-lucide-instagram" class="size-4" /></a>
          <a href="#" class="flex size-9 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-500 transition-colors hover:border-primary-400 hover:text-primary-600" aria-label="Facebook"><Icon name="i-lucide-facebook" class="size-4" /></a>
          <a href="#" class="flex size-9 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-500 transition-colors hover:border-primary-400 hover:text-primary-600" aria-label="Pinterest"><Icon name="i-lucide-image" class="size-4" /></a>
        </div>
      </div>

      <!-- Link columns — divided by hairlines, not gridded boxes -->
      <div class="mt-10 grid grid-cols-1 divide-y divide-neutral-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div class="pb-6 sm:pb-0 sm:pr-8">
          <h3 class="text-xs font-semibold uppercase tracking-[0.1em] text-primary-600">Shop</h3>
          <ul class="mt-4 space-y-2.5 text-sm text-neutral-500">
            <li><NuxtLink to="/catalog" class="transition-colors hover:text-primary-600">All products</NuxtLink></li>
            <li v-for="cat in (categories ?? []).slice(0, 4)" :key="cat.id"><NuxtLink :to="`/collections/${cat.slug}`" class="transition-colors hover:text-primary-600">{{ cat.name }}</NuxtLink></li>
            <li><NuxtLink to="/deals" class="transition-colors hover:text-primary-600">Today's deals</NuxtLink></li>
            <li><NuxtLink to="/new-arrivals" class="transition-colors hover:text-primary-600">New arrivals</NuxtLink></li>
          </ul>
        </div>

        <div class="py-6 sm:px-8">
          <h3 class="text-xs font-semibold uppercase tracking-[0.1em] text-primary-600">Care</h3>
          <ul class="mt-4 space-y-2.5 text-sm text-neutral-500">
            <li><NuxtLink to="/contact" class="transition-colors hover:text-primary-600">Contact us</NuxtLink></li>
            <li><NuxtLink to="/faq" class="transition-colors hover:text-primary-600">FAQ</NuxtLink></li>
            <li><NuxtLink to="/shipping" class="transition-colors hover:text-primary-600">Shipping</NuxtLink></li>
            <li><NuxtLink to="/returns" class="transition-colors hover:text-primary-600">Returns</NuxtLink></li>
            <li><NuxtLink to="/track" class="transition-colors hover:text-primary-600">Track order</NuxtLink></li>
          </ul>
        </div>

        <div class="pt-6 sm:pl-8 sm:pt-0">
          <h3 class="text-xs font-semibold uppercase tracking-[0.1em] text-primary-600">Studio</h3>
          <ul class="mt-4 space-y-2.5 text-sm text-neutral-500">
            <li><NuxtLink to="/about" class="transition-colors hover:text-primary-600">About</NuxtLink></li>
            <li><NuxtLink to="/blog" class="transition-colors hover:text-primary-600">Journal</NuxtLink></li>
            <li><NuxtLink to="/terms" class="transition-colors hover:text-primary-600">Terms</NuxtLink></li>
            <li><NuxtLink to="/privacy" class="transition-colors hover:text-primary-600">Privacy</NuxtLink></li>
          </ul>
        </div>
      </div>

      <div class="mt-12 flex flex-col items-center justify-between gap-4 border-t border-neutral-200 pt-6 sm:flex-row">
        <p class="text-xs text-neutral-400">© {{ year }} {{ settings.storeName }}. Cash on delivery commerce.</p>
        <div class="flex items-center gap-4 text-xs text-neutral-400">
          <span class="flex items-center gap-1"><Icon name="i-lucide-banknote" class="size-3.5" /> COD</span>
          <span class="flex items-center gap-1"><Icon name="i-lucide-shield-check" class="size-3.5" /> Verified</span>
        </div>
      </div>
    </div>
  </footer>
</template>
