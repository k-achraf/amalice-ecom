<script setup lang="ts">
// Impulse's urgency countdown — ticks down to local midnight ("today's
// price ends tonight"), then naturally restarts, so it's always honest
// about *something* ending without a fabricated fixed deadline. Client-only
// ticking; SSR renders a stable placeholder to avoid hydration mismatch.
const props = withDefaults(defineProps<{
  label?: string
}>(), {
  label: 'ينتهي عرض اليوم خلال'
})

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const remaining = computed(() => {
  const d = new Date(now.value)
  const midnight = new Date(d)
  midnight.setHours(24, 0, 0, 0)
  const total = Math.max(0, Math.floor((midnight.getTime() - d.getTime()) / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return { hours, minutes, seconds }
})

function pad(n: number) {
  return String(n).padStart(2, '0')
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-2 text-center">
    <span class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-impulse-red)]">
      <Icon name="i-lucide-alarm-clock" class="size-4" />
      {{ props.label }}
    </span>
    <ClientOnly>
      <div class="flex items-center gap-1 font-display text-lg font-black tabular-nums text-neutral-900">
        <span class="rounded-lg bg-neutral-900 px-2 py-0.5 text-white">{{ pad(remaining.hours) }}</span>
        <span class="text-[var(--color-impulse-red)]">:</span>
        <span class="rounded-lg bg-neutral-900 px-2 py-0.5 text-white">{{ pad(remaining.minutes) }}</span>
        <span class="text-[var(--color-impulse-red)]">:</span>
        <span class="rounded-lg bg-neutral-900 px-2 py-0.5 text-white">{{ pad(remaining.seconds) }}</span>
      </div>
      <template #fallback>
        <div class="flex items-center gap-1 font-display text-lg font-black tabular-nums text-neutral-900">
          <span class="rounded-lg bg-neutral-900 px-2 py-0.5 text-white">--</span>
          <span class="text-[var(--color-impulse-red)]">:</span>
          <span class="rounded-lg bg-neutral-900 px-2 py-0.5 text-white">--</span>
          <span class="text-[var(--color-impulse-red)]">:</span>
          <span class="rounded-lg bg-neutral-900 px-2 py-0.5 text-white">--</span>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
