<script setup lang="ts">
import '~/assets/css/layers/impulse.css'
// Chromeless variant of impulse.vue — same palette (impulse.css) and footer,
// just without <ImpulseHeader>. See app/layouts/blank-atelier.vue's comment
// for why this exists as its own file per template.
</script>

<template>
  <div class="tpl-impulse flex min-h-screen flex-col bg-neutral-50 font-sans text-neutral-900">
    <main class="flex-1">
      <slot />
    </main>
    <ImpulseFooter />
  </div>
</template>
