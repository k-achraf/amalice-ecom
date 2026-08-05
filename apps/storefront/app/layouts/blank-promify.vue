<script setup lang="ts">
import '~/assets/css/layers/promify.css'
// Chromeless variant of promify.vue — same palette (promify.css) and
// footer, just without <PromifyHeader>. See app/layouts/blank-atelier.vue's
// comment for why this exists as its own file per template.
</script>

<template>
  <div class="tpl-promify flex min-h-screen flex-col bg-neutral-50">
    <main class="flex-1">
      <slot />
    </main>
    <PromifyFooter />
  </div>
</template>
