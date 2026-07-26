<script setup lang="ts">
import type { Category } from '@amalice/shared'

const settings = useStoreSettings()
const { data: categories } = await useApiFetch<Category[]>('/categories', { key: 'store-categories' })
const year = new Date().getFullYear()
</script>

<template>
  <footer class="mesh-bg border-t border-neutral-100">
    <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <!-- Centered brand block, echoing the centered-logo header -->
      <div class="glow-card mx-auto flex max-w-xl flex-col items-center gap-4 p-8 text-center">
        <p class="font-display bg-gradient-to-r from-primary-600 to-[var(--color-pulse-cyan)] bg-clip-text text-3xl font-bold text-transparent">{{ settings.storeName }}</p>
        <p class="max-w-sm text-sm text-neutral-500">The latest gadgets, delivered fast. Cash on delivery, no account required.</p>
        <div class="flex gap-2">
          <a href="#" class="flex size-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-600" aria-label="Instagram"><Icon name="i-lucide-instagram" class="size-4" /></a>
          <a href="#" class="flex size-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-600" aria-label="Facebook"><Icon name="i-lucide-facebook" class="size-4" /></a>
          <a href="#" class="flex size-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition-colors hover:border-primary-400 hover:bg-primary-50 hover:text-primary-600" aria-label="YouTube"><Icon name="i-lucide-youtube" class="size-4" /></a>
        </div>
      </div>

      <!-- Link columns, centered as a row beneath the brand block -->
      <div class="mt-12 grid grid-cols-1 gap-10 text-center sm:grid-cols-3">
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
          <h3 class="text-xs font-semibold uppercase tracking-[0.12em] text-primary-600">Company</h3>
          <ul class="mt-4 space-y-2.5 text-sm text-neutral-500">
            <li><NuxtLink to="/about" class="transition-colors hover:text-primary-600">About</NuxtLink></li>
            <li><NuxtLink to="/blog" class="transition-colors hover:text-primary-600">Blog</NuxtLink></li>
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
