<script setup lang="ts">
import '~/assets/css/layers/drop.css'
// Drop template chrome — a streetwear hype-drop system, built entirely with
// plain Tailwind (no @nuxt/ui components anywhere in this template's tree —
// see components/drop/ui/ for the hand-built Button/Input/Select/etc. every
// Drop page uses instead). Black surface, fiery red-orange accent,
// ultra-condensed Anton display type, sharp corners, flat (no shadow)
// contrast. The .tpl-drop wrapper activates the scoped palette (drop.css).
// The chrome (DropHeader/DropFooter) lives in components/drop/.
</script>

<template>
  <div class="tpl-drop flex min-h-screen flex-col bg-black font-sans text-white">
    <DropHeader />
    <main class="flex-1">
      <slot />
    </main>
    <DropFooter />
  </div>
</template>
