<script setup lang="ts">
withDefaults(defineProps<{
  color?: 'primary' | 'error' | 'warning' | 'success' | 'neutral'
}>(), {
  color: 'primary'
})

const colorClasses: Record<string, string> = {
  primary: 'text-highlighted border-highlighted',
  error: 'text-red-600 border-red-300',
  warning: 'text-amber-700 border-amber-300',
  success: 'text-emerald-700 border-emerald-300',
  neutral: 'text-muted border-default'
}
</script>

<template>
  <span class="inline-flex items-center border px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest" :class="colorClasses[color]">
    <slot />
  </span>
</template>
