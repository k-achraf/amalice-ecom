<script setup lang="ts">
// Drop USP strip — three flat bordered panels on the black surface, bold
// icon chips in the accent color. No shadow.
</script>

<template>
  <section class="border-b border-white/10 bg-black">
    <div class="mx-auto grid grid-cols-1 gap-6 px-4 py-14 sm:grid-cols-3 sm:px-6 lg:px-8">
      <div class="border border-white/10 bg-[#171717] p-6">
        <div class="mb-4 flex size-12 items-center justify-center bg-primary-500">
          <Icon name="i-lucide-banknote" class="size-6 text-black" />
        </div>
        <h3 class="font-display text-lg text-white">Cash on delivery</h3>
        <p class="mt-1 text-sm text-white/50">Pay only when your order arrives. No prepayment, no card.</p>
      </div>
      <div class="border border-white/10 bg-[#171717] p-6">
        <div class="mb-4 flex size-12 items-center justify-center bg-primary-500">
          <Icon name="i-lucide-shield-check" class="size-6 text-black" />
        </div>
        <h3 class="font-display text-lg text-white">Phone-verified</h3>
        <p class="mt-1 text-sm text-white/50">A quick OTP at checkout keeps fake orders out.</p>
      </div>
      <div class="border border-white/10 bg-[#171717] p-6">
        <div class="mb-4 flex size-12 items-center justify-center bg-primary-500">
          <Icon name="i-lucide-user-x" class="size-6 text-black" />
        </div>
        <h3 class="font-display text-lg text-white">No account needed</h3>
        <p class="mt-1 text-sm text-white/50">Browse, order, and track with just your phone number.</p>
      </div>
    </div>
  </section>
</template>
