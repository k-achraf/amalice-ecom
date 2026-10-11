<script setup lang="ts">
// Standard page frame for migrated pages: title row (+ optional breadcrumb and
// action slot) above a centered content column.
defineProps<{ title: string; description?: string; wide?: boolean }>()
</script>

<template>
  <div class="mx-auto w-full px-4 py-6 sm:px-8" :class="wide ? 'max-w-[1600px]' : 'max-w-7xl'">
    <slot name="breadcrumb" />
    <header class="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="truncate text-2xl font-semibold leading-8 text-ads-text">{{ title }}</h1>
        <p v-if="description" class="mt-0.5 text-sm text-ads-subtle">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2"><slot name="actions" /></div>
    </header>
    <slot />
  </div>
</template>
