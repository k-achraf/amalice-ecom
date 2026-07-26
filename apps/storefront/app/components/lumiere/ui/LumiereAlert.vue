<script setup lang="ts">
// Lumiere's alert — flat bordered banner, no @nuxt/ui, no shadow. Thin
// colored border on a white surface, sharp 0.25rem radius.
withDefaults(defineProps<{
  color?: 'warning' | 'error' | 'info' | 'success'
  icon?: string
  title?: string
  description?: string
  closable?: boolean
}>(), {
  color: 'warning'
})

defineEmits<{ close: [] }>()

const colorClasses: Record<string, string> = {
  warning: 'border-amber-500/50 bg-amber-50 text-amber-800',
  error: 'border-primary-600/60 bg-primary-50 text-primary-800',
  info: 'border-black/20 bg-neutral-50 text-black',
  success: 'border-emerald-500/50 bg-emerald-50 text-emerald-800'
}
</script>

<template>
  <div class="flex items-start gap-3 rounded border p-4" :class="colorClasses[color]">
    <Icon v-if="icon" :name="icon" class="mt-0.5 size-4 shrink-0" />
    <div class="min-w-0 flex-1">
      <p v-if="title" class="text-sm font-bold uppercase tracking-wide">{{ title }}</p>
      <p v-if="description" class="mt-0.5 text-xs opacity-80">{{ description }}</p>
      <slot />
    </div>
    <button v-if="closable" class="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss" @click="$emit('close')">
      <Icon name="i-lucide-x" class="size-3.5" />
    </button>
  </div>
</template>
