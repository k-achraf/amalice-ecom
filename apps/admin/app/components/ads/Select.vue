<script setup lang="ts">
import { ChevronDown, Check } from 'lucide-vue-next'
import { SelectRoot, SelectTrigger, SelectValue, SelectPortal, SelectContent, SelectViewport, SelectItem, SelectItemText, SelectItemIndicator } from 'reka-ui'
import { cn } from '~/lib/cn'

type Primitive = string | number | null | undefined
export interface AdsSelectOption { label: string; value: Primitive }

// reka-ui Select speaks non-empty strings. Callers pass string|number|null values
// and get the same value back: options are matched by a string key, and
// null/undefined/'' values (e.g. a "None" option) map to a sentinel key.
// `items` is an alias of `options` and may be plain strings/numbers;
// `multiple` makes the model an array.
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

const NONE = '__ads_none__'
const keyOf = (v: Primitive) => (v == null || v === '' ? NONE : String(v))

const list = computed<AdsSelectOption[]>(() =>
  (props.options ?? props.items ?? []).map((o) => {
    if (typeof o === 'string' || typeof o === 'number') return { label: String(o), value: o }
    const rec = o as unknown as Record<string, Primitive>
    return { label: String(rec[props.labelKey ?? 'label']), value: rec[props.valueKey ?? 'value'] }
  })
)

const rootValue = computed(() => {
  if (props.multiple) return ((props.modelValue ?? []) as Primitive[]).map(keyOf)
  // No matching option -> undefined so the placeholder shows.
  const k = keyOf(props.modelValue)
  return list.value.some((o) => keyOf(o.value) === k) ? k : undefined
})

const multiLabel = computed(() =>
  list.value.filter((o) => (rootValue.value as string[]).includes(keyOf(o.value))).map((o) => o.label).join(', ')
)

function valueFor(k: string) {
  return list.value.find((o) => keyOf(o.value) === k)?.value
}

function onChange(v: unknown) {
  if (props.multiple) emit('update:modelValue', (v as string[]).map(valueFor))
  else {
    const hit = list.value.find((o) => keyOf(o.value) === v)
    if (hit) emit('update:modelValue', hit.value ?? (hit.value === undefined ? undefined : null))
  }
}
</script>

<template>
  <SelectRoot :model-value="rootValue as any" :multiple="multiple" :disabled="disabled" @update:model-value="onChange">
    <SelectTrigger
      :class="cn('input-wrap cursor-pointer justify-between text-start text-sm', disabled && 'is-disabled', props.class)"
      style="font: 400 14px var(--font); color: var(--pine)"
    >
      <span v-if="multiple" class="truncate" :class="{ muted: !multiLabel }">{{ multiLabel || placeholder }}</span>
      <SelectValue v-else :placeholder="placeholder" class="truncate" />
      <ChevronDown class="i ms-auto" style="width: 18px; height: 18px; color: var(--text-2)" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent position="popper" :side-offset="6" class="panel z-[60] max-h-72 min-w-(--reka-select-trigger-width) overflow-hidden">
        <SelectViewport>
          <SelectItem v-for="o in list" :key="keyOf(o.value)" :value="keyOf(o.value)" class="menu-item" style="padding-inline-start: 34px">
            <SelectItemIndicator class="absolute inline-flex" style="inset-inline-start: 10px"><Check class="i" style="width: 16px; height: 16px" /></SelectItemIndicator>
            <SelectItemText>{{ o.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
