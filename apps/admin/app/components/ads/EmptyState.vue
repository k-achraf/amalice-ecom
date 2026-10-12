<script setup lang="ts">
defineProps<{ icon?: string; title: string; description?: string }>()
</script>

<template>
  <div class="empty" style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 40px 8px">
    <AdsIcon :name="icon ?? 'i-lucide-inbox'" style="width: 28px; height: 28px; color: var(--sage)" />
    <p class="strong" style="color: var(--pine)">{{ title }}</p>
    <p v-if="description" class="muted" style="max-width: 420px">{{ description }}</p>
    <slot />
  </div>
</template>
