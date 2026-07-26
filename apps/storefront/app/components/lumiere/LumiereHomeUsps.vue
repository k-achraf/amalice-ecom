<script setup lang="ts">
// Lumiere USP strip — three sharp-cornered cards, thin black borders, no
// shadow. Icon chips use solid crimson color-blocking.
</script>

<template>
  <section class="border-b border-black bg-white">
    <div class="mx-auto grid max-w-7xl grid-cols-1 gap-px bg-black/10 sm:grid-cols-3">
      <div class="bg-white p-8">
        <div class="mb-4 flex size-12 items-center justify-center rounded bg-primary-600">
          <Icon name="i-lucide-banknote" class="size-6 text-white" />
        </div>
        <h3 class="font-display text-lg text-black">Cash on delivery</h3>
        <p class="mt-1 text-sm text-black/55">Pay only when your order arrives. No prepayment, no card.</p>
      </div>
      <div class="bg-white p-8">
        <div class="mb-4 flex size-12 items-center justify-center rounded bg-primary-600">
          <Icon name="i-lucide-shield-check" class="size-6 text-white" />
        </div>
        <h3 class="font-display text-lg text-black">Phone-verified</h3>
        <p class="mt-1 text-sm text-black/55">A quick OTP at checkout keeps fake orders out.</p>
      </div>
      <div class="bg-white p-8">
        <div class="mb-4 flex size-12 items-center justify-center rounded bg-primary-600">
          <Icon name="i-lucide-user-x" class="size-6 text-white" />
        </div>
        <h3 class="font-display text-lg text-black">No account needed</h3>
        <p class="mt-1 text-sm text-black/55">Browse, order, and track with just your phone number.</p>
      </div>
    </div>
  </section>
</template>
