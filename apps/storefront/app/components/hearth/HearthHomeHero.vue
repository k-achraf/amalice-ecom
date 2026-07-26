<script setup lang="ts">
// Hearth home hero — a warm linen panel (always light — Hearth never goes
// dark), a medium-weight Lora headline, a terracotta CTA, and a stacked
// decorative visual of soft furniture-block shapes rather than a photo
// dependency, echoing a cozy room corner.
const settings = useStoreSettings()
</script>

<template>
  <section class="bg-[var(--color-hearth-linen)]">
    <div class="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2 lg:gap-16 lg:px-8">
      <!-- Text -->
      <div class="text-center lg:text-left">
        <span class="swatch-tag"><Icon name="i-lucide-sofa" class="size-3" /> New season edit</span>
        <h1 class="font-display mt-6 text-4xl leading-[1.15] text-[var(--color-hearth-ink)] sm:text-5xl lg:text-6xl">
          A home that feels like
          <span class="text-primary-600">home.</span>
        </h1>
        <p class="mx-auto mt-6 max-w-md text-base leading-relaxed text-neutral-600 lg:mx-0">
          {{ settings.storeName }}'s warm edit of furniture and interiors. Cash on delivery — see it in your space before you keep it.
        </p>
        <div class="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start">
          <HearthButton to="/catalog" size="lg" trailing-icon="i-lucide-arrow-right">Shop the collection</HearthButton>
          <HearthButton to="/deals" size="lg" variant="outline">View deals</HearthButton>
        </div>
      </div>

      <!-- Visual — a single framed-photo panel, the signature mat motif blown up hero-scale -->
      <div class="relative mx-auto w-full max-w-md">
        <div class="frame-mat shadow-[var(--shadow-hearth-lg)]">
          <div class="frame-mat-inner relative flex aspect-[4/5] items-end justify-center overflow-hidden bg-gradient-to-b from-primary-100 to-primary-200">
            <div class="flex w-full items-end justify-between gap-4 p-6">
              <div class="h-20 w-1/3 rounded-t-xl bg-[var(--color-hearth-sage)]" />
              <div class="h-32 w-1/3 rounded-t-xl bg-primary-500" />
              <div class="h-14 w-1/3 rounded-t-xl bg-[var(--color-hearth-ink)]/70" />
            </div>
            <div class="absolute right-6 top-6 flex size-14 items-center justify-center rounded-full bg-white/90 shadow-[var(--shadow-hearth-sm)]">
              <Icon name="i-lucide-lamp" class="size-7 text-primary-600" />
            </div>
          </div>
        </div>
        <!-- A second, smaller framed accent overlapping the corner — like a print leaning against the main frame -->
        <div class="frame-mat absolute -bottom-6 -left-6 hidden w-32 shadow-[var(--shadow-hearth-md)] sm:block">
          <div class="frame-mat-inner flex aspect-square items-center justify-center bg-white">
            <Icon name="i-lucide-sofa" class="size-8 text-primary-500" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
