<script setup lang="ts">
// Bloom USP strip — three glow cards on the blush surface, circular icon
// chips, beauty-appropriate trust copy.
</script>

<template>
  <section class="bg-[var(--color-bloom-blush)]">
    <div class="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-16 sm:grid-cols-3 sm:px-6 lg:px-8">
      <div class="glow-card p-7 text-center">
        <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary-50">
          <Icon name="i-lucide-banknote" class="size-5 text-primary-600" />
        </div>
        <h3 class="font-display text-xl text-[var(--color-bloom-ink)]">Cash on delivery</h3>
        <p class="mt-2 text-sm text-neutral-500">Try it in hand, then pay when it arrives.</p>
      </div>
      <div class="glow-card p-7 text-center">
        <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary-50">
          <Icon name="i-lucide-shield-check" class="size-5 text-primary-600" />
        </div>
        <h3 class="font-display text-xl text-[var(--color-bloom-ink)]">Phone-verified</h3>
        <p class="mt-2 text-sm text-neutral-500">A quick call confirms every order before it ships.</p>
      </div>
      <div class="glow-card p-7 text-center">
        <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary-50">
          <Icon name="i-lucide-sparkles" class="size-5 text-primary-600" />
        </div>
        <h3 class="font-display text-xl text-[var(--color-bloom-ink)]">No account needed</h3>
        <p class="mt-2 text-sm text-neutral-500">Browse and order with just your phone number.</p>
      </div>
    </div>
  </section>
</template>
