<script setup lang="ts">
// Atelier USP strip — three glow cards on the cream surface, circular icon
// chips, jewelry-appropriate trust copy.
</script>

<template>
  <section class="bg-[var(--color-atelier-cream)]">
    <div class="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-16 sm:grid-cols-3 sm:px-6 lg:px-8">
      <div class="glow-card p-7 text-center">
        <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary-50">
          <Icon name="i-lucide-banknote" class="size-5 text-primary-600" />
        </div>
        <h3 class="font-display text-xl text-[var(--color-atelier-ink)]">Cash on delivery</h3>
        <p class="mt-2 text-sm text-neutral-500">See each piece in hand, then pay when it arrives.</p>
      </div>
      <div class="glow-card p-7 text-center">
        <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary-50">
          <Icon name="i-lucide-shield-check" class="size-5 text-primary-600" />
        </div>
        <h3 class="font-display text-xl text-[var(--color-atelier-ink)]">Confirmed by phone</h3>
        <p class="mt-2 text-sm text-neutral-500">A quick call confirms every order before it ships.</p>
      </div>
      <div class="glow-card p-7 text-center">
        <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary-50">
          <Icon name="i-lucide-gem" class="size-5 text-primary-600" />
        </div>
        <h3 class="font-display text-xl text-[var(--color-atelier-ink)]">No account needed</h3>
        <p class="mt-2 text-sm text-neutral-500">Browse and order with just your phone number.</p>
      </div>
    </div>
  </section>
</template>
