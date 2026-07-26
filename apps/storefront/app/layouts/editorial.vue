<script setup lang="ts">
// Editorial template chrome — Atlassian Design System's structural language
// (not Polaris) reinterpreted at magazine scale: ADS blue #0C66E4, dark navy
// ink, small radius, elevation shadows, lozenge pills for kickers/tags. The
// .tpl-editorial wrapper activates the scoped palette (editorial.css), so
// bg-primary / border-default / text-highlighted inside resolve to the
// editorial tokens, not Polaris's. The chrome (EditorialHeader/EditorialFooter)
// lives in components/editorial/.
</script>

<template>
  <div class="tpl-editorial flex min-h-screen flex-col bg-default">
    <EditorialHeader />
    <slot class="flex-1" />
    <EditorialFooter />
  </div>
</template>
