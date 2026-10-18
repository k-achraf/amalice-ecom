import {
  RAMP_STOPS,
  STORE_TEMPLATES,
  brandFontFamily,
  brandFontStylesheetUrl,
  buildColorRamp
} from '@amalice/shared'

// Turns the admin's brand identity (Settings → Brand) into head tags at SSR
// time: a primary colour ramp, the chosen font, the favicon.
//
// The CSS is deliberately UNLAYERED. Every template's palette lives inside
// `@layer template` and rtl.css inside `@layer rtl-override` (see
// assets/css/layer-order.css), and unlayered declarations beat any layered
// one regardless of specificity or load order — so this re-brands all 16
// templates without editing their CSS. Both `--color-primary-*` and
// `--ui-color-primary-*` are set because Tailwind inlines the latter into the
// generated bg-primary-* utilities (see nova.css for the long explanation).
export function useBrandHead() {
  const settings = useStoreSettings()
  // Read now: the useHead getter below re-runs outside the Nuxt context (during
  // SSR head rendering), where resolveImageUrl()'s useRuntimeConfig() would throw.
  const { apiBase } = useRuntimeConfig().public
  const absolute = (url: string | null | undefined) => (!url ? '' : /^https?:\/\//.test(url) ? url : `${apiBase}${url}`)

  useHead(() => {
    const brand = settings.value.brand
    if (!brand) return {}

    const rules: string[] = []
    if (brand.primaryColor) {
      const ramp = buildColorRamp(brand.primaryColor)
      const vars = RAMP_STOPS.map((s) => `--color-primary-${s}:${ramp[s]};--ui-color-primary-${s}:${ramp[s]};`).join('')
      rules.push(`:root,[class*='tpl-']{${vars}}`)
    }

    const link: Record<string, string>[] = []
    if (brand.fontId && brand.fontId !== 'cairo') {
      const family = brandFontFamily(brand.fontId)
      // Every template names its display face --font-<template>-display and
      // rtl.css forces it to Cairo; re-point all of them at the brand font.
      const display = STORE_TEMPLATES.map((t) => `--font-${t}-display:${family};`).join('')
      // `html body`: packages/ui ships its own unlayered `body { font-family: Inter }`
      // that loads after this tag, so equal specificity would lose to it.
      rules.push(`html body{font-family:${family};}[class*='tpl-']{${display}}`)
      const href = brandFontStylesheetUrl(brand.fontId)
      if (href) {
        link.push({ rel: 'preconnect', href: 'https://fonts.googleapis.com' })
        link.push({ rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' })
        link.push({ rel: 'stylesheet', href })
      }
    }

    const icon = absolute(brand.faviconUrl || brand.logoUrl)
    if (icon) link.push({ rel: 'icon', href: icon })

    return {
      link,
      style: rules.length ? [{ key: 'brand-identity', innerHTML: rules.join('\n') }] : []
    }
  })
}
