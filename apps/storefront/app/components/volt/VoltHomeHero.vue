<script setup lang="ts">
// Volt home hero — near-black surface with the signature blueprint grid-line
// background, geometric Sora headline with a cyan-highlighted word, a
// bracket spec-badge, and a spec-sheet style visual panel (no photography
// dependency). Volt palette resolves under .tpl-volt.
const settings = useStoreSettings()
</script>

<template>
  <section class="volt-grid-bg relative overflow-hidden border-b border-white/10 bg-black">
    <div class="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-2 lg:gap-16 lg:px-8">
      <!-- Image panel — left, the product-visual bay of the spec sheet -->
      <div class="relative order-2 lg:order-1">
        <div class="flex aspect-square flex-col justify-between rounded-md border border-white/10 bg-[#0c1113] p-8">
          <div class="flex items-center justify-between">
            <span class="spec-badge">In stock</span>
            <Icon name="i-lucide-cpu" class="size-6 text-primary-400" />
          </div>
          <Icon name="i-lucide-zap" class="size-24 self-center text-primary-400/80" />
          <span class="spec-badge self-start">Fig. 01</span>
        </div>
      </div>

      <!-- Spec-list — right, headline + tabular data rows -->
      <div class="order-1 lg:order-2">
        <span class="spec-badge">New drop</span>
        <h1 class="font-display mt-5 text-5xl leading-[1.02] text-white sm:text-6xl lg:text-7xl">
          Tech that
          <span class="text-primary-400">performs.</span>
        </h1>
        <p class="mt-6 max-w-md text-lg text-white/50">
          {{ settings.storeName }}'s curated edit of gear worth owning. Cash on delivery — no account, no prepayment, just answer the door.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <VoltButton to="/catalog" size="lg" trailing-icon="i-lucide-arrow-right">Shop now</VoltButton>
          <VoltButton to="/deals" size="lg" color="neutral" variant="outline">View deals</VoltButton>
        </div>
        <div class="font-mono-spec mt-8 max-w-sm space-y-1 rounded-md border border-white/10 bg-[#0c1113] p-4 text-xs text-white/40">
          <div class="flex justify-between border-b border-white/10 pb-2"><span>Delivery</span><span class="text-primary-400">Cash on delivery</span></div>
          <div class="flex justify-between border-b border-white/10 py-2"><span>Verification</span><span class="text-primary-400">SMS OTP</span></div>
          <div class="flex justify-between pt-2"><span>Account</span><span class="text-primary-400">Not required</span></div>
        </div>
      </div>
    </div>
  </section>
</template>
