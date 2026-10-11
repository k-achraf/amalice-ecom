<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'

const colorMode = useColorMode()
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <Toaster :theme="colorMode.value === 'dark' ? 'dark' : 'light'" position="bottom-right" rich-colors close-button />
</template>
