<script setup lang="ts">
// Drop's alert — flat bordered banner, no @nuxt/ui. Dark-surface friendly
// colors (no light pastel backgrounds — thin colored border + tinted text
// on the black/panel surface instead). No shadow.
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
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  error: 'border-primary-500/50 bg-primary-500/10 text-primary-300',
  info: 'border-white/20 bg-white/5 text-white',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
}
</script>

<template>
  <div class="flex items-start gap-3 border p-4" :class="colorClasses[color]">
    <Icon v-if="icon" :name="icon" class="mt-0.5 size-4 shrink-0" />
    <div class="min-w-0 flex-1">
      <p v-if="title" class="text-sm font-bold uppercase tracking-wide">{{ title }}</p>
      <p v-if="description" class="mt-0.5 text-xs text-white/60">{{ description }}</p>
      <slot />
    </div>
    <button v-if="closable" class="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss" @click="$emit('close')">
      <Icon name="i-lucide-x" class="size-3.5" />
    </button>
  </div>
</template>
