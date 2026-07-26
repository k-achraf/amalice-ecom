<script setup lang="ts">
useSeoMeta({ title: 'Terms of service', description: 'Terms of service for shopping at Amalice.' })
</script>
<template>
  <main class="mx-auto max-w-3xl space-y-6 px-4 py-12">
    <header>
      <h1 class="text-3xl font-bold">Terms of service</h1>
      <p class="mt-1 text-sm text-muted">Last updated: July 2026</p>
    </header>
    <div class="space-y-4 leading-relaxed text-muted">
      <p>By placing an order with Amalice, you agree to these terms.</p>
      <p><strong class="text-highlighted">Orders:</strong> An order is a request to purchase and receive goods cash on delivery. It becomes binding once you verify your phone number at checkout and we confirm it. We reserve the right to decline or cancel an order (e.g. suspected fraud, an undeliverable address, or a pricing error) — in that case you are not charged.</p>
      <p><strong class="text-highlighted">Payment:</strong> Payment is due to the courier in cash at the time of delivery, in the amount shown at checkout. Prices include applicable taxes and delivery.</p>
      <p><strong class="text-highlighted">Accuracy:</strong> We work to keep product descriptions, images, and prices accurate. If we discover a material error after you order, we will contact you before proceeding.</p>
      <p><strong class="text-highlighted">Acceptable use:</strong> You agree not to place fraudulent orders, provide false contact information, or abuse the phone-verification system. Fake orders impose real costs (courier time, restocking) and repeated abuse may result in refusal of future orders.</p>
      <p>See also: <NuxtLink to="/privacy" class="text-primary hover:underline">Privacy</NuxtLink>, <NuxtLink to="/shipping" class="text-primary hover:underline">Shipping</NuxtLink>, <NuxtLink to="/returns" class="text-primary hover:underline">Returns</NuxtLink>.</p>
    </div>
  </main>
</template>
