<script setup lang="ts">
import '~/assets/css/layers/forge.css'
// Forge template chrome — a raw industrial workshop system, built entirely
// with plain Tailwind (no @nuxt/ui components anywhere in this template's
// tree — see components/forge/ui/ for the hand-built Button/Input/Select/
// etc. every Forge page uses instead). Concrete-gray surface, a
// safety-yellow accent, condensed Oswald display type, sharp corners, thick
// 3px borders, a hazard-stripe motif, no shadow. The .tpl-forge wrapper
// activates the scoped palette (forge.css). The chrome (ForgeHeader/
// ForgeFooter) lives in components/forge/.
</script>

<template>
  <div class="tpl-forge flex min-h-screen flex-col bg-default font-sans text-highlighted">
    <ForgeHeader />
    <main class="flex-1">
      <slot />
    </main>
    <ForgeFooter />
  </div>
</template>
