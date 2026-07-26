<script setup lang="ts">
// Hearth template chrome — a warm home & furniture system, built entirely
// with plain Tailwind (no @nuxt/ui components anywhere in this template's
// tree — see components/hearth/ui/ for the hand-built Button/Input/Select/
// etc. every Hearth page uses instead). Sandy linen surface, terracotta +
// sage accents, Lora serif display type, cozy rounded-xl corners, a subtle
// grounded shadow, framed-photo product cards. The .tpl-hearth wrapper
// activates the scoped palette (hearth.css). The chrome (HearthHeader/
// HearthFooter) lives in components/hearth/.
</script>

<template>
  <div class="tpl-hearth flex min-h-screen flex-col bg-default font-sans text-highlighted">
    <HearthHeader />
    <main class="flex-1">
      <slot />
    </main>
    <HearthFooter />
  </div>
</template>
