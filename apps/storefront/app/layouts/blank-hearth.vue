<script setup lang="ts">
import '~/assets/css/layers/hearth.css'
// Chromeless variant of hearth.vue — same palette (hearth.css) and footer,
// just without <HearthHeader>. See app/layouts/blank-atelier.vue's comment
// for why this exists as its own file per template.
</script>

<template>
  <div class="tpl-hearth flex min-h-screen flex-col bg-default font-sans text-highlighted">
    <main class="flex-1">
      <slot />
    </main>
    <HearthFooter />
  </div>
</template>
