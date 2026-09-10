<script setup lang="ts">
import '~/assets/css/layers/quartz.css'
// Quartz template chrome — a lean single-product COD order page (any
// product category, not just one type of item — see QuartzHeader/Footer
// and the PDP/lead-card components for the generic-copy convention this
// whole template follows). Header carries the store name + a light trust
// line, no category nav (this template is scoped to product/landing pages
// only — see STORE_TEMPLATES' quartz entry). The .tpl-quartz wrapper
// activates the scoped palette (quartz.css). Chrome lives in
// components/quartz/.
</script>

<template>
  <div class="tpl-quartz flex min-h-screen flex-col bg-[var(--color-quartz-cream)] font-sans text-[var(--color-quartz-ink)]">
    <QuartzHeader />
    <main class="flex-1">
      <slot />
    </main>
    <QuartzFooter />
  </div>
</template>
