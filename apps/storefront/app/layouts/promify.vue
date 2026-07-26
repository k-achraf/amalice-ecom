<script setup lang="ts">
// Promify template — modern blue-accent retail. The .tpl-promify wrapper
// activates the scoped Promify palette (promify.css), so bg-primary-600 /
// text-neutral-900 inside resolve to Promify blue, not Polaris. The chrome
// (PromifyHeader/PromifyFooter) lives in components/promify/.
</script>

<template>
  <div class="tpl-promify flex min-h-screen flex-col bg-neutral-50">
    <PromifyHeader />
    <main class="flex-1">
      <slot />
    </main>
    <PromifyFooter />
  </div>
</template>
