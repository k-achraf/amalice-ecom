<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Trove wishlist — light cream header band, circle-on-sharp-frame saved-
// products grid with a sharp remove button in the corner of each card.
const props = defineProps<{
  savedProducts: Product[]
  onRemove: (id: string) => void
}>()
</script>

<template>
  <div>
    <div class="border-b border-neutral-200 bg-[var(--color-trove-cream)]">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-neutral-400">
          <NuxtLink to="/" class="hover:text-[var(--color-trove-teal)]">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-neutral-600">Wishlist</span>
        </nav>
        <h1 class="font-display text-4xl text-[var(--color-trove-ink)] sm:text-5xl">Your wishlist</h1>
        <p class="mt-2 text-neutral-600">{{ props.savedProducts.length }} saved find{{ props.savedProducts.length === 1 ? '' : 's' }}</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div v-if="props.savedProducts.length" class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <div v-for="p in props.savedProducts" :key="p.id" class="relative">
          <TemplateSection name="ProductCard" :section-props="{ product: p }" />
          <button
            class="absolute -right-2 -top-2 z-10 flex size-9 items-center justify-center rounded bg-white text-neutral-500 shadow-[var(--shadow-trove-md)] transition-colors hover:text-primary-700"
            aria-label="Remove from wishlist"
            @click="props.onRemove(p.id)"
          >
            <Icon name="i-lucide-x" class="size-4" />
          </button>
        </div>
      </div>
      <EmptyState v-else icon="i-lucide-heart" title="Your wishlist is empty" description="Tap the heart on any find to save it here.">
        <TroveButton to="/catalog" class="mt-4">Browse the trove</TroveButton>
      </EmptyState>
    </section>
  </div>
</template>
