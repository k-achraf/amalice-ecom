<script setup lang="ts">
// Injects the TikTok Pixel base code when the "tiktok-pixel" app (packages/
// shared/apps.ts) is enabled and configured with a Pixel Code. Renders no
// markup of its own — same head-injection-side-effect pattern as
// MetaPixelScript.vue, mounted once from app.vue so it runs on every page
// regardless of active template.
//
// Deliberately NOT awaited, for the same reason as MetaPixelScript.vue: a
// third-party tracking script has nothing to do with first paint.
const config = useRuntimeConfig()
const { data } = useAsyncData<{ pixelCode: string | null }>(
  'tiktok-pixel-config',
  () => $fetch('/apps/tiktok-pixel', { baseURL: config.public.apiBase }),
  { default: () => ({ pixelCode: null }) }
)

// pixelCode is validated server-side (packages/shared TikTokPixelConfigSchema)
// to be letters/digits only, so it's safe to interpolate directly into the
// script — same reasoning as MetaPixelScript.vue's pixelId.
useHead(() => {
  const pixelCode = data.value?.pixelCode
  if (!pixelCode) return {}
  return {
    script: [{
      key: 'tiktok-pixel',
      // TikTok's own documented base code (analytics.tiktok.com/i18n/pixel/events.js
      // loader) — ttq.page() is TikTok's PageView equivalent.
      innerHTML: `!function (w, d, t) {
w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<e.length;n++)ttq.setAndDefer(e,e[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=i+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
ttq.load('${pixelCode}');
ttq.page();
}(window, document, 'ttq');`
    }]
  }
})

// Same rationale as MetaPixelScript.vue: the base code only fires the
// initial page's view; track subsequent client-side route changes
// explicitly once ttq has loaded.
if (import.meta.client) {
  const route = useRoute()
  watch(() => route.fullPath, () => {
    const ttq = (window as unknown as { ttq?: { page?: (...args: unknown[]) => void } }).ttq
    ttq?.page?.()
  })
}
</script>

<template></template>
