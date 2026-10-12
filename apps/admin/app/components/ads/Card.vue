<script setup lang="ts">
// The design's `.card` (+ `.card-head`). `flush` removes the padding (tables).
defineProps<{ title?: string; sub?: string; flush?: boolean }>()
</script>

<template>
  <section class="card" :class="{ flush }">
    <div v-if="title || $slots.actions" class="card-head">
      <h2 v-if="title">{{ title }}</h2>
      <slot name="actions" />
    </div>
    <p v-if="sub" class="card-sub">{{ sub }}</p>
    <slot />
  </section>
</template>
