<script setup lang="ts">
defineProps<{ icon?: string; title: string; description?: string }>()
</script>

<template>
  <div class="flex flex-col items-center gap-2 py-12 text-center text-neutral-500">
    <Icon :name="icon ?? 'i-lucide-inbox'" class="size-8" />
    <p class="font-medium text-neutral-700 dark:text-neutral-300">{{ title }}</p>
    <p v-if="description" class="text-sm">{{ description }}</p>
    <slot />
  </div>
</template>
