<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Volt wishlist — header band + saved-products grid, hairline-bordered
// remove button.
const props = defineProps<{
  savedProducts: Product[]
  onRemove: (id: string) => void
}>()
</script>

<template>
  <div class="bg-black">
    <div class="border-b border-white/10 bg-black">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <nav class="font-mono-spec mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-white/40">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-primary-400">Wishlist</span>
        </nav>
        <h1 class="font-display flex items-center gap-2 text-3xl text-white sm:text-4xl">
          <Icon name="i-lucide-heart" class="size-7 text-primary-400" /> Your wishlist
        </h1>
        <p class="mt-2 text-white/40">{{ props.savedProducts.length }} saved product{{ props.savedProducts.length === 1 ? '' : 's' }}</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div v-if="props.savedProducts.length" class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <div v-for="p in props.savedProducts" :key="p.id" class="relative">
          <TemplateSection name="ProductCard" :section-props="{ product: p }" />
          <button
            class="absolute -right-2 -top-2 z-10 flex size-8 items-center justify-center rounded-md border border-white/10 bg-black text-white/60 transition-colors hover:border-red-400/50 hover:text-red-400"
            aria-label="Remove from wishlist"
            @click="props.onRemove(p.id)"
          >
            <Icon name="i-lucide-x" class="size-4" />
          </button>
        </div>
      </div>
      <EmptyState v-else icon="i-lucide-heart" title="Your wishlist is empty" description="Tap the heart on any product to save it here.">
        <VoltButton to="/catalog" class="mt-4">Browse products</VoltButton>
      </EmptyState>
    </section>
  </div>
</template>
