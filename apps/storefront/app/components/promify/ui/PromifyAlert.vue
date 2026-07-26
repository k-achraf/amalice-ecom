<script setup lang="ts">
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
  warning: 'bg-amber-50 text-amber-800 border-amber-100',
  error: 'bg-red-50 text-red-800 border-red-100',
  info: 'bg-primary-50 text-primary-800 border-primary-100',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-100'
}
</script>

<template>
  <div class="flex items-start gap-3 rounded-lg border p-4" :class="colorClasses[color]">
    <Icon v-if="icon" :name="icon" class="mt-0.5 size-5 shrink-0" />
    <div class="min-w-0 flex-1">
      <p v-if="title" class="font-semibold">{{ title }}</p>
      <p v-if="description" class="text-sm">{{ description }}</p>
      <slot />
    </div>
    <button v-if="closable" class="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss" @click="$emit('close')">
      <Icon name="i-lucide-x" class="size-4" />
    </button>
  </div>
</template>
