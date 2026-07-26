<script setup lang="ts">
// Boutique hero — luxury feel. Extreme whitespace, light type, a refined
// eyebrow, narrow max-width, restrained. No images, no bold color blocks —
// the restraint IS the statement.
const settings = useStoreSettings()
</script>

<template>
  <section class="bg-default">
    <div class="mx-auto max-w-3xl px-6 py-32 text-center sm:py-48">
      <p class="mb-6 text-xs uppercase tracking-[0.4em] text-[var(--color-boutique-accent)]">Welcome to {{ settings.storeName }}</p>
      <h1 class="text-4xl leading-tight tracking-tight text-highlighted sm:text-6xl">
        Considered goods,<br /><span class="text-muted">delivered with care.</span>
      </h1>
      <!-- A single thin rule — the only ornament this hero allows -->
      <div class="mx-auto my-10 h-px w-16 bg-default" />
      <p class="mx-auto max-w-md text-base font-light leading-relaxed text-muted">
        A quiet collection of everyday essentials. Pay on delivery — no account, no prepayment, no haste.
      </p>
      <div class="mt-12">
        <BoutiqueButton to="/catalog" size="lg" color="neutral" variant="outline" class="!px-10">
          Explore the collection
        </BoutiqueButton>
      </div>
    </div>
  </section>
</template>
