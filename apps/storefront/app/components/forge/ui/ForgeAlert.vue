<script setup lang="ts">
// Forge's alert — flat bordered banner, no @nuxt/ui, no shadow. Thick ink
// border with a tinted fill matched to the status color.
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
  warning: 'border-[var(--color-forge-ink)] bg-primary-50 text-[var(--color-forge-ink)]',
  error: 'border-red-700 bg-red-50 text-red-800',
  info: 'border-[var(--color-forge-ink)] bg-neutral-100 text-[var(--color-forge-ink)]',
  success: 'border-emerald-700 bg-emerald-50 text-emerald-800'
}
</script>

<template>
  <div class="flex items-start gap-3 border-[3px] p-4" :class="colorClasses[color]">
    <Icon v-if="icon" :name="icon" class="mt-0.5 size-4 shrink-0" />
    <div class="min-w-0 flex-1">
      <p v-if="title" class="text-sm font-bold uppercase tracking-wide">{{ title }}</p>
      <p v-if="description" class="mt-0.5 text-sm">{{ description }}</p>
      <slot />
    </div>
    <button v-if="closable" class="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss" @click="$emit('close')">
      <Icon name="i-lucide-x" class="size-3.5" />
    </button>
  </div>
</template>
