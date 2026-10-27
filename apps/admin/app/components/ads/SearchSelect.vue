<script setup lang="ts">
// Pick-only searchable list: typing filters the options, but the value can only
// be one of them (used for wilaya / commune, which must be the system's own names).
type Primitive = string | number | null | undefined
interface Option { label: string; value: Primitive }

const props = defineProps<{ modelValue?: Primitive; options: Option[]; placeholder?: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: any] }>()

const open = ref(false)
const query = ref('')
const active = ref(0)
const root = ref<HTMLElement | null>(null)

const selected = computed(() => props.options.find((o) => String(o.value) === String(props.modelValue ?? '')) ?? null)
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const filtered = computed(() => {
  const q = norm(query.value.trim())
  return q ? props.options.filter((o) => norm(o.label).includes(q)) : props.options
})
const shown = computed(() => (open.value ? query.value : (selected.value?.label ?? '')))

function onInput(e: Event) {
  query.value = (e.target as HTMLInputElement).value
  active.value = 0
  open.value = true
}
function openList() {
  if (props.disabled) return
  query.value = ''
  active.value = Math.max(0, filtered.value.findIndex((o) => o === selected.value))
  open.value = true
}
function pick(o: Option) {
  emit('update:modelValue', o.value)
  open.value = false
  query.value = ''
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') { e.preventDefault(); open.value = true; active.value = Math.min(active.value + 1, filtered.value.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active.value = Math.max(active.value - 1, 0) }
  else if (e.key === 'Enter') { e.preventDefault(); const o = filtered.value[active.value]; if (open.value && o) pick(o) }
  else if (e.key === 'Escape') { open.value = false }
}
function onFocusOut(e: FocusEvent) {
  if (root.value?.contains(e.relatedTarget as Node | null)) return
  // Typed a full name but never clicked it: take the exact match instead of dropping the text.
  if (open.value && query.value.trim()) {
    const q = norm(query.value.trim())
    const exact = props.options.filter((o) => norm(o.label) === q)
    if (exact.length === 1 && exact[0] !== selected.value) emit('update:modelValue', exact[0]!.value)
  }
  open.value = false
}
</script>

<template>
  <div ref="root" class="ss" @focusout="onFocusOut">
    <input
      class="input"
      type="text"
      role="combobox"
      autocomplete="off"
      :aria-expanded="open"
      :disabled="disabled"
      :placeholder="placeholder ?? 'Select…'"
      :value="shown"
      @focus="openList"
      @click="openList"
      @input="onInput"
      @keydown="onKey"
    >
    <ul v-if="open" class="ss-list" role="listbox">
      <li v-for="(o, i) in filtered" :key="String(o.value)" role="option" tabindex="-1" :aria-selected="o === selected" :class="{ on: i === active, sel: o === selected }" @mousedown.prevent="pick(o)">{{ o.label }}</li>
      <li v-if="!filtered.length" class="empty-row">No match in the list</li>
    </ul>
  </div>
</template>

<style scoped>
.ss { position: relative; }
.ss-list { position: absolute; z-index: 60; inset-inline: 0; top: calc(100% + 4px); max-height: 240px; overflow-y: auto; margin: 0; padding: 4px; list-style: none; background: var(--white, #fff); border: 1px solid var(--line); border-radius: var(--r); box-shadow: 0 8px 24px rgba(0, 0, 0, .12); }
.ss-list li { padding: 8px 10px; border-radius: var(--r-sm); cursor: pointer; font-size: 14px; }
.ss-list li.on { background: var(--hover); }
.ss-list li.sel { font-weight: 600; color: var(--teal); }
.ss-list li.empty-row { color: var(--text-2); cursor: default; }
</style>
