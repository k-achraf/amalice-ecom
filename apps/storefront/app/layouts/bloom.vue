<script setup lang="ts">
// Bloom template chrome — a soft beauty & cosmetics system, built entirely
// with plain Tailwind (no @nuxt/ui components anywhere in this template's
// tree — see components/bloom/ui/ for the hand-built Button/Input/Select/etc.
// every Bloom page uses instead). Airy blush-cream surface, bubblegum-pink
// accent, rounded Poppins display type, rounded-3xl cards, full-pill
// buttons, a soft blooming glow shadow. The .tpl-bloom wrapper activates the
// scoped palette (bloom.css). The chrome (BloomHeader/BloomFooter) lives in
// components/bloom/.
</script>

<template>
  <div class="tpl-bloom flex min-h-screen flex-col bg-default font-sans text-highlighted">
    <BloomHeader />
    <main class="flex-1">
      <slot />
    </main>
    <BloomFooter />
  </div>
</template>
