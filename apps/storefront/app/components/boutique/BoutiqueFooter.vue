<script setup lang="ts">
import type { Category } from '@amalice/shared'

const settings = useStoreSettings()
const { data: categories } = await useApiFetch<Category[]>('/categories', { key: 'store-categories' })
</script>

<template>
  <!-- Boutique footer — a single centered column (the same "no split" ethos as
       the PDP), not a 4-column grid. One flowing, wrapped nav of links under
       the house mark, framed by thin rules top and bottom. -->
  <footer class="mt-32 border-t border-default bg-default">
    <div class="mx-auto max-w-2xl px-6 py-20 text-center">
      <p class="font-display text-xl tracking-[0.2em] uppercase text-highlighted">{{ settings.storeName }}</p>
      <div class="mx-auto my-10 h-px w-12 bg-default" />

      <nav class="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-xs uppercase tracking-widest text-muted">
        <NuxtLink to="/catalog" class="transition-colors hover:text-highlighted">All products</NuxtLink>
        <NuxtLink v-for="cat in categories" :key="cat.id" :to="`/collections/${cat.slug}`" class="transition-colors hover:text-highlighted">{{ cat.name }}</NuxtLink>
        <NuxtLink to="/contact" class="transition-colors hover:text-highlighted">Contact</NuxtLink>
        <NuxtLink to="/faq" class="transition-colors hover:text-highlighted">FAQ</NuxtLink>
        <NuxtLink to="/shipping" class="transition-colors hover:text-highlighted">Shipping</NuxtLink>
        <NuxtLink to="/returns" class="transition-colors hover:text-highlighted">Returns</NuxtLink>
        <NuxtLink to="/about" class="transition-colors hover:text-highlighted">About</NuxtLink>
        <NuxtLink to="/terms" class="transition-colors hover:text-highlighted">Terms</NuxtLink>
        <NuxtLink to="/privacy" class="transition-colors hover:text-highlighted">Privacy</NuxtLink>
      </nav>

      <div class="mx-auto my-10 h-px w-12 bg-default" />
      <p class="text-xs uppercase tracking-widest text-muted">Cash on delivery — Phone-verified orders — No account needed</p>
      <p class="mt-8 text-xs tracking-widest text-muted uppercase">© {{ new Date().getFullYear() }} {{ settings.storeName }}</p>
    </div>
  </footer>
</template>
