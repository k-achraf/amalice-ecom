<script setup lang="ts">
// Editorial hero — magazine cover style. Full-bleed dark panel, oversized
// display type, a single primary CTA. The announcement bar above carries the
// promo copy; this is the visual statement.
const settings = useStoreSettings()
</script>

<template>
  <section class="relative isolate">
    <!-- Full-bleed dark cover panel — kicker only, headline is pulled OUT of it below -->
    <div class="relative isolate overflow-hidden bg-highlighted text-white">
      <div class="absolute inset-0 bg-gradient-to-br from-highlighted via-highlighted to-black/40" aria-hidden="true" />
      <div class="relative mx-auto max-w-6xl px-4 pt-20 pb-36 text-center sm:pt-28 sm:pb-48">
        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Issue No. 01 — {{ settings.storeName }}</p>
      </div>
    </div>

    <!-- Oversized headline block, pulled up with a negative margin so it visually
         overlaps the dark panel's bottom edge — half on the cover, half on the page. -->
    <div class="relative mx-auto -mt-28 max-w-6xl px-4 text-center sm:-mt-36">
      <h1 class="mx-auto max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight text-highlighted sm:text-7xl">
        The goods,<br /><span class="text-muted">delivered.</span>
      </h1>
      <p class="mx-auto mt-6 max-w-xl text-lg text-muted">
        A curated edit of everyday things. Pay when they land at your door — cash on delivery, no account.
      </p>
      <div class="mt-10 flex justify-center pb-4">
        <EditorialButton to="/catalog" size="xl" color="primary" trailing-icon="i-lucide-arrow-right">
          Read the catalog
        </EditorialButton>
      </div>
    </div>
  </section>
</template>
