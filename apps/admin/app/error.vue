<script setup lang="ts">
import type { NuxtError } from '#app'

// Branded fallback for anything a page throws during setup (a failed fetch, a missing
// route). Without this Nuxt falls back to its own unstyled 500/404 screen.
const props = defineProps<{ error: NuxtError }>()
const route = useRoute()

const notFound = computed(() => props.error.statusCode === 404)
const title = computed(() => (notFound.value ? 'Page not found' : 'Something went wrong'))
const detail = computed(() =>
  notFound.value
    ? 'This page does not exist, or it has moved.'
    : props.error.statusMessage || props.error.message || 'The request failed. Check the API is running and try again.'
)

function retry() {
  clearError({ redirect: route.fullPath })
}
function home() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <NuxtLayout :name="route.path === '/login' ? false : 'default'">
    <header class="page-head">
      <div class="title">
        <p>{{ props.error.statusCode }}</p>
        <h1>{{ title }}</h1>
      </div>
    </header>
    <section class="card" aria-live="polite">
      <div class="empty" style="padding: 56px 20px">
        <AdsIcon :name="notFound ? 'i-lucide-search' : 'i-lucide-alert-triangle'" style="width: 32px; height: 32px; color: var(--brass); display: block; margin: 0 auto" />
        <p style="max-width: 460px; margin: 12px auto 0">{{ detail }}</p>
        <div style="display: flex; justify-content: center; gap: 8px; margin-top: 20px">
          <button v-if="!notFound" class="btn btn-primary" type="button" @click="retry"><AdsIcon name="i-lucide-refresh-cw" />Try again</button>
          <button class="btn" type="button" @click="home"><AdsIcon name="i-lucide-arrow-left" />Back to overview</button>
        </div>
      </div>
    </section>
  </NuxtLayout>
</template>
