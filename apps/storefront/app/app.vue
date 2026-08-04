<script setup lang="ts">
import type { StoreTemplate } from '@amalice/shared'

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
  () => $fetch<{ activeTemplate: StoreTemplate }>('/settings', { baseURL: config.public.apiBase }),
  { default: () => ({ activeTemplate: 'minimal' as StoreTemplate, storeName: 'Amalice', announcementText: null }) }
)
const template = computed(() => settings.value?.activeTemplate ?? 'minimal')

// A page can opt out of the active template's chrome entirely via
// definePageMeta({ layout: 'blank' }) (currently only app/pages/lp/ — the AI
// landing-page funnel, which must never show the store's navbar/header).
// Forcing :name="template" unconditionally here — the original approach —
// silently overrode any such page-level choice, which is why that route
// used to render with the normal header despite its own blank layout.
const route = useRoute()
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- NuxtLayout's `name` prop type is a closed union of
// generated layout-file names; this resolves dynamically between the page's own meta.layout and the active
// storefront template, both of which are always valid layout names but not expressible as that literal union here.
const layoutName = computed(() => ((route.meta.layout as string | undefined) ?? template.value) as any)
</script>

<template>
  <NuxtLayout :name="layoutName">
    <NuxtPage />
  </NuxtLayout>
  <MetaPixelScript />
  <TikTokPixelScript />
</template>
