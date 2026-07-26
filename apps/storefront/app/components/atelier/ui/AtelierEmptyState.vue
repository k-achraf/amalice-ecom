<script setup lang="ts">
defineProps<{ icon?: string; title: string; description?: string }>()
</script>

<template>
  <div class="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-neutral-300 py-20 text-center">
    <div class="flex size-14 items-center justify-center rounded-full bg-primary-50">
      <Icon :name="icon ?? 'i-lucide-inbox'" class="size-6 text-primary-500" />
    </div>
    <p class="font-display mt-1 text-xl text-[var(--color-atelier-ink)]">{{ title }}</p>
    <p v-if="description" class="max-w-sm text-sm text-neutral-500">{{ description }}</p>
    <slot />
  </div>
</template>
