<script setup lang="ts">
// Bloom's alert — plain rounded-3xl banner + Tailwind, no @nuxt/ui.
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
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  error: 'bg-red-50 border-red-200 text-red-700',
  info: 'bg-primary-50 border-primary-200 text-primary-700',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800'
}
</script>

<template>
  <div class="flex items-start gap-3 rounded-3xl border p-4" :class="colorClasses[color]">
    <Icon v-if="icon" :name="icon" class="mt-0.5 size-4 shrink-0" />
    <div class="min-w-0 flex-1">
      <p v-if="title" class="text-sm font-semibold">{{ title }}</p>
      <p v-if="description" class="text-xs opacity-80">{{ description }}</p>
      <slot />
    </div>
    <button v-if="closable" class="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss" @click="$emit('close')">
      <Icon name="i-lucide-x" class="size-3.5" />
    </button>
  </div>
</template>
