<script setup lang="ts">
import { ChevronDown, Check } from 'lucide-vue-next'
import { SelectRoot, SelectTrigger, SelectValue, SelectPortal, SelectContent, SelectViewport, SelectItem, SelectItemText, SelectItemIndicator } from 'reka-ui'
import { cn } from '~/lib/cn'

type Primitive = string | number | null | undefined
export interface AdsSelectOption { label: string; value: Primitive }

// reka-ui Select speaks non-empty strings. Callers pass string|number|null values
// and get the same value back: options are matched by a string key, and
// null/undefined/'' values (e.g. a "None" option) map to a sentinel key.
// `items` is an alias of `options` (Nuxt UI naming) and may be plain strings/numbers;
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
  // No matching option → undefined so the placeholder shows.
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
      :class="cn('inline-flex h-8 w-full items-center justify-between gap-2 rounded-ads border border-ads-input bg-ads-surface px-2 text-start text-sm text-ads-text hover:bg-ads-hover disabled:cursor-not-allowed disabled:bg-ads-sunken disabled:text-ads-disabled data-[placeholder]:text-ads-subtlest', props.class)"
    >
      <span v-if="multiple" class="truncate" :class="{ 'text-ads-subtlest': !multiLabel }">{{ multiLabel || placeholder }}</span>
      <SelectValue v-else :placeholder="placeholder" class="truncate" />
      <ChevronDown class="size-4 shrink-0 text-ads-subtlest" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent position="popper" :side-offset="4" class="ads-root z-[60] max-h-72 min-w-(--reka-select-trigger-width) overflow-hidden rounded-ads-lg border border-ads-border bg-ads-surface shadow-ads-overlay">
        <SelectViewport class="p-1">
          <SelectItem
            v-for="o in list"
            :key="keyOf(o.value)"
            :value="keyOf(o.value)"
            class="relative flex h-8 cursor-default select-none items-center rounded-ads ps-7 pe-2 text-sm text-ads-text outline-none data-[highlighted]:bg-ads-hover data-[state=checked]:bg-ads-selected data-[state=checked]:text-ads-primary"
          >
            <SelectItemIndicator class="absolute start-2 inline-flex"><Check class="size-3.5" /></SelectItemIndicator>
            <SelectItemText>{{ o.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
