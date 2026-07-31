<script setup lang="ts">
// Forge USP strip — three thick-bordered panels, no shadow, flat safety-
// yellow icon chips.
</script>

<template>
  <section class="border-b-[3px] border-[var(--color-forge-ink)] bg-white">
    <div class="mx-auto grid grid-cols-1 gap-6 px-4 py-14 sm:grid-cols-3 sm:px-6 lg:px-8">
      <div class="border-[3px] border-[var(--color-forge-ink)] bg-white p-6">
        <div class="mb-4 flex size-12 items-center justify-center border-[3px] border-[var(--color-forge-ink)] bg-primary-500">
          <Icon name="i-lucide-banknote" class="size-6 text-[var(--color-forge-ink)]" />
        </div>
        <h3 class="font-display text-lg uppercase">Cash on delivery</h3>
        <p class="mt-1 text-sm text-[var(--color-forge-ink)]/60">Pay only when your order arrives. No prepayment, no card.</p>
      </div>
      <div class="border-[3px] border-[var(--color-forge-ink)] bg-white p-6">
        <div class="mb-4 flex size-12 items-center justify-center border-[3px] border-[var(--color-forge-ink)] bg-primary-500">
          <Icon name="i-lucide-shield-check" class="size-6 text-[var(--color-forge-ink)]" />
        </div>
        <h3 class="font-display text-lg uppercase">Confirmed by phone</h3>
        <p class="mt-1 text-sm text-[var(--color-forge-ink)]/60">Our team calls to confirm every order before it ships.</p>
      </div>
      <div class="border-[3px] border-[var(--color-forge-ink)] bg-white p-6">
        <div class="mb-4 flex size-12 items-center justify-center border-[3px] border-[var(--color-forge-ink)] bg-primary-500">
          <Icon name="i-lucide-user-x" class="size-6 text-[var(--color-forge-ink)]" />
        </div>
        <h3 class="font-display text-lg uppercase">No account needed</h3>
        <p class="mt-1 text-sm text-[var(--color-forge-ink)]/60">Browse, order, and track with just your phone number.</p>
      </div>
    </div>
  </section>
</template>
