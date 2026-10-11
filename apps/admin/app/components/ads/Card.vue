<script setup lang="ts">
// The design's `.card`: white, 20px radius, 24px padding, 16px gap.
defineProps<{ title?: string }>()
</script>

<template>
  <section class="card">
    <div v-if="title || $slots.actions" class="card-head">
      <h2 v-if="title">{{ title }}</h2>
      <div v-if="$slots.actions" class="flex items-center gap-2"><slot name="actions" /></div>
    </div>
    <slot />
  </section>
</template>
