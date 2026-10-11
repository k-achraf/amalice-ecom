<script setup lang="ts">
import { cn } from '~/lib/cn'

defineOptions({ inheritAttrs: false })

// `v-model.trim` / `v-model.number` modifiers are honoured (Nuxt UI did too).
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
  <div class="relative">
    <span v-if="icon || $slots.icon || $slots.leading" class="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-ads-subtlest [&_svg]:size-4">
      <slot name="icon"><slot name="leading"><AdsIcon v-if="icon" :name="icon" /></slot></slot>
    </span>
    <input
      v-bind="$attrs"
      v-model="model"
      :type="type ?? 'text'"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-invalid="invalid || undefined"
      :class="cn(
        'h-8 w-full rounded-ads border border-ads-input bg-ads-surface px-2 text-sm text-ads-text placeholder:text-ads-subtlest hover:bg-ads-hover focus:bg-ads-surface disabled:cursor-not-allowed disabled:bg-ads-sunken disabled:text-ads-disabled aria-[invalid]:border-ads-danger',
        (icon || $slots.icon || $slots.leading) && 'ps-8',
        (trailingIcon || $slots.trailing) && 'pe-8',
        props.class
      )"
    >
    <span v-if="trailingIcon || $slots.trailing" class="absolute inset-y-0 end-2.5 flex items-center text-ads-subtlest [&_svg]:size-4">
      <slot name="trailing"><AdsIcon v-if="trailingIcon" :name="trailingIcon" /></slot>
    </span>
  </div>
</template>
