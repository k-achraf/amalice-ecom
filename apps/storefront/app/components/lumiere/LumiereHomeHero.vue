<script setup lang="ts">
// Lumiere home hero — a Vogue Beauty spread: oversized Bodoni Moda headline
// on the white left, a stark black diagonal-cut panel on the right (clip-path
// polygon, not a rectangle) with a crimson color-block callout. No shadow
// anywhere; hierarchy is pure black/white/crimson color-blocking + scale.
const settings = useStoreSettings()
</script>

<template>
  <section class="relative overflow-hidden bg-white">
    <div class="mx-auto grid max-w-7xl items-center gap-0 lg:grid-cols-2">
      <!-- Text -->
      <div class="relative z-10 px-4 py-16 sm:px-6 md:py-24 lg:px-8 lg:py-32">
        <span class="inline-flex items-center gap-1.5 rounded bg-primary-600 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
          The edit
        </span>
        <h1 class="font-display mt-6 text-5xl leading-[0.98] text-black sm:text-6xl lg:text-7xl">
          Beauty
          <span class="relative inline-block bg-black px-3 text-white">worth</span>
          the spotlight.
        </h1>
        <p class="mt-6 max-w-md text-lg text-black/60">
          {{ settings.storeName }}'s curated edit of statement beauty. Cash on delivery — no account, no prepayment, just answer the door.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <LumiereButton to="/catalog" size="lg" trailing-icon="i-lucide-arrow-right">Shop the edit</LumiereButton>
          <LumiereButton to="/deals" size="lg" color="neutral" variant="outline">View deals</LumiereButton>
        </div>
      </div>

      <!-- Diagonal visual panel -->
      <div class="relative hidden h-full min-h-[520px] lg:block">
        <div class="lumiere-diagonal absolute inset-0 flex items-center justify-center bg-black">
          <Icon name="i-lucide-sparkles" class="size-28 text-white/15" />
        </div>
        <div class="absolute left-1/2 top-10 flex -translate-x-1/2 flex-col items-center gap-1 text-center">
          <span class="font-display text-2xl text-white">Cash on</span>
          <span class="font-display text-2xl text-white">delivery</span>
        </div>
        <div class="absolute bottom-10 right-10 max-w-[180px] rounded bg-primary-600 p-4 text-white">
          <p class="text-[11px] font-bold uppercase tracking-[0.14em]">No account needed</p>
          <p class="mt-1 text-xs text-white/80">Order in under a minute.</p>
        </div>
      </div>
    </div>

    <!-- Mobile diagonal strip (the lg:block panel above is desktop-only) -->
    <div class="relative h-40 overflow-hidden lg:hidden">
      <div class="lumiere-diagonal-reverse absolute inset-0 bg-black" />
      <div class="absolute inset-0 flex items-center justify-end pr-6">
        <p class="font-display text-right text-xl text-white">Cash on<br>delivery</p>
      </div>
    </div>
  </section>
</template>
