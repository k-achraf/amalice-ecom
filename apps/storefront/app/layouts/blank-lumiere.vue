<script setup lang="ts">
import '~/assets/css/layers/lumiere.css'
// Chromeless variant of lumiere.vue — same palette (lumiere.css) and footer,
// just without <LumiereHeader>. See app/layouts/blank-atelier.vue's comment
// for why this exists as its own file per template.
</script>

<template>
  <div class="tpl-lumiere flex min-h-screen flex-col bg-white font-sans text-highlighted">
    <main class="flex-1">
      <slot />
    </main>
    <LumiereFooter />
  </div>
</template>
