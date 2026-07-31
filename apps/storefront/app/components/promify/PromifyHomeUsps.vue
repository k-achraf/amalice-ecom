<script setup lang="ts">
// Promify USP strip — a full-width primary gradient band with three promise
// columns. The Promify signature: solid brand-blue gradient, white type,
// rounded icon chips. Distinct from minimal/editorial/boutique treatments.
</script>

<template>
  <section class="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900">
    <div class="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-14 sm:grid-cols-3 sm:px-6 lg:px-8">
      <div class="flex flex-col items-center text-center">
        <div class="mb-4 flex size-12 items-center justify-center rounded-2xl bg-white/15">
          <Icon name="i-lucide-banknote" class="size-6 text-white" />
        </div>
        <h3 class="text-base font-semibold text-white">Cash on delivery</h3>
        <p class="mt-1 text-sm text-white/70">Pay only when your order arrives. No prepayment, no card.</p>
      </div>
      <div class="flex flex-col items-center text-center">
        <div class="mb-4 flex size-12 items-center justify-center rounded-2xl bg-white/15">
          <Icon name="i-lucide-shield-check" class="size-6 text-white" />
        </div>
        <h3 class="text-base font-semibold text-white">Confirmed by phone</h3>
        <p class="mt-1 text-sm text-white/70">Our team calls to confirm every order before it ships.</p>
      </div>
      <div class="flex flex-col items-center text-center">
        <div class="mb-4 flex size-12 items-center justify-center rounded-2xl bg-white/15">
          <Icon name="i-lucide-user-x" class="size-6 text-white" />
        </div>
        <h3 class="text-base font-semibold text-white">No account needed</h3>
        <p class="mt-1 text-sm text-white/70">Browse, order, and track with just your phone number.</p>
      </div>
    </div>
  </section>
</template>
