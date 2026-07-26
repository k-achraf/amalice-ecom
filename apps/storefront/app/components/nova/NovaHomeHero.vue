<script setup lang="ts">
// Nova home hero — huge Space Grotesk headline with a lime-highlighted word,
// rotated sticker badges for energy, and an offset-bordered visual block
// (no photography dependency — a bold graphic panel). Nova palette resolves
// under .tpl-nova.
const settings = useStoreSettings()
</script>

<template>
  <section class="border-b-2 border-black bg-primary-500">
    <div class="mx-auto grid max-w-7xl items-start gap-14 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-10 lg:px-8">
      <!-- Headline block — the solid offset-shadow "poster" panel -->
      <div class="relative border-2 border-black bg-white p-8 shadow-[var(--shadow-nova-lg)] sm:p-10">
        <span class="sticker sticker-pop absolute -left-3 -top-5">New drop</span>
        <h1 class="font-display text-5xl uppercase leading-[0.95] sm:text-6xl lg:text-7xl">
          Shop goods
          <span class="bg-primary-500 px-2 text-black">worth</span>
          hyping.
        </h1>
        <p class="mt-6 max-w-md text-lg font-medium text-black/60">
          {{ settings.storeName }}'s curated edit of everyday essentials. Cash on delivery — no account, no prepayment, just answer the door.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <NovaButton to="/catalog" size="lg" trailing-icon="i-lucide-arrow-right">Shop now</NovaButton>
          <NovaButton to="/deals" size="lg" variant="dark">View deals</NovaButton>
        </div>
      </div>

      <!-- Stacked feature stickers — scattered rotated offset-shadow chips -->
      <div class="flex flex-row flex-wrap gap-4 lg:w-56 lg:flex-col">
        <div class="flex -rotate-2 items-center gap-3 border-2 border-black bg-white px-4 py-3 shadow-[var(--shadow-nova-sm)]">
          <Icon name="i-lucide-banknote" class="size-6 shrink-0 text-black" />
          <span class="text-sm font-bold uppercase leading-tight">Cash on delivery</span>
        </div>
        <div class="flex rotate-2 items-center gap-3 border-2 border-black bg-black px-4 py-3 text-white shadow-[var(--shadow-nova-pop)]">
          <Icon name="i-lucide-user-x" class="size-6 shrink-0 text-primary-500" />
          <span class="text-sm font-bold uppercase leading-tight">No account needed</span>
        </div>
        <div class="flex -rotate-1 items-center gap-3 border-2 border-black bg-white px-4 py-3 shadow-[var(--shadow-nova-sm)]">
          <Icon name="i-lucide-truck" class="size-6 shrink-0 text-black" />
          <span class="text-sm font-bold uppercase leading-tight">Fast dispatch</span>
        </div>
      </div>
    </div>
  </section>
</template>
