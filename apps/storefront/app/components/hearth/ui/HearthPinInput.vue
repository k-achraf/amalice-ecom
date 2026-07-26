<script setup lang="ts">
// Hearth's OTP pin input — plain <input> boxes + Tailwind, no @nuxt/ui.
// Cozy rounded-xl boxes, auto-advances focus on digit entry, steps back on
// backspace, splits a pasted code across all boxes.
const props = withDefaults(defineProps<{
  modelValue: string[]
  length?: number
}>(), {
  length: 6
})

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const boxRefs = ref<(HTMLInputElement | null)[]>([])

function setDigit(index: number, raw: string) {
  const digit = raw.replace(/\D/g, '').slice(-1)
  const next = [...props.modelValue]
  next[index] = digit
  emit('update:modelValue', next)
  if (digit && index < props.length - 1) boxRefs.value[index + 1]?.focus()
}

function onInput(index: number, e: Event) {
  setDigit(index, (e.target as HTMLInputElement).value)
}

function onKeydown(index: number, e: KeyboardEvent) {
  if (e.key === 'Backspace' && !props.modelValue[index] && index > 0) {
    boxRefs.value[index - 1]?.focus()
  }
}

function onPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text') ?? ''
  const digits = text.replace(/\D/g, '').slice(0, props.length).split('')
  if (!digits.length) return
  e.preventDefault()
  const next = [...props.modelValue]
  digits.forEach((d, i) => { next[i] = d })
  emit('update:modelValue', next)
  boxRefs.value[Math.min(digits.length, props.length - 1)]?.focus()
}
</script>

<template>
  <div class="flex justify-center gap-2.5" @paste="onPaste">
    <input
      v-for="i in length"
      :key="i - 1"
      :ref="(el: Element | null) => { boxRefs[i - 1] = el as HTMLInputElement | null }"
      :value="modelValue[i - 1] ?? ''"
      type="text"
      inputmode="numeric"
      autocomplete="one-time-code"
      maxlength="1"
      class="size-12 rounded-xl border border-neutral-200 bg-white text-center text-xl font-medium tabular-nums text-[var(--color-hearth-ink)] transition-all duration-200 focus:border-primary-400 focus:shadow-[var(--shadow-hearth-sm)] focus:outline-none sm:size-14"
      @input="onInput(i - 1, $event)"
      @keydown="onKeydown(i - 1, $event)"
    >
  </div>
</template>
