<script setup lang="ts">
// The design's page frame: optional `.crumbs`, then `.page-head` (small line above
// the h1, actions on the right). `.main` supplies padding and the section gap.
// `#breadcrumb` renders inside `.crumbs`; `#title-extra` sits next to the h1 (status pills).
defineProps<{ title: string; description?: string; wide?: boolean }>()
</script>

<template>
  <header class="page-head" style="align-items: flex-start">
    <div class="title">
      <div v-if="$slots.breadcrumb" class="crumbs"><slot name="breadcrumb" /></div>
      <p v-if="description">{{ description }}</p>
      <h1>{{ title }}<slot name="title-extra" /></h1>
    </div>
    <slot name="actions" />
  </header>
  <slot />
</template>
