<script setup lang="ts">
import '~/assets/css/layers/boutique.css'
// Boutique template chrome — a bespoke "quiet luxury" system (not Polaris):
// warm ivory/near-black ink, zero radius, no shadows, Fraunces serif display
// type. The .tpl-boutique wrapper activates the scoped palette (boutique.css),
// so bg-primary / border-default / text-highlighted inside resolve to the
// boutique tokens, not Polaris's. The chrome (BoutiqueHeader/BoutiqueFooter)
// lives in components/boutique/.
</script>

<template>
  <div class="tpl-boutique flex min-h-screen flex-col bg-default">
    <BoutiqueHeader />
    <slot class="flex-1" />
    <BoutiqueFooter />
  </div>
</template>
