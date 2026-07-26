<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Lumiere wishlist — white masthead + saved-products grid with a crimson
// remove chip.
const props = defineProps<{
  savedProducts: Product[]
  onRemove: (id: string) => void
}>()
</script>

<template>
  <div>
    <div class="border-b border-black bg-white">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
          <NuxtLink to="/" class="hover:text-black">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-black">Wishlist</span>
        </nav>
        <h1 class="font-display flex items-center gap-2 text-4xl text-black sm:text-5xl">
          <Icon name="i-lucide-heart" class="size-7 text-primary-600" /> Your wishlist
        </h1>
        <p class="mt-2 text-black/50">{{ props.savedProducts.length }} saved product{{ props.savedProducts.length === 1 ? '' : 's' }}</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div v-if="props.savedProducts.length" class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <div v-for="p in props.savedProducts" :key="p.id" class="relative">
          <TemplateSection name="ProductCard" :section-props="{ product: p }" />
          <button
            class="absolute -right-2 -top-2 z-10 flex size-8 items-center justify-center rounded border border-black bg-primary-600 text-white transition-colors hover:bg-black"
            aria-label="Remove from wishlist"
            @click="props.onRemove(p.id)"
          >
            <Icon name="i-lucide-x" class="size-4" />
          </button>
        </div>
      </div>
      <EmptyState v-else icon="i-lucide-heart" title="Your wishlist is empty" description="Tap the heart on any product to save it here.">
        <LumiereButton to="/catalog" class="mt-4">Browse products</LumiereButton>
      </EmptyState>
    </section>
  </div>
</template>
