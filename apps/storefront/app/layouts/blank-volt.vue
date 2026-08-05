<script setup lang="ts">
import '~/assets/css/layers/volt.css'
// Chromeless variant of volt.vue — same palette (volt.css) and footer, just
// without <VoltHeader>. See app/layouts/blank-atelier.vue's comment for why
// this exists as its own file per template.
</script>

<template>
  <div class="tpl-volt flex min-h-screen flex-col bg-black font-sans text-white">
    <main class="flex-1">
      <slot />
    </main>
    <VoltFooter />
  </div>
</template>
