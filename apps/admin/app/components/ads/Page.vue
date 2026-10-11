<script setup lang="ts">
// The design's page frame: `.page-head` (subtitle `p` above a 36px h1, actions on
// the right) followed by the page content. The surrounding `.main` supplies the
// padding and the 24px gap between sections.
defineProps<{ title: string; description?: string; wide?: boolean }>()
</script>

<template>
  <slot name="breadcrumb" />
  <header class="page-head">
    <div class="title">
      <p v-if="description">{{ description }}</p>
      <h1>{{ title }}</h1>
    </div>
    <slot name="actions" />
  </header>
  <slot />
</template>
