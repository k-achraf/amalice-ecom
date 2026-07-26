<script setup lang="ts">
// Nova USP strip — three bordered cards with hard shadows, bold icon chips.
</script>

<template>
  <section class="border-b-2 border-black bg-white">
    <div class="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-14 sm:grid-cols-3 sm:px-6 lg:px-8">
      <div class="border-2 border-black bg-white p-6 shadow-[var(--shadow-nova-sm)]">
        <div class="mb-4 flex size-12 items-center justify-center border-2 border-black bg-primary-500">
          <Icon name="i-lucide-banknote" class="size-6 text-black" />
        </div>
        <h3 class="font-display text-lg uppercase">Cash on delivery</h3>
        <p class="mt-1 text-sm text-black/60">Pay only when your order arrives. No prepayment, no card.</p>
      </div>
      <div class="border-2 border-black bg-white p-6 shadow-[var(--shadow-nova-sm)]">
        <div class="mb-4 flex size-12 items-center justify-center border-2 border-black bg-primary-500">
          <Icon name="i-lucide-shield-check" class="size-6 text-black" />
        </div>
        <h3 class="font-display text-lg uppercase">Phone-verified</h3>
        <p class="mt-1 text-sm text-black/60">A quick OTP at checkout keeps fake orders out.</p>
      </div>
      <div class="border-2 border-black bg-white p-6 shadow-[var(--shadow-nova-sm)]">
        <div class="mb-4 flex size-12 items-center justify-center border-2 border-black bg-primary-500">
          <Icon name="i-lucide-user-x" class="size-6 text-black" />
        </div>
        <h3 class="font-display text-lg uppercase">No account needed</h3>
        <p class="mt-1 text-sm text-black/60">Browse, order, and track with just your phone number.</p>
      </div>
    </div>
  </section>
</template>
