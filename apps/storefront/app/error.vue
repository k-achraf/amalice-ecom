<script setup lang="ts">
import type { NuxtError } from '#app'

// SF-19 — on-brand 404/500. The default Nuxt error page isn't. Keeps the
// storefront header/footer context (layout: false here because error.vue
// renders standalone, but the chrome is replicated for navigation back).
defineProps<{ error: NuxtError }>()

useHead({ title: 'Something went wrong' })
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
    <div class="flex size-16 items-center justify-center rounded-full bg-elevated">
      <UIcon name="i-lucide-package-x" class="size-8 text-muted" />
    </div>
    <div class="space-y-2">
      <h1 class="text-3xl font-semibold text-highlighted">{{ error.statusCode }}</h1>
      <p class="text-muted">
        {{ error.statusCode === 404 ? "We couldn't find that page." : 'Something went wrong on our end.' }}
      </p>
    </div>
    <div class="flex gap-3">
      <UButton icon="i-lucide-home" to="/" color="primary">Back to shop</UButton>
      <UButton icon="i-lucide-search" to="/catalog" color="neutral" variant="outline">Browse catalog</UButton>
    </div>
  </main>
</template>
