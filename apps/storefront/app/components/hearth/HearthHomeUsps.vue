<script setup lang="ts">
// Hearth USP strip — three hearth-cards on the linen surface, rounded-xl
// icon chips, home-and-furniture-appropriate trust copy.
</script>

<template>
  <section class="bg-white">
    <div class="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-16 sm:grid-cols-3 sm:px-6 lg:px-8">
      <div class="hearth-card p-7 text-center">
        <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-50">
          <Icon name="i-lucide-banknote" class="size-5 text-primary-600" />
        </div>
        <h3 class="font-display text-lg text-[var(--color-hearth-ink)]">Cash on delivery</h3>
        <p class="mt-2 text-sm text-neutral-500">See each piece in your home, then pay when it arrives.</p>
      </div>
      <div class="hearth-card p-7 text-center">
        <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-50">
          <Icon name="i-lucide-shield-check" class="size-5 text-primary-600" />
        </div>
        <h3 class="font-display text-lg text-[var(--color-hearth-ink)]">Confirmed by phone</h3>
        <p class="mt-2 text-sm text-neutral-500">A quick call confirms every order before it ships.</p>
      </div>
      <div class="hearth-card p-7 text-center">
        <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-50">
          <Icon name="i-lucide-truck" class="size-5 text-primary-600" />
        </div>
        <h3 class="font-display text-lg text-[var(--color-hearth-ink)]">No account needed</h3>
        <p class="mt-2 text-sm text-neutral-500">Browse and order with just your phone number.</p>
      </div>
    </div>
  </section>
</template>
