<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// Impulse deals — the urgency page: a big red flash-sale countdown (fed by
// the page shell's own timer), the ad-card grid, trust row.
const props = defineProps<{
  data: ProductListResponse | null
  timeLeft: { hours: number; minutes: number; seconds: number }
  pad: (n: number) => string
}>()
</script>

<template>
  <div class="bg-neutral-50">
    <div class="border-b-2 border-neutral-900 bg-[var(--color-impulse-red)] py-6 text-center text-white">
      <ImpulseBadge color="yellow" variant="solid">
        <Icon name="i-lucide-zap" class="size-3.5" />
        عروض خاطفة
      </ImpulseBadge>
      <h1 class="mt-2 font-display text-3xl font-black uppercase sm:text-4xl">تنتهي عند منتصف الليل</h1>
      <div class="mt-3 flex items-center justify-center gap-1 font-display text-2xl font-black tabular-nums">
        <span class="rounded-lg bg-white/15 px-3 py-1">{{ props.pad(props.timeLeft.hours) }}</span>
        <span>:</span>
        <span class="rounded-lg bg-white/15 px-3 py-1">{{ props.pad(props.timeLeft.minutes) }}</span>
        <span>:</span>
        <span class="rounded-lg bg-white/15 px-3 py-1">{{ props.pad(props.timeLeft.seconds) }}</span>
      </div>
    </div>

    <section class="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div v-if="props.data?.items.length" class="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <TemplateSection v-for="product in props.data.items" :key="product.id" name="ProductCard" :section-props="{ product }" />
      </div>
      <div v-else class="py-24 text-center">
        <Icon name="i-lucide-zap-off" class="mx-auto mb-3 size-10 text-neutral-300" />
        <p class="font-bold text-neutral-900">لا توجد عروض خاطفة حالياً.</p>
        <ImpulseButton to="/catalog" size="md" class="mt-4">شاهد كل العروض</ImpulseButton>
      </div>

      <div class="mt-12">
        <ImpulseTrustRow />
      </div>
    </section>
  </div>
</template>
