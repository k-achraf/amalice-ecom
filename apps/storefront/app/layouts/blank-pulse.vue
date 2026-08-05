<script setup lang="ts">
import '~/assets/css/layers/pulse.css'
// Chromeless variant of pulse.vue — same palette (pulse.css) and footer,
// just without <PulseHeader>. See app/layouts/blank-atelier.vue's comment
// for why this exists as its own file per template.
</script>

<template>
  <div class="tpl-pulse flex min-h-screen flex-col bg-white font-sans text-highlighted">
    <main class="flex-1">
      <slot />
    </main>
    <PulseFooter />
  </div>
</template>
