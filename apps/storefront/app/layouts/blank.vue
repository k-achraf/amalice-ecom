<script setup lang="ts">
// Chromeless layout — no SiteHeader/nav, used only by the AI landing-page
// funnel route (app/pages/lp/[slug].vue): a full-width generated image with
// a lead form beneath it, and nothing else competing for the visitor's
// attention. SiteFooter is still included (trust/legal links, same
// branding as the normal store) since the request was "no navbar", not "no
// footer" — see that page's own comment.
</script>

<template>
  <div class="flex min-h-screen flex-col bg-default">
    <slot class="flex-1" />
    <SiteFooter />
  </div>
</template>
