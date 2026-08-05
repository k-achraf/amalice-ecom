<script setup lang="ts">
// Chromeless layout — no SiteHeader/nav, used by the AI landing-page funnel
// route (app/pages/lp/[productSlug]/[number].vue) when the store's active
// template is `minimal` (which has no dedicated palette CSS of its own — see
// app/layouts/minimal.vue). Every other template has its own
// blank-<template>.vue variant (same palette + footer as that template's
// normal layout, just without the header) so the funnel page always matches
// whichever template is actually active — see the page's setPageLayout()
// call. SiteFooter is still included (trust/legal links, same branding as
// the normal store) since the request was "no navbar", not "no footer".
</script>

<template>
  <div class="flex min-h-screen flex-col bg-default">
    <slot class="flex-1" />
    <SiteFooter />
  </div>
</template>
