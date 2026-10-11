<script setup lang="ts">
// The design's `.kpi`: label, big number, optional delta. `dark` is the teal hero tile;
// warning/error map to the warn/danger tints. (No icon chip: the design has none.)
const props = withDefaults(defineProps<{
  label: string
  value: string | number
  delta?: { value: string; direction: 'up' | 'down' | 'neutral'; good?: 'up' | 'down' }
  icon?: string
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'dark'
  meta?: string
  unit?: string
}>(), { color: 'neutral' })

const variant = computed(() => (props.color === 'dark' ? 'dark' : props.color === 'warning' ? 'warn' : props.color === 'error' ? 'danger' : ''))
const good = computed(() => props.delta && props.delta.direction === (props.delta.good ?? 'up'))
</script>

<template>
  <div class="kpi" :class="variant">
    <span class="label">{{ label }}</span>
    <span class="value">{{ value }}<template v-if="unit">{{ ' ' }}<small>{{ unit }}</small></template></span>
    <span v-if="delta || meta || $slots.default" class="meta">
      <span v-if="delta" class="delta" :class="{ down: !good, brass: variant === 'dark' }">{{ delta.value }}</span>
      <slot>{{ meta }}</slot>
    </span>
  </div>
</template>
