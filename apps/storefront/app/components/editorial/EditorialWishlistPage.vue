<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Editorial wishlist — bold uppercase masthead, magazine spread of saved items.
const props = defineProps<{
  savedProducts: Product[]
  onRemove: (id: string) => void
}>()
</script>

<template>
  <div>
    <div class="border-b-2 border-highlighted bg-default">
      <div class="mx-auto max-w-6xl px-4 py-12 text-center">
        <p class="mb-3 kicker">Saved</p>
        <h1 class="text-4xl font-bold tracking-tight text-highlighted sm:text-5xl">Your Wishlist</h1>
        <p class="mt-2 text-muted">{{ props.savedProducts.length }} item{{ props.savedProducts.length === 1 ? '' : 's' }}</p>
      </div>
    </div>

    <section class="mx-auto max-w-6xl px-4 py-12">
      <div v-if="props.savedProducts.length" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="p in props.savedProducts" :key="p.id" class="relative">
          <TemplateSection name="ProductCard" :section-props="{ product: p }" />
          <EditorialButton icon="i-lucide-x" color="error" variant="solid" size="sm" square class="absolute -right-2 -top-2 z-10 !rounded-full" aria-label="Remove" @click="props.onRemove(p.id)" />
        </div>
      </div>
      <EmptyState v-else icon="i-lucide-heart" title="Nothing saved yet" description="Tap the heart on any product to save it here.">
        <EditorialButton to="/catalog" class="mt-4 !bg-highlighted !text-inverted">Browse the catalog</EditorialButton>
      </EmptyState>
    </section>
  </div>
</template>
