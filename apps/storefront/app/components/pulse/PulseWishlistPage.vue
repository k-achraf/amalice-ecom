<script setup lang="ts">
import type { Product } from '@amalice/shared'

const props = defineProps<{
  savedProducts: Product[]
  onRemove: (id: string) => void
}>()
</script>

<template>
  <div>
    <div class="border-b border-neutral-100 bg-white">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
          <NuxtLink to="/" class="hover:text-primary-600">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3" />
          <span class="text-neutral-600">Wishlist</span>
        </nav>
        <h1 class="font-display flex items-center gap-2 text-4xl text-neutral-900 sm:text-5xl">
          <Icon name="i-lucide-heart" class="size-8 text-primary-500" /> Saved products
        </h1>
        <p class="mt-2 text-neutral-500">{{ props.savedProducts.length }} saved product{{ props.savedProducts.length === 1 ? '' : 's' }}</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div v-if="props.savedProducts.length" class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <div v-for="p in props.savedProducts" :key="p.id" class="relative">
          <TemplateSection name="ProductCard" :section-props="{ product: p }" />
          <button
            class="absolute -right-2 -top-2 z-10 flex size-8 items-center justify-center rounded-full bg-primary-600 text-white shadow-[var(--shadow-pulse-sm)] transition-colors hover:bg-primary-700"
            aria-label="Remove from wishlist"
            @click="props.onRemove(p.id)"
          >
            <Icon name="i-lucide-x" class="size-4" />
          </button>
        </div>
      </div>
      <EmptyState v-else icon="i-lucide-heart" title="Your wishlist is empty" description="Tap the heart on any product to save it here.">
        <PulseButton to="/catalog" class="mt-4">Browse products</PulseButton>
      </EmptyState>
    </section>
  </div>
</template>
