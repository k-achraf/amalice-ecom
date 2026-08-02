<script setup lang="ts">
import '~/assets/css/layers/trove.css'
// Trove template chrome — a warm collected-treasures accessories system,
// built entirely with plain Tailwind (no @nuxt/ui components anywhere in
// this template's tree — see components/trove/ui/ for the hand-built
// Button/Input/Select/etc. every Trove page uses instead). Cream surface, a
// mustard + deep-teal duo-tone accent, quirky Bricolage Grotesque display
// type, mixed radius (circular photo crops against sharp card frames), a
// soft warm shadow. The .tpl-trove wrapper activates the scoped palette
// (trove.css). The chrome (TroveHeader/TroveFooter) lives in
// components/trove/.
</script>

<template>
  <div class="tpl-trove flex min-h-screen flex-col bg-default font-sans text-highlighted">
    <TroveHeader />
    <main class="flex-1">
      <slot />
    </main>
    <TroveFooter />
  </div>
</template>
