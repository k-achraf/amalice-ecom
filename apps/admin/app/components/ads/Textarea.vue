<script setup lang="ts">
import { cn } from '~/lib/cn'

defineOptions({ inheritAttrs: false })
const model = defineModel<string | null>()
const props = defineProps<{ placeholder?: string; rows?: number; class?: string; disabled?: boolean; autofocus?: boolean }>()
</script>

<template>
  <textarea
    v-bind="$attrs"
    v-model="model"
    :rows="rows ?? 3"
    :placeholder="placeholder"
    :disabled="disabled"
    :autofocus="autofocus"
    :class="cn('w-full rounded-ads border border-ads-input bg-ads-surface px-2 py-1.5 text-sm text-ads-text placeholder:text-ads-subtlest hover:bg-ads-hover focus:bg-ads-surface disabled:cursor-not-allowed disabled:bg-ads-sunken disabled:text-ads-disabled', props.class)"
  />
</template>
