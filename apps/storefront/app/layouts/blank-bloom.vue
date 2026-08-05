<script setup lang="ts">
import '~/assets/css/layers/bloom.css'
// Chromeless variant of bloom.vue — same palette (bloom.css) and footer,
// just without <BloomHeader>. See app/layouts/blank-atelier.vue's comment
// for why this exists as its own file per template.
</script>

<template>
  <div class="tpl-bloom flex min-h-screen flex-col bg-default font-sans text-highlighted">
    <main class="flex-1">
      <slot />
    </main>
    <BloomFooter />
  </div>
</template>
