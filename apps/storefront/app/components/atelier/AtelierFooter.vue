<script setup lang="ts">
import type { Category } from '@amalice/shared'

const settings = useStoreSettings()
const { data: categories } = await useApiFetch<Category[]>('/categories', { key: 'store-categories' })
const year = new Date().getFullYear()
</script>

<template>
  <footer class="velvet-panel border-t border-white/10">
    <div class="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div class="grid grid-cols-2 gap-10 md:grid-cols-4">
        <div class="relative col-span-2 md:col-span-1">
          <!-- Decorative ring motif echoing the hero's gem/ring visual -->
          <div class="pointer-events-none absolute -left-6 -top-10 size-24 rounded-full border border-primary-400/20" aria-hidden="true" />
          <p class="font-display text-3xl text-[var(--color-atelier-cream)]">{{ settings.storeName }}</p>
          <p class="mt-3 text-sm text-[var(--color-atelier-cream)]/60">Fine pieces, delivered with care. Cash on delivery, no account required.</p>
          <div class="mt-5 flex gap-2">
            <a href="#" class="flex size-9 items-center justify-center rounded-full border border-white/20 text-[var(--color-atelier-cream)]/70 transition-colors hover:border-primary-400 hover:text-primary-300" aria-label="Instagram"><Icon name="i-lucide-instagram" class="size-4" /></a>
            <a href="#" class="flex size-9 items-center justify-center rounded-full border border-white/20 text-[var(--color-atelier-cream)]/70 transition-colors hover:border-primary-400 hover:text-primary-300" aria-label="Facebook"><Icon name="i-lucide-facebook" class="size-4" /></a>
            <a href="#" class="flex size-9 items-center justify-center rounded-full border border-white/20 text-[var(--color-atelier-cream)]/70 transition-colors hover:border-primary-400 hover:text-primary-300" aria-label="Pinterest"><Icon name="i-lucide-image" class="size-4" /></a>
          </div>
        </div>

        <div>
          <h3 class="text-xs font-semibold uppercase tracking-[0.15em] text-primary-300">Shop</h3>
          <ul class="mt-4 space-y-2.5 text-sm text-[var(--color-atelier-cream)]/60">
            <li><NuxtLink to="/catalog" class="transition-colors hover:text-primary-300">All pieces</NuxtLink></li>
            <li v-for="cat in (categories ?? []).slice(0, 4)" :key="cat.id"><NuxtLink :to="`/collections/${cat.slug}`" class="transition-colors hover:text-primary-300">{{ cat.name }}</NuxtLink></li>
            <li><NuxtLink to="/deals" class="transition-colors hover:text-primary-300">Today's deals</NuxtLink></li>
            <li><NuxtLink to="/new-arrivals" class="transition-colors hover:text-primary-300">New arrivals</NuxtLink></li>
          </ul>
        </div>

        <div>
          <h3 class="text-xs font-semibold uppercase tracking-[0.15em] text-primary-300">Care</h3>
          <ul class="mt-4 space-y-2.5 text-sm text-[var(--color-atelier-cream)]/60">
            <li><NuxtLink to="/contact" class="transition-colors hover:text-primary-300">Contact us</NuxtLink></li>
            <li><NuxtLink to="/faq" class="transition-colors hover:text-primary-300">FAQ</NuxtLink></li>
            <li><NuxtLink to="/shipping" class="transition-colors hover:text-primary-300">Shipping</NuxtLink></li>
            <li><NuxtLink to="/returns" class="transition-colors hover:text-primary-300">Returns</NuxtLink></li>
            <li><NuxtLink to="/track" class="transition-colors hover:text-primary-300">Track order</NuxtLink></li>
          </ul>
        </div>

        <div>
          <h3 class="text-xs font-semibold uppercase tracking-[0.15em] text-primary-300">Maison</h3>
          <ul class="mt-4 space-y-2.5 text-sm text-[var(--color-atelier-cream)]/60">
            <li><NuxtLink to="/about" class="transition-colors hover:text-primary-300">About</NuxtLink></li>
            <li><NuxtLink to="/blog" class="transition-colors hover:text-primary-300">Journal</NuxtLink></li>
            <li><NuxtLink to="/terms" class="transition-colors hover:text-primary-300">Terms</NuxtLink></li>
            <li><NuxtLink to="/privacy" class="transition-colors hover:text-primary-300">Privacy</NuxtLink></li>
          </ul>
        </div>
      </div>

      <div class="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
        <p class="text-xs text-[var(--color-atelier-cream)]/40">© {{ year }} {{ settings.storeName }}. Cash on delivery commerce.</p>
        <div class="flex items-center gap-4 text-xs text-[var(--color-atelier-cream)]/40">
          <span class="flex items-center gap-1"><Icon name="i-lucide-banknote" class="size-3.5" /> COD</span>
          <span class="flex items-center gap-1"><Icon name="i-lucide-shield-check" class="size-3.5" /> Verified</span>
        </div>
      </div>
    </div>
  </footer>
</template>
