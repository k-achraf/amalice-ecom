<script setup lang="ts">
// Pulse's alert — plain <div> + Tailwind, no @nuxt/ui. A glossy rounded-2xl
// banner on a tinted background, used for cart/checkout notices and errors.
const props = withDefaults(defineProps<{
  color?: 'primary' | 'neutral' | 'error' | 'warning'
  icon?: string
  title?: string
  description?: string
  closable?: boolean
}>(), {
  color: 'primary'
})

defineEmits<{ close: [] }>()

const classesByColor: Record<string, string> = {
  primary: 'bg-primary-50 text-primary-700 [&_.pulse-alert-icon]:text-primary-600',
  neutral: 'bg-neutral-100 text-neutral-700 [&_.pulse-alert-icon]:text-neutral-500',
  error: 'bg-red-50 text-red-700 [&_.pulse-alert-icon]:text-red-600',
  warning: 'bg-amber-50 text-amber-800 [&_.pulse-alert-icon]:text-amber-600'
}

const rootClass = computed(() => [
  'flex items-start gap-3 rounded-2xl p-4',
  classesByColor[props.color] ?? classesByColor.primary
])
</script>

<template>
  <div :class="rootClass">
    <Icon v-if="icon" :name="icon" class="pulse-alert-icon mt-0.5 size-5 shrink-0" />
    <div class="min-w-0 flex-1">
      <p v-if="title" class="font-semibold">{{ title }}</p>
      <p v-if="description" class="text-sm opacity-80">{{ description }}</p>
      <slot />
    </div>
    <button v-if="closable" type="button" class="shrink-0 opacity-60 transition-opacity hover:opacity-100" aria-label="Dismiss" @click="$emit('close')">
      <Icon name="i-lucide-x" class="size-4" />
    </button>
  </div>
</template>
