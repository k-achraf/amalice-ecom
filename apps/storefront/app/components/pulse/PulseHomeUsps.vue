<script setup lang="ts">
// Pulse USP strip — three glow cards on the white surface, rounded icon
// chips, gadget-store trust copy.
</script>

<template>
  <section class="bg-white">
    <div class="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-16 sm:grid-cols-3 sm:px-6 lg:px-8">
      <div class="glow-card p-7 text-center">
        <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-50">
          <Icon name="i-lucide-banknote" class="size-5 text-primary-600" />
        </div>
        <h3 class="font-display text-lg text-neutral-900">Cash on delivery</h3>
        <p class="mt-2 text-sm text-neutral-500">Unbox it, check it, then pay when it arrives.</p>
      </div>
      <div class="glow-card p-7 text-center">
        <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-50">
          <Icon name="i-lucide-shield-check" class="size-5 text-primary-600" />
        </div>
        <h3 class="font-display text-lg text-neutral-900">Phone-verified</h3>
        <p class="mt-2 text-sm text-neutral-500">A quick call confirms every order before it ships.</p>
      </div>
      <div class="glow-card p-7 text-center">
        <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-50">
          <Icon name="i-lucide-zap" class="size-5 text-primary-600" />
        </div>
        <h3 class="font-display text-lg text-neutral-900">No account needed</h3>
        <p class="mt-2 text-sm text-neutral-500">Browse and order with just your phone number.</p>
      </div>
    </div>
  </section>
</template>
