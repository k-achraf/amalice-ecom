<script setup lang="ts">
// Atelier home hero — a velvet (deep emerald-black) panel with a delicate
// Cormorant headline, a rose-gold accent word, and a circular decorative
// visual (the ring/gem motif) rather than a product photo dependency.
const settings = useStoreSettings()
</script>

<template>
  <section class="grid grid-cols-1 lg:grid-cols-2">
    <!-- Velvet panel — the image/visual half, full-height dark surface -->
    <div class="velvet-panel relative flex items-center justify-center px-4 py-16 sm:px-6 md:py-24 lg:order-1 lg:px-10">
      <div class="relative mx-auto flex aspect-square w-full max-w-sm items-center justify-center">
        <div class="absolute inset-0 rounded-full border border-primary-400/20" />
        <div class="absolute inset-8 rounded-full border border-primary-400/30" />
        <div class="absolute inset-16 rounded-full border border-primary-400/40" />
        <div class="flex size-40 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 shadow-[var(--shadow-atelier-lg)]">
          <Icon name="i-lucide-gem" class="size-16 text-white" />
        </div>
      </div>
    </div>

    <!-- Cream panel — the text half -->
    <div class="flex items-center bg-[var(--color-atelier-cream)] px-4 py-16 sm:px-6 md:py-24 lg:order-2 lg:px-16">
      <div class="mx-auto max-w-md text-center lg:mx-0 lg:text-left">
        <span class="ring-badge">New collection</span>
        <h1 class="font-display mt-6 text-5xl leading-[1.05] text-[var(--color-atelier-ink)] sm:text-6xl">
          Pieces worth
          <span class="italic text-primary-600">keeping.</span>
        </h1>
        <p class="mx-auto mt-6 max-w-md text-base leading-relaxed text-neutral-600 lg:mx-0">
          {{ settings.storeName }}'s curated edit of fine jewelry and accessories. Cash on delivery — see it in hand before you keep it.
        </p>
        <div class="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start">
          <AtelierButton to="/catalog" size="lg" trailing-icon="i-lucide-arrow-right">Shop the collection</AtelierButton>
          <AtelierButton to="/deals" size="lg" variant="outline">View deals</AtelierButton>
        </div>
      </div>
    </div>
  </section>
</template>
