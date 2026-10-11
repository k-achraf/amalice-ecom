<script setup lang="ts">
import { cn } from '~/lib/cn'

defineOptions({ inheritAttrs: false })
const model = defineModel<string | null>()
const props = defineProps<{ placeholder?: string; rows?: number; class?: string; disabled?: boolean; autofocus?: boolean }>()
</script>

<template>
  <textarea v-bind="$attrs" v-model="model" :rows="rows ?? 3" :placeholder="placeholder" :disabled="disabled" :autofocus="autofocus" :class="cn('textarea', props.class)" />
</template>
