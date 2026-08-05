<script setup lang="ts">
import '~/assets/css/layers/forge.css'
// Chromeless variant of forge.vue — same palette (forge.css) and footer,
// just without <ForgeHeader>. See app/layouts/blank-atelier.vue's comment
// for why this exists as its own file per template.
</script>

<template>
  <div class="tpl-forge flex min-h-screen flex-col bg-default font-sans text-highlighted">
    <main class="flex-1">
      <slot />
    </main>
    <ForgeFooter />
  </div>
</template>
