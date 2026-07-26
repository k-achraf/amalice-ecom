<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Minimal (fallback) wishlist presentation — header band + saved-products grid.
const props = defineProps<{
  savedProducts: Product[]
  onRemove: (id: string) => void
}>()
</script>

<template>
  <div>
    <div class="border-b border-default bg-elevated">
      <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <nav class="mb-4 flex items-center gap-2 text-sm text-muted">
          <NuxtLink to="/" class="hover:text-highlighted">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span>Wishlist</span>
        </nav>
        <h1 class="text-3xl font-bold">Your wishlist</h1>
        <p class="mt-2 text-muted">{{ props.savedProducts.length }} saved product{{ props.savedProducts.length === 1 ? '' : 's' }}</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div v-if="props.savedProducts.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
        <div v-for="p in props.savedProducts" :key="p.id" class="relative">
          <TemplateSection name="ProductCard" :section-props="{ product: p }" />
          <Button
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="sm"
            square
            class="absolute -right-2 -top-2 z-10 bg-default shadow-sm"
            aria-label="Remove from wishlist"
            @click="props.onRemove(p.id)"
          />
        </div>
      </div>
      <EmptyState
        v-else
        icon="i-lucide-heart"
        title="Your wishlist is empty"
        description="Tap the heart on any product to save it here."
      >
        <Button to="/catalog" color="primary" class="mt-4">Browse products</Button>
      </EmptyState>
    </section>
  </div>
</template>
