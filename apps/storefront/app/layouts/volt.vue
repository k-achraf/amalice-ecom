<script setup lang="ts">
import '~/assets/css/layers/volt.css'
// Volt template chrome — a dark-mode-first tech & gadgets system, built
// entirely with plain Tailwind (no @nuxt/ui components anywhere in this
// template's tree — see components/volt/ui/ for the hand-built Button/
// Input/Select/etc. every Volt page uses instead). Near-black surface,
// electric cyan accent, geometric Sora display type paired with tabular
// JetBrains Mono specs, tight sharp radius, hairline borders, a blueprint
// grid-line motif. The .tpl-volt wrapper activates the scoped palette
// (volt.css). The chrome (VoltHeader/VoltFooter) lives in components/volt/.
</script>

<template>
  <div class="tpl-volt flex min-h-screen flex-col bg-black font-sans text-white">
    <VoltHeader />
    <main class="flex-1">
      <slot />
    </main>
    <VoltFooter />
  </div>
</template>
