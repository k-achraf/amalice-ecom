<script setup lang="ts">
defineProps<{ icon?: string; title: string; description?: string }>()
</script>

<template>
  <div class="empty flex flex-col items-center gap-2" style="padding: 48px 8px">
    <AdsIcon :name="icon ?? 'i-lucide-inbox'" style="width: 32px; height: 32px; color: var(--sage)" />
    <p class="strong" style="margin: 0; color: var(--pine)">{{ title }}</p>
    <p v-if="description" class="muted" style="margin: 0; max-width: 420px">{{ description }}</p>
    <slot />
  </div>
</template>
