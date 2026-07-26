<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Boutique wishlist — a quiet saved edit. Narrow centered header, refined 3-col
// grid, remove rendered as a discreet uppercase text affordance rather than a
// loud trash button. Each card carries the boutique ProductCard.
const props = defineProps<{
  savedProducts: Product[]
  onRemove: (id: string) => void
}>()
</script>

<template>
  <div class="bg-default">
    <!-- Narrow header -->
    <header class="mx-auto max-w-5xl px-6 pt-24 text-center sm:pt-32">
      <nav class="mb-8 text-xs uppercase tracking-[0.3em] text-muted">
        <NuxtLink to="/" class="transition-colors hover:text-highlighted">Home</NuxtLink>
        <span class="mx-2">/</span>
        <span class="text-highlighted">Saved</span>
      </nav>
      <p class="text-xs uppercase tracking-[0.4em] text-muted">Your wishlist</p>
      <h1 class="mt-6 text-3xl font-light tracking-tight text-highlighted sm:text-4xl">Saved Pieces</h1>
      <p class="mt-6 text-xs uppercase tracking-[0.3em] text-muted">
        {{ props.savedProducts.length }} item{{ props.savedProducts.length === 1 ? '' : 's' }}
      </p>
      <div class="mx-auto mt-10 h-px w-12 bg-default" />
    </header>

    <!-- Grid -->
    <section class="mx-auto max-w-5xl px-6 py-20 sm:py-24">
      <EmptyState
        v-if="!props.savedProducts.length"
        icon="i-lucide-heart"
        title="Nothing saved yet"
        description="Tap the heart on any piece to keep it here."
      >
        <BoutiqueButton to="/catalog" color="neutral" variant="outline" class="mt-6">
          Browse the collection
        </BoutiqueButton>
      </EmptyState>

      <div v-else class="grid grid-cols-1 gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="p in props.savedProducts" :key="p.id" class="group relative">
          <TemplateSection name="ProductCard" :section-props="{ product: p }" />
          <div class="mt-4 text-center">
            <BoutiqueButton
              color="neutral"
              variant="ghost"
              size="sm"
              class="!text-muted hover:!text-error"
              icon="i-lucide-x"
              aria-label="Remove from wishlist"
              @click="props.onRemove(p.id)"
            >
              Remove
            </BoutiqueButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
