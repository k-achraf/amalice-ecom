<script setup lang="ts">
defineProps<{ icon?: string; title: string; description?: string }>()
</script>

<template>
  <div class="flex flex-col items-center gap-2 border-2 border-dashed border-black/20 py-20 text-center">
    <Icon :name="icon ?? 'i-lucide-inbox'" class="size-9 text-black/30" />
    <p class="font-display text-lg text-black">{{ title }}</p>
    <p v-if="description" class="max-w-sm text-sm text-black/50">{{ description }}</p>
    <slot />
  </div>
</template>
