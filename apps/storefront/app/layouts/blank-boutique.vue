<script setup lang="ts">
import '~/assets/css/layers/boutique.css'
// Chromeless variant of boutique.vue — same palette (boutique.css) and
// footer, just without <BoutiqueHeader>. See app/layouts/blank-atelier.vue's
// comment for why this exists as its own file per template.
</script>

<template>
  <div class="tpl-boutique flex min-h-screen flex-col bg-default">
    <slot class="flex-1" />
    <BoutiqueFooter />
  </div>
</template>
