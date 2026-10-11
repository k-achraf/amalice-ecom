<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <Toaster
    theme="light"
    position="bottom-right"
    close-button
    :toast-options="{ style: { fontFamily: 'var(--font)', fontSize: '14px', borderRadius: '16px', border: '1px solid var(--line)', background: 'var(--white)', color: 'var(--pine)' } }"
  />
</template>
