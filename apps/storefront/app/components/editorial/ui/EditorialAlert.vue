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
  warning: 'border-amber-300 bg-amber-50 text-amber-800',
  error: 'border-red-300 bg-red-50 text-red-700',
  info: 'border-[var(--color-primary-200)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]',
  success: 'border-emerald-300 bg-emerald-50 text-emerald-800'
}
</script>

<template>
  <div class="flex items-start gap-3 rounded-[3px] border p-4" :class="colorClasses[color]">
    <Icon v-if="icon" :name="icon" class="mt-0.5 size-4 shrink-0" />
    <div class="min-w-0 flex-1">
      <p v-if="title" class="text-sm font-semibold">{{ title }}</p>
      <p v-if="description" class="text-sm">{{ description }}</p>
      <slot />
    </div>
    <button v-if="closable" class="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss" @click="$emit('close')">
      <Icon name="i-lucide-x" class="size-3.5" />
    </button>
  </div>
</template>
