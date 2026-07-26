<script setup lang="ts">
import type { Category } from '@amalice/shared'

// Trove footer — a slightly deeper cream band (still light, never dark)
// with teal accent headings and sharp-cornered social icon chips.
const settings = useStoreSettings()
const { data: categories } = await useApiFetch<Category[]>('/categories', { key: 'store-categories' })
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-neutral-200 bg-neutral-100">
    <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <!-- Centered brand block up top, echoing the header's centered wordmark
           — a genuinely different arrangement from the "brand as first grid
           column" pattern most other templates use. -->
      <div class="mx-auto flex max-w-md flex-col items-center text-center">
        <p class="font-display flex items-center gap-2 text-2xl text-[var(--color-trove-ink)]">
          <span class="flex size-8 items-center justify-center rounded-full bg-primary-500 text-[var(--color-trove-ink)]">
            <Icon name="i-lucide-gem" class="size-4" />
          </span>
          {{ settings.storeName }}
        </p>
        <p class="mt-3 text-sm text-neutral-500">Small collected treasures for everyday carry. Cash on delivery, no account required.</p>
        <div class="mt-5 flex gap-2">
          <a href="#" class="flex size-9 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-500 transition-colors hover:border-[var(--color-trove-teal)] hover:text-[var(--color-trove-teal)]" aria-label="Instagram"><Icon name="i-lucide-instagram" class="size-4" /></a>
          <a href="#" class="flex size-9 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-500 transition-colors hover:border-[var(--color-trove-teal)] hover:text-[var(--color-trove-teal)]" aria-label="Facebook"><Icon name="i-lucide-facebook" class="size-4" /></a>
          <a href="#" class="flex size-9 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-500 transition-colors hover:border-[var(--color-trove-teal)] hover:text-[var(--color-trove-teal)]" aria-label="Pinterest"><Icon name="i-lucide-image" class="size-4" /></a>
        </div>
      </div>

      <div class="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-10 border-t border-neutral-200 pt-12 text-center sm:grid-cols-3 sm:text-left">
        <div>
          <h3 class="text-xs font-bold uppercase tracking-[0.1em] text-[var(--color-trove-teal)]">Shop</h3>
          <ul class="mt-4 space-y-2.5 text-sm text-neutral-500">
            <li><NuxtLink to="/catalog" class="transition-colors hover:text-[var(--color-trove-teal)]">All products</NuxtLink></li>
            <li v-for="cat in (categories ?? []).slice(0, 4)" :key="cat.id"><NuxtLink :to="`/collections/${cat.slug}`" class="transition-colors hover:text-[var(--color-trove-teal)]">{{ cat.name }}</NuxtLink></li>
            <li><NuxtLink to="/deals" class="transition-colors hover:text-[var(--color-trove-teal)]">Today's deals</NuxtLink></li>
            <li><NuxtLink to="/new-arrivals" class="transition-colors hover:text-[var(--color-trove-teal)]">New arrivals</NuxtLink></li>
          </ul>
        </div>

        <div>
          <h3 class="text-xs font-bold uppercase tracking-[0.1em] text-[var(--color-trove-teal)]">Care</h3>
          <ul class="mt-4 space-y-2.5 text-sm text-neutral-500">
            <li><NuxtLink to="/contact" class="transition-colors hover:text-[var(--color-trove-teal)]">Contact us</NuxtLink></li>
            <li><NuxtLink to="/faq" class="transition-colors hover:text-[var(--color-trove-teal)]">FAQ</NuxtLink></li>
            <li><NuxtLink to="/shipping" class="transition-colors hover:text-[var(--color-trove-teal)]">Shipping</NuxtLink></li>
            <li><NuxtLink to="/returns" class="transition-colors hover:text-[var(--color-trove-teal)]">Returns</NuxtLink></li>
            <li><NuxtLink to="/track" class="transition-colors hover:text-[var(--color-trove-teal)]">Track order</NuxtLink></li>
          </ul>
        </div>

        <div class="col-span-2 sm:col-span-1">
          <h3 class="text-xs font-bold uppercase tracking-[0.1em] text-[var(--color-trove-teal)]">Studio</h3>
          <ul class="mt-4 space-y-2.5 text-sm text-neutral-500">
            <li><NuxtLink to="/about" class="transition-colors hover:text-[var(--color-trove-teal)]">About</NuxtLink></li>
            <li><NuxtLink to="/blog" class="transition-colors hover:text-[var(--color-trove-teal)]">Journal</NuxtLink></li>
            <li><NuxtLink to="/terms" class="transition-colors hover:text-[var(--color-trove-teal)]">Terms</NuxtLink></li>
            <li><NuxtLink to="/privacy" class="transition-colors hover:text-[var(--color-trove-teal)]">Privacy</NuxtLink></li>
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
