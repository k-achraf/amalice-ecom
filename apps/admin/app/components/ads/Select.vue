<script setup lang="ts">
import { ChevronDown, Check } from 'lucide-vue-next'
import { SelectRoot, SelectTrigger, SelectValue, SelectPortal, SelectContent, SelectViewport, SelectItem, SelectItemText, SelectItemIndicator } from 'reka-ui'
import { cn } from '~/lib/cn'

export interface AdsSelectOption { label: string; value: string | number }

// reka-ui Select speaks strings; callers pass string|number values and get the
// same type back (numbers are matched by String(value)).
const props = defineProps<{ modelValue?: string | number; options: AdsSelectOption[]; placeholder?: string; class?: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()

function onChange(v: unknown) {
  const hit = props.options.find((o) => String(o.value) === v)
  if (hit) emit('update:modelValue', hit.value)
}
</script>

<template>
  <SelectRoot :model-value="modelValue === undefined ? undefined : String(modelValue)" :disabled="disabled" @update:model-value="onChange">
    <SelectTrigger
      :class="cn('inline-flex h-8 w-full items-center justify-between gap-2 rounded-ads border border-ads-input bg-ads-surface px-2 text-sm text-ads-text hover:bg-ads-hover disabled:cursor-not-allowed disabled:bg-ads-sunken disabled:text-ads-disabled', props.class)"
    >
      <SelectValue :placeholder="placeholder" class="truncate" />
      <ChevronDown class="size-4 shrink-0 text-ads-subtlest" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent position="popper" :side-offset="4" class="ads-root z-50 max-h-72 min-w-(--reka-select-trigger-width) overflow-hidden rounded-ads-lg border border-ads-border bg-ads-surface shadow-ads-overlay">
        <SelectViewport class="p-1">
          <SelectItem
            v-for="o in options"
            :key="o.value"
            :value="String(o.value)"
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
