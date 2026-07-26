<script setup lang="ts">
// Promify home hero — gradient decorative panel + headline + dual CTA.
// Mirrors the Promify HeroSection: 2-col grid, badge pill, huge headline with
// a primary-colored span, supporting copy, Shop/Deals buttons, and a gradient
// visual block with decorative circles. Promify palette via .tpl-promify.
const settings = useStoreSettings()
</script>

<template>
  <section class="relative overflow-hidden bg-neutral-50">
    <div class="mx-auto grid max-w-7xl items-center gap-8 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2 lg:gap-16 lg:px-8">
      <!-- Text -->
      <div class="text-center lg:text-left">
        <span class="inline-block rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700">
          New Season Collection
        </span>
        <h1 class="mt-4 text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
          Discover Your
          <span class="text-primary-600">Perfect Style</span>
        </h1>
        <p class="mt-4 text-lg leading-relaxed text-neutral-500 sm:mt-6 sm:text-xl">
          Explore {{ settings.storeName }}'s curated collection. From everyday essentials to exclusive finds — cash on delivery, no account needed.
        </p>
        <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
          <PromifyButton to="/catalog" size="xl" trailing-icon="i-lucide-arrow-right">
            Shop Now
          </PromifyButton>
          <PromifyButton to="/deals" size="xl" color="neutral" variant="outline">View Deals</PromifyButton>
        </div>
      </div>

      <!-- Visual -->
      <div class="relative flex items-center justify-center">
        <div class="absolute size-72 rounded-full bg-primary-100/60 sm:size-96" />
        <div class="absolute -right-4 -top-4 size-32 rounded-full bg-primary-200/40" />
        <div class="relative size-80 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-200 to-primary-400 sm:size-96">
          <div class="flex h-full items-center justify-center">
            <Icon name="i-lucide-store" class="size-30 text-white/60" style="width: 120px; height: 120px;" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
