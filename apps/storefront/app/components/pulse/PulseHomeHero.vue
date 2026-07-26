<script setup lang="ts">
// Pulse home hero — the gradient-mesh background moment: a bold Outfit
// headline, spec-chip badges, and a glossy floating device-card visual
// instead of a real product-photo dependency.
const settings = useStoreSettings()
</script>

<template>
  <section class="mesh-bg relative overflow-hidden">
    <div class="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-5 lg:gap-8 lg:px-8">
      <!-- Text — takes the wider lane, so the visual reads as an off-center accent, not a mirrored half -->
      <div class="text-center lg:col-span-3 lg:text-left">
        <span class="spec-chip"><Icon name="i-lucide-sparkles" class="size-3.5" /> New drop</span>
        <h1 class="font-display mt-6 text-5xl leading-[1.05] text-neutral-900 sm:text-6xl lg:text-7xl">
          Tech that
          <span class="bg-gradient-to-r from-primary-500 to-[var(--color-pulse-cyan)] bg-clip-text text-transparent">feels good.</span>
        </h1>
        <p class="mx-auto mt-6 max-w-md text-base leading-relaxed text-neutral-500 lg:mx-0">
          {{ settings.storeName }}'s curated edit of gadgets and accessories. Cash on delivery — try it in hand before you keep it.
        </p>
        <div class="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start">
          <PulseButton to="/catalog" size="lg" trailing-icon="i-lucide-arrow-right">Shop now</PulseButton>
          <PulseButton to="/deals" size="lg" variant="outline">View deals</PulseButton>
        </div>
        <div class="mt-8 flex flex-wrap justify-center gap-2 lg:justify-start">
          <span class="spec-chip">5G ready</span>
          <span class="spec-chip">USB-C</span>
          <span class="spec-chip">24h battery</span>
        </div>
      </div>

      <!-- Visual — a floating glossy device card, deliberately off-center: narrower lane, shifted up and
           rotated rather than centered/mirrored, so it reads as a card dropped onto the page, not a symmetric half -->
      <div class="relative mx-auto h-full min-h-[22rem] w-full max-w-xs lg:col-span-2 lg:mx-0">
        <div class="absolute -top-4 right-0 size-64 rounded-full bg-gradient-to-br from-primary-200/50 to-[var(--color-pulse-cyan-soft)]/50 blur-2xl" />
        <div class="glossy-highlight absolute left-1/2 top-4 flex w-60 -translate-x-1/2 rotate-[-4deg] flex-col items-center justify-center gap-4 rounded-[2rem] bg-white p-6 shadow-[var(--shadow-pulse-lg)] sm:left-auto sm:right-2 sm:translate-x-0 lg:right-6 lg:top-10">
          <div class="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-400 to-[var(--color-pulse-cyan)] shadow-[var(--shadow-pulse-md)]">
            <Icon name="i-lucide-headphones" class="size-10 text-white" />
          </div>
          <div class="text-center">
            <p class="font-display text-lg text-neutral-900">Pulse Buds</p>
            <p class="text-xs text-neutral-400">Wireless · ANC</p>
          </div>
          <span class="spec-chip">In stock</span>
        </div>
        <!-- A second, smaller chip card offset further down-left, reinforcing the scattered/off-center feel -->
        <div class="glossy-highlight absolute bottom-2 left-2 hidden w-32 rotate-[3deg] items-center gap-2 rounded-2xl bg-white p-3 shadow-[var(--shadow-pulse-md)] sm:flex">
          <Icon name="i-lucide-battery-charging" class="size-5 text-primary-500" />
          <span class="text-xs font-semibold text-neutral-700">24h battery</span>
        </div>
      </div>
    </div>
  </section>
</template>
