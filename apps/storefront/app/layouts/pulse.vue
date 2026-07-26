<script setup lang="ts">
// Pulse template chrome — a bright glossy consumer-tech system, built
// entirely with plain Tailwind (no @nuxt/ui components anywhere in this
// template's tree — see components/pulse/ui/ for the hand-built Button/
// Input/Select/etc. every Pulse page uses instead). White surface, a
// violet-to-cyan gradient-mesh accent, rounded Outfit display type,
// rounded-2xl cards, a colorful soft glow shadow — the light-mode opposite
// of Volt. The .tpl-pulse wrapper activates the scoped palette (pulse.css).
// The chrome (PulseHeader/PulseFooter) lives in components/pulse/.
</script>

<template>
  <div class="tpl-pulse flex min-h-screen flex-col bg-white font-sans text-highlighted">
    <PulseHeader />
    <main class="flex-1">
      <slot />
    </main>
    <PulseFooter />
  </div>
</template>
