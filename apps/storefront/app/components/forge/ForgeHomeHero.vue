<script setup lang="ts">
// Forge home hero — big uppercase Oswald headline on the concrete-gray
// surface, a hazard-stripe rule under the eyebrow, thick-bordered visual
// panel (no photography dependency). Forge palette resolves under
// .tpl-forge.
const settings = useStoreSettings()
</script>

<template>
  <section class="border-b-[3px] border-[var(--color-forge-ink)] bg-white">
    <div class="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2 lg:gap-16 lg:px-8">
      <!-- Text -->
      <div>
        <span class="sticker"><Icon name="i-lucide-hard-hat" class="size-3.5" /> Now stocking</span>
        <h1 class="font-display mt-5 text-5xl uppercase leading-[0.95] sm:text-6xl lg:text-7xl">
          Built for
          <span class="bg-primary-500 px-2 text-[var(--color-forge-ink)]">work.</span>
          Priced for real life.
        </h1>
        <p class="mt-6 max-w-md text-lg font-medium text-[var(--color-forge-ink)]/60">
          {{ settings.storeName }}'s hardware, tools, and shop supplies. Cash on delivery — no account, no prepayment, just answer the door.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <ForgeButton to="/catalog" size="lg" trailing-icon="i-lucide-arrow-right">Shop now</ForgeButton>
          <ForgeButton to="/deals" size="lg" color="neutral" variant="outline">View deals</ForgeButton>
        </div>
      </div>

      <!-- Visual — a spec-sheet / shipping-manifest data block instead of a
           product photo. Every other split-hero template puts imagery on
           this side; Forge puts DATA here, echoing the industrial identity
           carried through the card's SKU tag and the PDP spec block. -->
      <div class="relative">
        <div class="hazard-stripe absolute -inset-2 -z-10" aria-hidden="true" />
        <div class="border-[3px] border-[var(--color-forge-ink)] bg-white">
          <div class="flex items-center justify-between border-b-[3px] border-[var(--color-forge-ink)] bg-[var(--color-forge-ink)] px-5 py-3">
            <span class="font-display text-sm uppercase tracking-wide text-white">Spec sheet</span>
            <Icon name="i-lucide-clipboard-list" class="size-4 text-primary-500" />
          </div>
          <dl class="divide-y-2 divide-[var(--color-forge-ink)]/10">
            <div class="flex items-center justify-between px-5 py-4">
              <dt class="text-xs font-bold uppercase tracking-wide text-[var(--color-forge-ink)]/50">Model</dt>
              <dd class="font-mono text-sm font-bold text-[var(--color-forge-ink)]">Full catalog</dd>
            </div>
            <div class="flex items-center justify-between px-5 py-4">
              <dt class="text-xs font-bold uppercase tracking-wide text-[var(--color-forge-ink)]/50">Stock</dt>
              <dd class="font-mono text-sm font-bold text-primary-700">Ready to ship</dd>
            </div>
            <div class="flex items-center justify-between px-5 py-4">
              <dt class="text-xs font-bold uppercase tracking-wide text-[var(--color-forge-ink)]/50">Delivery</dt>
              <dd class="font-mono text-sm font-bold text-[var(--color-forge-ink)]">Cash on arrival</dd>
            </div>
            <div class="flex items-center justify-between px-5 py-4">
              <dt class="text-xs font-bold uppercase tracking-wide text-[var(--color-forge-ink)]/50">Account</dt>
              <dd class="font-mono text-sm font-bold text-[var(--color-forge-ink)]">Not required</dd>
            </div>
          </dl>
        </div>
        <span class="sticker absolute -left-4 -top-4">Cash on delivery</span>
        <span class="sticker sticker-danger absolute -bottom-4 -right-4">No account needed</span>
      </div>
    </div>
  </section>
</template>
