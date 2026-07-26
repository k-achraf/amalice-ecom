<script setup lang="ts">
// Drop home hero — huge Anton headline on black, rotated sticker badges for
// hype energy, a flat accent-filled visual block (no photography
// dependency). No shadow anywhere — pure black/red/white contrast.
const settings = useStoreSettings()
</script>

<template>
  <section class="relative overflow-hidden border-b border-white/10 bg-black">
    <!-- Full-bleed diagonal image insert — bleeds to the true viewport edge,
         clipped at an angle, independent of the max-w-7xl text column. -->
    <div class="drop-diagonal-insert absolute inset-y-0 right-0 hidden w-[42%] bg-[#171717] lg:block">
      <div class="flex size-full items-center justify-center">
        <Icon name="i-lucide-flame" class="size-40 text-primary-500" />
      </div>
      <span class="sticker sticker-dark absolute bottom-10 left-10">Limited</span>
    </div>

    <div class="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div class="max-w-xl lg:max-w-lg">
        <span class="sticker">New drop</span>
        <h1 class="font-display mt-5 text-5xl leading-[0.9] text-white sm:text-6xl lg:text-7xl">
          Cop it
          <span class="bg-primary-500 px-2 text-black">before</span>
          it's gone.
        </h1>
        <p class="mt-6 max-w-md text-lg font-medium text-white/60">
          {{ settings.storeName }}'s curated drop of street essentials. Cash on delivery — no account, no prepayment, just answer the door.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <DropButton to="/catalog" size="lg" trailing-icon="i-lucide-arrow-right">Shop the drop</DropButton>
          <DropButton to="/deals" size="lg" variant="outline">View deals</DropButton>
        </div>
        <div class="mt-8 flex flex-wrap gap-2 lg:hidden">
          <span class="sticker sticker-dark">Cash on delivery</span>
          <span class="sticker sticker-outline">No account needed</span>
        </div>
      </div>
    </div>

    <span class="sticker sticker-outline absolute right-[38%] top-10 hidden lg:block">Cash on delivery</span>
  </section>
</template>
