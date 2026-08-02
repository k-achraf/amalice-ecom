<script setup lang="ts">
import '~/assets/css/layers/lumiere.css'
// Lumière template chrome — a bold black/white/crimson beauty-editorial
// system, built entirely with plain Tailwind (no @nuxt/ui components
// anywhere in this template's tree — see components/lumiere/ui/ for the
// hand-built Button/Input/Select/etc. every Lumière page uses instead).
// Stark high-contrast surface, oversized Bodoni Moda display serif, sharp
// minimal radius, no shadow — a loud magazine spread, not a soft pastel
// shelf. The .tpl-lumiere wrapper activates the scoped palette
// (lumiere.css). The chrome (LumiereHeader/LumiereFooter) lives in
// components/lumiere/.
</script>

<template>
  <div class="tpl-lumiere flex min-h-screen flex-col bg-white font-sans text-highlighted">
    <LumiereHeader />
    <main class="flex-1">
      <slot />
    </main>
    <LumiereFooter />
  </div>
</template>
