<script setup lang="ts">
useSeoMeta({
  title: 'FAQ',
  description: 'Common questions about cash-on-delivery shopping at Amalice.'
})

const faqs = [
  { q: 'Do I need to create an account?', a: 'No. You order as a guest — we verify your phone with a one-time code at checkout. No password to set or remember.' },
  { q: 'When do I pay?', a: 'You pay in cash when your order is delivered to your door. No prepayment, no card.' },
  { q: 'What if I am not home?', a: 'The courier will attempt delivery and contact you on the phone number you provided. You can re-arrange a delivery time.' },
  { q: 'How long does delivery take?', a: 'Currently 3–5 business days — a flat estimate. Per-order delivery windows will improve as our courier network matures.' },
  { q: 'Can I return an item?', a: 'Yes. See our Returns page for the policy and how to initiate a return after delivery.' },
  { q: 'How do I track my order?', a: 'Use the "Track order" link with your order ID and phone number. Status updates appear as your order moves through packing, dispatch, and delivery.' },
  { q: 'Why a phone code at checkout?', a: 'It is our main safeguard against fake orders — a real phone number means a real delivery. It keeps the catalog reliable for everyone.' }
]

const items = faqs.map((f, i) => ({
  label: f.q,
  icon: 'i-lucide-help-circle',
  content: f.a,
  defaultOpen: i === 0
}))
</script>

<template>
  <main class="mx-auto max-w-3xl space-y-6 px-4 py-12">
    <h1 class="text-3xl font-bold">Frequently asked questions</h1>
    <UAccordion :items="items" />
    <p class="border-t border-default pt-6 text-sm text-muted">
      Still have a question? <NuxtLink to="/contact" class="text-primary hover:underline">Contact us</NuxtLink>.
    </p>
  </main>
</template>
