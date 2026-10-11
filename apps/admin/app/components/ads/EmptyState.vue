<script setup lang="ts">
defineProps<{ icon?: string; title: string; description?: string }>()
</script>

<template>
  <div class="flex flex-col items-center gap-2 rounded-ads-lg border border-dashed border-ads-border py-12 text-center">
    <AdsIcon :name="icon ?? 'i-lucide-inbox'" class="size-8 text-ads-subtlest" />
    <p class="font-medium text-ads-text">{{ title }}</p>
    <p v-if="description" class="max-w-md text-sm text-ads-subtle">{{ description }}</p>
    <slot />
  </div>
</template>
