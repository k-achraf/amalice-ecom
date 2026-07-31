<script setup lang="ts">
// Impulse template chrome — the direct-response funnel system. The layout's
// job here is deliberately minimal: unlike every other template, Impulse's
// header carries NO navigation links (the classic funnel move — every exit
// link is a leak), so the chrome is a thin trust band + logo + cart. The
// .tpl-impulse wrapper activates the scoped palette + keyframes
// (impulse.css). Chrome lives in components/impulse/.
</script>

<template>
  <div class="tpl-impulse flex min-h-screen flex-col bg-neutral-50 font-sans text-neutral-900">
    <ImpulseHeader />
    <main class="flex-1">
      <slot />
    </main>
    <ImpulseFooter />
  </div>
</template>
