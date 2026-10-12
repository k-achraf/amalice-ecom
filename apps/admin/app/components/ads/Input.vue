<script setup lang="ts">
import { cn } from '~/lib/cn'

defineOptions({ inheritAttrs: false })

// The design's `.input` (40px, 6px radius, teal border + 3px halo on focus). With an
// icon / trailing icon / addon it becomes an `.input-group`. `v-model.trim` and
// `v-model.number` modifiers are honoured.
const [model, modifiers] = defineModel<any>({
  set(v) {
    if (typeof v !== 'string') return v
    const t = modifiers.trim ? v.trim() : v
    return modifiers.number && t !== '' && !Number.isNaN(Number(t)) ? Number(t) : t
  }
})
const props = defineProps<{ placeholder?: string; type?: string; class?: string; disabled?: boolean; invalid?: boolean; icon?: string; trailingIcon?: string; size?: string; prefix?: string; suffix?: string }>()
const grouped = computed(() => !!(props.icon || props.trailingIcon || props.prefix || props.suffix))
</script>

<template>
  <div v-if="grouped" :class="cn('input-group', props.class)">
    <span v-if="icon || prefix" class="addon"><AdsIcon v-if="icon" :name="icon" style="width: 16px; height: 16px" /><template v-else>{{ prefix }}</template></span>
    <input v-bind="$attrs" v-model="model" class="input" :class="{ sm: size === 'sm' || size === 'xs' }" :type="type ?? 'text'" :placeholder="placeholder" :disabled="disabled">
    <span v-if="trailingIcon || suffix" class="addon"><AdsIcon v-if="trailingIcon" :name="trailingIcon" style="width: 16px; height: 16px" /><template v-else>{{ suffix }}</template></span>
  </div>
  <input v-else v-bind="$attrs" v-model="model" :class="cn('input', (size === 'sm' || size === 'xs') && 'sm', props.class)" :type="type ?? 'text'" :placeholder="placeholder" :disabled="disabled" :aria-invalid="invalid || undefined">
</template>
