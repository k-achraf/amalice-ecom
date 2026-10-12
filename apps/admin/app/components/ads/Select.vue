<script setup lang="ts">
import { cn } from '~/lib/cn'

type Primitive = string | number | null | undefined
export interface AdsSelectOption { label: string; value: Primitive }

// The design's native `.select`. Option values keep their type (string | number | null):
// options are rendered by index and mapped back, so a "None" option with `null` works.
// `items` is an alias of `options` and may be plain strings/numbers. `multiple` renders a
// checklist (model = array) since a native multi-select is unusable for this.
const props = defineProps<{
  modelValue?: any
  options?: (AdsSelectOption | string | number)[]
  items?: (AdsSelectOption | string | number)[]
  placeholder?: string
  class?: string
  disabled?: boolean
  multiple?: boolean
  size?: string
  valueKey?: string
  labelKey?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: any] }>()

const list = computed<AdsSelectOption[]>(() =>
  (props.options ?? props.items ?? []).map((o) => {
    if (typeof o === 'string' || typeof o === 'number') return { label: String(o), value: o }
    const rec = o as unknown as Record<string, Primitive>
    return { label: String(rec[props.labelKey ?? 'label']), value: rec[props.valueKey ?? 'value'] }
  })
)
const same = (a: Primitive, b: Primitive) => (a == null || a === '') ? (b == null || b === '') : String(a) === String(b)

const selectedIndex = computed(() => list.value.findIndex((o) => same(o.value, props.modelValue)))
function onChange(e: Event) {
  const i = Number((e.target as HTMLSelectElement).value)
  if (i >= 0) emit('update:modelValue', list.value[i]!.value)
}

function isOn(v: Primitive) { return ((props.modelValue ?? []) as Primitive[]).some((x) => same(x, v)) }
function toggle(v: Primitive, on: boolean) {
  const cur = ((props.modelValue ?? []) as Primitive[]).filter((x) => !same(x, v))
  emit('update:modelValue', on ? [...cur, v] : cur)
}
</script>

<template>
  <div v-if="multiple" class="stack" style="gap: 8px; max-height: 220px; overflow-y: auto; border: 1px solid var(--line); border-radius: var(--r); padding: 10px 12px">
    <label v-for="o in list" :key="String(o.value)" class="check">
      <input type="checkbox" :checked="isOn(o.value)" :disabled="disabled" @change="toggle(o.value, ($event.target as HTMLInputElement).checked)">{{ o.label }}
    </label>
    <span v-if="!list.length" class="muted">{{ placeholder }}</span>
  </div>
  <select v-else :class="cn('select', (size === 'sm' || size === 'xs') && 'sm', props.class)" :disabled="disabled" :value="selectedIndex" @change="onChange">
    <option v-if="selectedIndex < 0" value="-1" disabled>{{ placeholder ?? 'Select…' }}</option>
    <option v-for="(o, i) in list" :key="i" :value="i">{{ o.label }}</option>
  </select>
</template>
