<script setup lang="ts">
import '~/assets/css/layers/atelier.css'
// Atelier template chrome — a fully custom "fine jewelry & accessories"
// system, built entirely with plain Tailwind CSS (no @nuxt/ui components
// anywhere in this template's tree — see components/atelier/ui/ for the
// hand-built Button/Input/Select/etc. every Atelier page uses instead).
// Warm cream shopping surface, deep emerald-black "velvet" moments (header,
// hero, footer, product mats), a rose-gold accent, soft glowing shadows,
// fully rounded shapes, delicate Cormorant serif display type. The
// .tpl-atelier wrapper activates the scoped palette (atelier.css). The
// chrome (AtelierHeader/AtelierFooter) lives in components/atelier/.
</script>

<template>
  <div class="tpl-atelier flex min-h-screen flex-col bg-[var(--color-atelier-cream)] font-sans text-[var(--color-atelier-ink)]">
    <AtelierHeader />
    <main class="flex-1">
      <slot />
    </main>
    <AtelierFooter />
  </div>
</template>
