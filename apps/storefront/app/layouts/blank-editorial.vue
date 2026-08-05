<script setup lang="ts">
import '~/assets/css/layers/editorial.css'
// Chromeless variant of editorial.vue — same palette (editorial.css) and
// footer, just without <EditorialHeader>. See app/layouts/blank-atelier.vue's
// comment for why this exists as its own file per template.
</script>

<template>
  <div class="tpl-editorial flex min-h-screen flex-col bg-default">
    <slot class="flex-1" />
    <EditorialFooter />
  </div>
</template>
