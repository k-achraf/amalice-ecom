<script setup lang="ts">
// Injects the Meta Pixel base code when the "meta-pixel" app (packages/
// shared/apps.ts) is enabled and configured with a Pixel ID. Renders no
// markup of its own — this is a head-injection side effect, mounted once
// from app.vue so it runs on every page regardless of active template.
//
// Deliberately NOT awaited (unlike the store-settings fetch in app.vue,
// which blocks SSR because layout resolution depends on it) — a third-party
// tracking script has nothing to do with first paint, so blocking on it
// would be a real regression for stores that don't use this app.
const config = useRuntimeConfig()
const { data } = useAsyncData<{ pixelId: string | null }>(
  'meta-pixel-config',
  () => $fetch('/apps/meta-pixel', { baseURL: config.public.apiBase }),
  { default: () => ({ pixelId: null }) }
)

// pixelId is validated server-side (packages/shared MetaPixelConfigSchema)
// to be digits only, so it's safe to interpolate directly into the script.
useHead(() => {
  const pixelId = data.value?.pixelId
  if (!pixelId) return {}
  return {
    script: [{
      key: 'meta-pixel',
      innerHTML: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');`
    }],
    noscript: [{
      key: 'meta-pixel-noscript',
      innerHTML: `<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1" />`
    }]
  }
})

// The base code above only fires PageView on the initial (S)SR load — Nuxt's
// client-side route changes don't reload the page, so track subsequent
// navigations explicitly once fbq has loaded. Goes through useMetaPixel's
// trackEvent (not a direct window.fbq call) so a route change that happens
// before the async pixel-config fetch above has resolved gets the same
// retry-until-loaded behavior as every other event, instead of silently
// dropping the PageView.
if (import.meta.client) {
  const route = useRoute()
  watch(() => route.fullPath, () => {
    useMetaPixel().trackEvent('PageView')
  })
}
</script>

<template></template>
