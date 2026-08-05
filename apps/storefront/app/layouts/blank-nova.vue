<script setup lang="ts">
import '~/assets/css/layers/nova.css'
// Chromeless variant of nova.vue — same palette (nova.css) and footer, just
// without <NovaHeader>. See app/layouts/blank-atelier.vue's comment for why
// this exists as its own file per template.
</script>

<template>
  <div class="tpl-nova flex min-h-screen flex-col bg-white font-sans text-black">
    <main class="flex-1">
      <slot />
    </main>
    <NovaFooter />
  </div>
</template>
