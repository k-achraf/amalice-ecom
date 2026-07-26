<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// LOGIC ONLY — fetch + countdown timer. Presentation via <TemplatePage name="Deals">.
useSeoMeta({
  title: "Today's Deals",
  description: 'Limited-time curated picks. Cash on delivery, no account required.'
})

const { data } = await useApiFetch<ProductListResponse>('/products', {
  query: { pageSize: 12 },
  key: 'deals-products'
})

// Self-contained countdown (no VueUse useNow — Amalice doesn't ship @vueuse/nuxt).
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const endOfDay = computed(() => {
  const d = new Date(now.value)
  d.setHours(23, 59, 59, 999)
  return d
})
const timeLeft = computed(() => {
  const diff = endOfDay.value.getTime() - now.value.getTime()
  if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0 }
  return {
    hours: Math.floor(diff / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000)
  }
})
const pad = (n: number) => String(n).padStart(2, '0')
</script>

<template>
  <TemplatePage name="Deals" :page-props="{ data, timeLeft, pad }" />
</template>
