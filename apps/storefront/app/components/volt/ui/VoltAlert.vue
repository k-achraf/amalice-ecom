<script setup lang="ts">
// Volt's alert — plain bordered panel + Tailwind, no @nuxt/ui.
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
  warning: 'border-amber-400/30 bg-amber-400/5 text-amber-300',
  error: 'border-red-500/30 bg-red-500/5 text-red-300',
  info: 'border-primary-400/30 bg-primary-400/5 text-primary-300',
  success: 'border-emerald-400/30 bg-emerald-400/5 text-emerald-300'
}
</script>

<template>
  <div class="flex items-start gap-3 rounded-md border p-4" :class="colorClasses[color]">
    <Icon v-if="icon" :name="icon" class="mt-0.5 size-4 shrink-0" />
    <div class="min-w-0 flex-1">
      <p v-if="title" class="text-sm font-medium">{{ title }}</p>
      <p v-if="description" class="text-sm text-white/60">{{ description }}</p>
      <slot />
    </div>
    <button v-if="closable" class="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss" @click="$emit('close')">
      <Icon name="i-lucide-x" class="size-3.5" />
    </button>
  </div>
</template>
