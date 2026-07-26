<script setup lang="ts">
useSeoMeta({
  title: 'How it works',
  description: 'How cash-on-delivery shopping works at Amalice — order, verify your phone, receive, pay in cash.'
})

const steps = [
  { icon: 'i-lucide-shopping-bag', title: 'Browse & add to cart', body: 'Pick what you want and add it to your cart. No account needed.' },
  { icon: 'i-lucide-map-pin', title: 'Enter your address', body: 'Tell us where to deliver. We ship to your door.' },
  { icon: 'i-lucide-phone', title: 'Verify your phone', body: 'A quick 6-digit code confirms it is really you — no password.' },
  { icon: 'i-lucide-truck', title: 'We deliver', body: 'Your order arrives in 3–5 business days (a placeholder estimate — real per-order ETAs come soon).' },
  { icon: 'i-lucide-banknote', title: 'Pay in cash', body: 'Inspect your order, then pay the courier in cash. Done.' }
]
</script>

<template>
  <main class="mx-auto max-w-3xl space-y-10 px-4 py-12">
    <div class="text-center">
      <h1 class="text-3xl font-bold">How it works</h1>
      <p class="mt-2 text-muted">Five steps. No account, no prepayment.</p>
    </div>
    <ol class="space-y-6">
      <li v-for="(step, i) in steps" :key="i" class="flex gap-4">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
          <UIcon :name="step.icon" class="size-5" />
        </div>
        <div>
          <h2 class="font-semibold text-highlighted">{{ i + 1 }}. {{ step.title }}</h2>
          <p class="text-sm text-muted">{{ step.body }}</p>
        </div>
      </li>
    </ol>
    <div class="text-center">
      <UButton to="/catalog" size="lg" color="primary" icon="i-lucide-shopping-bag">Start shopping</UButton>
    </div>
  </main>
</template>
