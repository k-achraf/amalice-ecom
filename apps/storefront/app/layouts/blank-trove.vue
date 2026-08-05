<script setup lang="ts">
import '~/assets/css/layers/trove.css'
// Chromeless variant of trove.vue — same palette (trove.css) and footer,
// just without <TroveHeader>. See app/layouts/blank-atelier.vue's comment
// for why this exists as its own file per template.
</script>

<template>
  <div class="tpl-trove flex min-h-screen flex-col bg-default font-sans text-highlighted">
    <main class="flex-1">
      <slot />
    </main>
    <TroveFooter />
  </div>
</template>
