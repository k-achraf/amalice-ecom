<script setup lang="ts">
// Bloom home hero — a soft pink-to-cream gradient wash (never a dark panel
// — Bloom stays light and airy everywhere), a bubbly Poppins headline, and
// a circular "blooming" visual instead of a product-photo dependency.
const settings = useStoreSettings()
</script>

<template>
  <section class="relative overflow-visible bg-gradient-to-br from-[var(--color-bloom-hero-from)] to-[var(--color-bloom-hero-to)] pb-28 sm:pb-32">
    <!-- Centered text — single column, not a split -->
    <div class="mx-auto max-w-2xl px-4 pt-20 text-center sm:px-6 sm:pt-24 lg:px-8">
      <span class="glow-dot">New drop</span>
      <h1 class="font-display mt-6 text-5xl leading-[1.08] text-[var(--color-bloom-ink)] sm:text-6xl lg:text-7xl">
        Glow, the
        <span class="text-primary-500">easy</span> way.
      </h1>
      <p class="mx-auto mt-6 max-w-md text-base leading-relaxed text-neutral-600">
        {{ settings.storeName }}'s curated edit of skin- and self-love essentials. Cash on delivery — try it first, pay when it arrives.
      </p>
      <div class="mt-9 flex flex-wrap justify-center gap-3">
        <BloomButton to="/catalog" size="lg" trailing-icon="i-lucide-arrow-right">Shop the edit</BloomButton>
        <BloomButton to="/deals" size="lg" variant="outline">View deals</BloomButton>
      </div>
    </div>

    <!-- Centered rounded photo, overlapping the section's own bottom edge -->
    <div class="absolute inset-x-0 -bottom-20 flex justify-center sm:-bottom-24">
      <div class="relative flex size-48 items-center justify-center rounded-[3rem] bg-gradient-to-br from-primary-300 to-primary-500 shadow-[var(--shadow-bloom-lg)] ring-8 ring-white sm:size-56">
        <Icon name="i-lucide-flower-2" class="size-20 text-white" />
      </div>
    </div>
  </section>
</template>
