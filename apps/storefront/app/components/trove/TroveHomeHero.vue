<script setup lang="ts">
// Trove home hero — a light cream panel (always light — Trove never goes
// dark), a bold Bricolage Grotesque headline, a mustard CTA with dark ink
// text, and a full-bleed SCATTERED collage of circular "pinned charm"
// medallions floating at different sizes/offsets around the centered text —
// a corkboard/flat-lay composition, not a single rectangular visual panel.
// Every other split-hero template confines its visual to one half; Trove's
// signature circle-on-sharp-frame motif spreads across the whole section
// instead, with the copy sitting in the middle of the scatter.
const settings = useStoreSettings()

// Fixed offsets for the desktop/tablet scatter layer — five medallions of
// varying size positioned independently around the hero, several
// intentionally overlapping the text column's edges for a genuine collage
// feel rather than a tidy grid.
const medallions = [
  { icon: 'i-lucide-watch', pos: 'left-[2%] top-[6%]', size: 'size-24 lg:size-28', bg: 'bg-primary-200', iconSize: 'size-9', iconColor: 'text-primary-700' },
  { icon: 'i-lucide-gem', pos: 'left-[8%] bottom-[10%]', size: 'size-16 lg:size-20', bg: 'bg-[var(--color-trove-teal-light)]/40', iconSize: 'size-6', iconColor: 'text-[var(--color-trove-teal-dark)]' },
  { icon: 'i-lucide-glasses', pos: 'right-[4%] top-[10%]', size: 'size-32 lg:size-40', bg: 'bg-primary-300/70', iconSize: 'size-11', iconColor: 'text-primary-800' },
  { icon: 'i-lucide-key-round', pos: 'right-[10%] bottom-[6%]', size: 'size-16 lg:size-20', bg: 'bg-white', iconSize: 'size-6', iconColor: 'text-[var(--color-trove-teal)]' },
  { icon: 'i-lucide-shopping-bag', pos: 'left-[42%] top-[0%]', size: 'size-12 lg:size-16', bg: 'bg-primary-100', iconSize: 'size-5', iconColor: 'text-primary-700' }
]

// A simplified 2-up row for mobile, where the full scatter would collide
// with the text.
const mobileMedallions = [
  { icon: 'i-lucide-watch', bg: 'bg-primary-200', iconColor: 'text-primary-700' },
  { icon: 'i-lucide-glasses', bg: 'bg-primary-300/70', iconColor: 'text-primary-800' }
]
</script>

<template>
  <section class="relative overflow-hidden bg-[var(--color-trove-cream)]">
    <div class="relative mx-auto flex max-w-6xl flex-col justify-center px-4 py-16 sm:px-6 md:py-20 lg:min-h-[600px] lg:px-8 lg:py-28">
      <!-- Scattered collage layer — full-bleed across the hero, absolute
           positioned, sm and up only. -->
      <div class="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden="true">
        <div
          v-for="(m, i) in medallions"
          :key="i"
          class="trove-photo absolute flex items-center justify-center"
          :class="[m.pos, m.size, m.bg]"
        >
          <Icon :name="m.icon" :class="[m.iconSize, m.iconColor]" />
        </div>
      </div>

      <!-- Mobile fallback: a simple 2-up row instead of the full scatter -->
      <div class="mb-8 flex justify-center gap-4 sm:hidden">
        <div v-for="(m, i) in mobileMedallions" :key="i" class="trove-photo flex size-20 items-center justify-center" :class="m.bg">
          <Icon :name="m.icon" class="size-7" :class="m.iconColor" />
        </div>
      </div>

      <!-- Centered copy, sitting in the middle of the scatter -->
      <div class="relative z-10 mx-auto max-w-xl text-center">
        <span class="trove-tag"><Icon name="i-lucide-sparkles" class="size-3" /> Freshly collected</span>
        <h1 class="font-display mt-6 text-4xl leading-[1.1] text-[var(--color-trove-ink)] sm:text-5xl lg:text-6xl">
          Little things worth
          <span class="text-primary-600">collecting.</span>
        </h1>
        <p class="mx-auto mt-6 max-w-md text-base leading-relaxed text-neutral-600">
          {{ settings.storeName }}'s curated edit of accessories and everyday-carry finds. Cash on delivery — hold it in your hands before you keep it.
        </p>
        <div class="mt-9 flex flex-wrap justify-center gap-3">
          <TroveButton to="/catalog" size="lg" trailing-icon="i-lucide-arrow-right">Browse the trove</TroveButton>
          <TroveButton to="/deals" size="lg" variant="outline">View deals</TroveButton>
        </div>
      </div>
    </div>
  </section>
</template>
