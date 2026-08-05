<script setup lang="ts">
import '~/assets/css/layers/atelier.css'
// Chromeless variant of atelier.vue — same palette (atelier.css) and footer,
// just without <AtelierHeader>, for the AI landing-page funnel route
// (app/pages/lp/[productSlug]/[number].vue), selected dynamically via
// setPageLayout() based on the store's active template. See that layout's
// own comment for the palette description; kept as its own static-import
// file (not a header-toggle prop on atelier.vue) so each layout's perf-
// critical `import '...css'` stays analyzable at build time.
</script>

<template>
  <div class="tpl-atelier flex min-h-screen flex-col bg-[var(--color-atelier-cream)] font-sans text-[var(--color-atelier-ink)]">
    <main class="flex-1">
      <slot />
    </main>
    <AtelierFooter />
  </div>
</template>
