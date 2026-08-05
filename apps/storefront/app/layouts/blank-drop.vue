<script setup lang="ts">
import '~/assets/css/layers/drop.css'
// Chromeless variant of drop.vue — same palette (drop.css) and footer, just
// without <DropHeader>. See app/layouts/blank-atelier.vue's comment for why
// this exists as its own file per template.
</script>

<template>
  <div class="tpl-drop flex min-h-screen flex-col bg-black font-sans text-white">
    <main class="flex-1">
      <slot />
    </main>
    <DropFooter />
  </div>
</template>
