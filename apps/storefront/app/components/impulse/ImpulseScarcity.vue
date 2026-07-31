<script setup lang="ts">
// Impulse's scarcity bar — visualizes REAL stock as "% claimed" of a
// nominal batch (stock + a fixed batch base), with the animated striped
// fill (impulse.css .scarcity-fill). Only rendered when stock is genuinely
// low-ish: an "almost gone" bar over deep stock destroys trust.
const props = defineProps<{
  stock: number
  threshold: number
}>()

// Claimed% derived from real stock against a nominal batch of
// threshold*4 units — deterministic, no fake randomness. Clamped 55–95 so
// the bar always reads meaningfully urgent when it shows at all.
const show = computed(() => props.stock > 0 && props.stock <= props.threshold * 2)
const claimedPct = computed(() => {
  const batch = Math.max(props.threshold * 4, props.stock + 1)
  const pct = Math.round(((batch - props.stock) / batch) * 100)
  return Math.min(95, Math.max(55, pct))
})
</script>

<template>
  <div v-if="show" class="space-y-1.5">
    <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wide">
      <span class="flex items-center gap-1 text-[var(--color-impulse-red)]">
        <Icon name="i-lucide-flame" class="size-4" />
        تم بيع {{ claimedPct }}%
      </span>
      <span class="text-neutral-600">تبقى {{ props.stock }} فقط</span>
    </div>
    <div class="h-3 overflow-hidden rounded-full bg-neutral-100">
      <div class="scarcity-fill h-full rounded-full transition-all duration-500" :style="{ width: `${claimedPct}%` }" />
    </div>
  </div>
</template>
