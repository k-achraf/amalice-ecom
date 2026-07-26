<script setup lang="ts">
import type { Product } from '@amalice/shared'

// Promify wishlist — light header band (bg-neutral-50) with breadcrumb +
// title, grid of cards each with a rounded remove button anchored at
// -top-2 -right-2. Promify palette resolves under .tpl-promify.
const props = defineProps<{
  savedProducts: Product[]
  onRemove: (id: string) => void
}>()
</script>

<template>
  <div>
    <!-- Light header band -->
    <div class="border-b border-neutral-100 bg-neutral-50">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <nav class="mb-3 flex items-center gap-2 text-sm text-neutral-500">
          <NuxtLink to="/" class="transition-colors hover:text-primary-600">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-neutral-900">Wishlist</span>
        </nav>
        <h1 class="flex items-center gap-2 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          <Icon name="i-lucide-heart" class="size-7 text-primary-600" /> Your wishlist
        </h1>
        <p class="mt-2 text-neutral-500">{{ props.savedProducts.length }} saved product{{ props.savedProducts.length === 1 ? '' : 's' }}</p>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div v-if="props.savedProducts.length" class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <div v-for="p in props.savedProducts" :key="p.id" class="relative">
          <TemplateSection name="ProductCard" :section-props="{ product: p }" />
          <PromifyButton
            icon="i-lucide-x"
            color="error"
            variant="solid"
            size="sm"
            square
            class="absolute -right-2 -top-2 z-10 !rounded-full shadow-lg shadow-red-500/30"
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
        <PromifyButton to="/catalog" class="mt-4">Browse products</PromifyButton>
      </EmptyState>
    </section>
  </div>
</template>
