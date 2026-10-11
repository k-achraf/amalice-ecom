<script setup lang="ts">
import { cn } from '~/lib/cn'

defineOptions({ inheritAttrs: false })

// `v-model.trim` / `v-model.number` modifiers are honoured.
const [model, modifiers] = defineModel<any>({
  set(v) {
    if (typeof v !== 'string') return v
    const t = modifiers.trim ? v.trim() : v
    return modifiers.number && t !== '' && !Number.isNaN(Number(t)) ? Number(t) : t
  }
})
const props = defineProps<{ placeholder?: string; type?: string; class?: string; disabled?: boolean; invalid?: boolean; icon?: string; trailingIcon?: string; size?: string }>()
</script>

<template>
  <div :class="cn('input-wrap', disabled && 'is-disabled', props.class)" :aria-invalid="invalid || undefined">
    <slot name="icon"><slot name="leading"><AdsIcon v-if="icon" :name="icon" /></slot></slot>
    <input v-bind="$attrs" v-model="model" :type="type ?? 'text'" :placeholder="placeholder" :disabled="disabled">
    <slot name="trailing"><AdsIcon v-if="trailingIcon" :name="trailingIcon" /></slot>
  </div>
</template>
