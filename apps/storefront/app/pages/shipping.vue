<script setup lang="ts">
useSeoMeta({ title: 'Shipping & delivery', description: 'How Amalice ships cash-on-delivery orders.' })
</script>
<template>
  <main class="mx-auto max-w-3xl space-y-6 px-4 py-12">
    <header>
      <h1 class="text-3xl font-bold">Shipping &amp; delivery</h1>
      <p class="mt-1 text-sm text-muted">Last updated: July 2026</p>
    </header>
    <div class="space-y-4 leading-relaxed text-muted">
      <p><strong class="text-highlighted">Delivery method:</strong> All orders are delivered by a third-party courier to the address you provide at checkout. You pay the courier in cash on delivery — no shipping fee is charged upfront (it is included in the listed price).</p>
      <p><strong class="text-highlighted">Estimated delivery time:</strong> 3–5 business days. This is a flat placeholder estimate; per-order delivery windows will become more precise as our courier network matures. You will see status updates (packed, dispatched, out for delivery) on the Track order page.</p>
      <p><strong class="text-highlighted">Delivery area:</strong> We currently deliver within the country configured at checkout. If your address is outside our service area, the courier will let us know and we will contact you.</p>
      <p><strong class="text-highlighted">If you are not home:</strong> The courier will call the phone number you provided to arrange a time. Failed deliveries are re-attempted before an order is returned.</p>
      <p><strong class="text-highlighted">Inspecting your order:</strong> You may inspect the package before paying. If something is wrong, refuse delivery and contact us — see our <NuxtLink to="/returns" class="text-primary hover:underline">Returns</NuxtLink> policy.</p>
    </div>
  </main>
</template>
