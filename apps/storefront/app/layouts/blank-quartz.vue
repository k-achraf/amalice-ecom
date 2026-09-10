<script setup lang="ts">
import '~/assets/css/layers/quartz.css'
// Chromeless variant of quartz.vue — same palette (quartz.css) and footer,
// just without <QuartzHeader>. Used by the AI landing-page funnel route
// (app/pages/lp/[productSlug]/[number].vue) — see app/layouts/blank-atelier.vue's
// comment for why this exists as its own file per template.
</script>

<template>
  <div class="tpl-quartz flex min-h-screen flex-col bg-[var(--color-quartz-cream)] font-sans text-[var(--color-quartz-ink)]">
    <main class="flex-1">
      <slot />
    </main>
    <QuartzFooter />
  </div>
</template>
