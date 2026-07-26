<script setup lang="ts">
withDefaults(defineProps<{
  color?: 'primary' | 'error' | 'warning' | 'success' | 'neutral'
}>(), {
  color: 'primary'
})

const colorClasses: Record<string, string> = {
  primary: 'bg-primary-50 text-primary-700',
  error: 'bg-red-50 text-red-700',
  warning: 'bg-amber-50 text-amber-700',
  success: 'bg-emerald-50 text-emerald-700',
  neutral: 'bg-neutral-100 text-neutral-700'
}
</script>

<template>
  <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold" :class="colorClasses[color]">
    <slot />
  </span>
</template>
