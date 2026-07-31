<script setup lang="ts">
// Volt USP strip — three hairline-bordered panels, flat (no ambient
// shadow), bracket-badge labels, mono spec-sheet feel.
</script>

<template>
  <section class="border-b border-white/10 bg-black">
    <div class="mx-auto grid grid-cols-1 gap-px overflow-hidden rounded-md border border-white/10 bg-white/10 sm:grid-cols-3 lg:max-w-7xl lg:mx-auto lg:px-0">
      <div class="bg-black p-6">
        <div class="mb-4 flex size-11 items-center justify-center rounded-md border border-primary-400/30 bg-primary-400/5">
          <Icon name="i-lucide-banknote" class="size-5 text-primary-400" />
        </div>
        <h3 class="font-display text-base text-white">Cash on delivery</h3>
        <p class="mt-1 text-sm text-white/50">Pay only when your order arrives. No prepayment, no card.</p>
      </div>
      <div class="bg-black p-6">
        <div class="mb-4 flex size-11 items-center justify-center rounded-md border border-primary-400/30 bg-primary-400/5">
          <Icon name="i-lucide-shield-check" class="size-5 text-primary-400" />
        </div>
        <h3 class="font-display text-base text-white">Confirmed by phone</h3>
        <p class="mt-1 text-sm text-white/50">Our team calls to confirm every order before it ships.</p>
      </div>
      <div class="bg-black p-6">
        <div class="mb-4 flex size-11 items-center justify-center rounded-md border border-primary-400/30 bg-primary-400/5">
          <Icon name="i-lucide-user-x" class="size-5 text-primary-400" />
        </div>
        <h3 class="font-display text-base text-white">No account needed</h3>
        <p class="mt-1 text-sm text-white/50">Browse, order, and track with just your phone number.</p>
      </div>
    </div>
  </section>
</template>
