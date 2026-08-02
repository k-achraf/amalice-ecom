<script setup lang="ts">
import '~/assets/css/layers/nova.css'
// Nova template chrome — a fully custom "modern shop" system, built entirely
// with plain Tailwind CSS (no @nuxt/ui components anywhere in this
// template's tree — see components/nova/ui/ for the hand-built Button/
// Input/Select/etc. every Nova page uses instead). Neubrutalist commerce:
// thick black borders, hard offset shadows, a loud lime accent, heavy
// Space Grotesk display type. The .tpl-nova wrapper activates the scoped
// palette (nova.css). The chrome (NovaHeader/NovaFooter) lives in
// components/nova/.
</script>

<template>
  <div class="tpl-nova flex min-h-screen flex-col bg-white font-sans text-black">
    <NovaHeader />
    <main class="flex-1">
      <slot />
    </main>
    <NovaFooter />
  </div>
</template>
