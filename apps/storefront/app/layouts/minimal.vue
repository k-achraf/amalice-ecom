<script setup lang="ts">
// SF-13 — the storefront chrome. Header (announcement bar, category mega-menu,
// search, cart, mobile drawer) + footer (shop/customer-service/company links,
// trust strip). Page content in between. All Polaris tokens from DS-08.
</script>

<template>
  <div class="flex min-h-screen flex-col bg-default">
    <SiteHeader />
    <slot class="flex-1" />
    <SiteFooter />
  </div>
</template>
