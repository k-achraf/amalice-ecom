<script setup lang="ts">
// Minimal home hero — the fallback. Editorial/Boutique override this with
// their own HomeHero components (full-bleed / spacious treatments).
const settings = useStoreSettings()
</script>

<template>
  <section class="border-b border-default bg-default">
    <div class="mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 py-12 sm:py-16 lg:grid-cols-2 lg:gap-10">
      <!-- Text column (left) -->
      <div>
        <h1 class="text-4xl font-bold text-highlighted sm:text-5xl">
          Pay when it arrives.
        </h1>
        <p class="mt-4 max-w-md text-lg text-muted">
          Everyday goods, delivered to your door. No account, no prepayment —
          just verify your phone and pay cash on delivery.
        </p>
        <div class="mt-6 flex gap-3">
          <Button to="/catalog" size="lg" color="primary" icon="i-lucide-shopping-bag">Shop now</Button>
          <Button to="/how-it-works" size="lg" color="neutral" variant="outline">How it works</Button>
        </div>
      </div>

      <!-- Flat panel (right) — no photography, just a plain grid of USP tiles -->
      <div class="grid grid-cols-2 gap-3 rounded-md bg-elevated p-6">
        <div class="flex flex-col items-center gap-2 rounded-md bg-default p-4 text-center">
          <Icon name="i-lucide-banknote" class="size-7 text-primary" />
          <span class="text-xs font-medium text-highlighted">Cash on delivery</span>
        </div>
        <div class="flex flex-col items-center gap-2 rounded-md bg-default p-4 text-center">
          <Icon name="i-lucide-shield-check" class="size-7 text-primary" />
          <span class="text-xs font-medium text-highlighted">Phone-verified</span>
        </div>
        <div class="flex flex-col items-center gap-2 rounded-md bg-default p-4 text-center">
          <Icon name="i-lucide-truck" class="size-7 text-primary" />
          <span class="text-xs font-medium text-highlighted">3–5 day delivery</span>
        </div>
        <div class="flex flex-col items-center gap-2 rounded-md bg-default p-4 text-center">
          <Icon name="i-lucide-user-x" class="size-7 text-primary" />
          <span class="text-xs font-medium text-highlighted">No account needed</span>
        </div>
      </div>

      <p class="sr-only">Welcome to {{ settings.storeName }}</p>
    </div>
  </section>
</template>
