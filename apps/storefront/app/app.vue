<script setup lang="ts">
// Resolves the active storefront template from /settings and binds it to
// NuxtLayout. CRITICAL: the settings fetch is awaited here so the layout
// name is resolved BEFORE <NuxtLayout> picks a layout file during SSR.
// Without the await, NuxtLayout resolves to the default/empty name on the
// first SSR pass (before the async settings settle) and the wrong template's
// chrome renders — the bug where boutique/editorial/promify showed the
// minimal SiteHeader.
//
// The fetch is shared (same key 'store-settings') with useStoreSettings(),
// so components that read it later get the same resolved payload — no double
// fetch.
const config = useRuntimeConfig()
const { data: settings } = await useAsyncData(
  'store-settings',
  () => $fetch('/settings', { baseURL: config.public.apiBase }),
  { default: () => ({ activeTemplate: 'minimal', storeName: 'Amalice', announcementText: null }) }
)
const template = computed(() => settings.value?.activeTemplate ?? 'minimal')
</script>

<template>
  <NuxtLayout :name="template">
    <NuxtPage />
  </NuxtLayout>
  <MetaPixelScript />
  <TikTokPixelScript />
</template>
