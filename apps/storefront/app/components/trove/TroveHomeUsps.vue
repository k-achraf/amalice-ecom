<script setup lang="ts">
// Trove USP strip — three trove-cards on the cream surface, with circular
// icon medallions (the signature circle-on-sharp-frame motif carried into
// the icon chips), everyday-carry-appropriate trust copy.
</script>

<template>
  <section class="bg-white">
    <div class="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-16 sm:grid-cols-3 sm:px-6 lg:px-8">
      <div class="trove-card p-7 text-center">
        <div class="trove-photo mx-auto mb-4 flex size-14 items-center justify-center bg-primary-50">
          <Icon name="i-lucide-banknote" class="size-5 text-primary-700" />
        </div>
        <h3 class="font-display text-lg text-[var(--color-trove-ink)]">Cash on delivery</h3>
        <p class="mt-2 text-sm text-neutral-500">Hold each piece in your hands, then pay when it arrives.</p>
      </div>
      <div class="trove-card p-7 text-center">
        <div class="trove-photo mx-auto mb-4 flex size-14 items-center justify-center bg-[var(--color-trove-teal-light)]/30">
          <Icon name="i-lucide-shield-check" class="size-5 text-[var(--color-trove-teal-dark)]" />
        </div>
        <h3 class="font-display text-lg text-[var(--color-trove-ink)]">Phone-verified</h3>
        <p class="mt-2 text-sm text-neutral-500">A quick call confirms every order before it ships.</p>
      </div>
      <div class="trove-card p-7 text-center">
        <div class="trove-photo mx-auto mb-4 flex size-14 items-center justify-center bg-primary-50">
          <Icon name="i-lucide-truck" class="size-5 text-primary-700" />
        </div>
        <h3 class="font-display text-lg text-[var(--color-trove-ink)]">No account needed</h3>
        <p class="mt-2 text-sm text-neutral-500">Browse and order with just your phone number.</p>
      </div>
    </div>
  </section>
</template>
