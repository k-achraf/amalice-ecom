<script setup lang="ts">
// Bordered surface with an optional heading row (title + actions slot).
defineProps<{ title?: string }>()
</script>

<template>
  <section class="rounded-ads-lg border border-ads-border bg-ads-surface p-5">
    <div v-if="title || $slots.actions" class="mb-3 flex items-center justify-between gap-2">
      <h2 v-if="title" class="text-sm font-semibold text-ads-subtle">{{ title }}</h2>
      <div v-if="$slots.actions" class="flex items-center gap-1"><slot name="actions" /></div>
    </div>
    <slot />
  </section>
</template>
