import { BrandSchema, brandFontFamily, brandFontStylesheetUrl, deriveAdminTheme, type Brand } from '@amalice/shared'

const CACHE_KEY = 'amalice-admin-brand'
const STYLE_ID = 'brand-identity'
const FONT_LINK_ID = 'brand-font'

// The store's brand identity (Settings → Brand) applied to the admin itself:
// colour tokens (--teal & friends, see deriveAdminTheme), the typeface, the
// favicon and the sidebar/login logo. The admin is a SPA behind a login, so the
// public GET /settings is fetched on boot (plugins/brand.client.ts) and the
// last value is cached in localStorage so the first paint already has it.
export function useAdminBrand() {
  const brand = useState<Brand | null>('admin-brand', () => null)

  function apply(next: Brand | null | undefined) {
    const value = next ?? null
    brand.value = value
    if (!import.meta.client) return
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)) } catch { /* private mode */ }

    document.getElementById(STYLE_ID)?.remove()
    document.getElementById(FONT_LINK_ID)?.remove()

    const rules: string[] = []
    if (value?.primaryColor) {
      const t = deriveAdminTheme(value.primaryColor)
      rules.push(`:root{--teal:${t.teal};--pine:${t.pine};--sage:${t.sage};--sage-light:${t.sageLight};--mist:${t.mist};--text-2:${t.text2};--ok-bg:${t.okBg};}`)
    }
    const fontHref = brandFontStylesheetUrl(value?.fontId)
    if (value?.fontId && fontHref) {
      rules.push(`:root{--font:${brandFontFamily(value.fontId)};}`)
      const link = document.createElement('link')
      link.id = FONT_LINK_ID
      link.rel = 'stylesheet'
      link.href = fontHref
      document.head.appendChild(link)
    }
    if (rules.length) {
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = rules.join('\n')
      document.head.appendChild(style)
    }

    const icon = value?.faviconUrl || value?.logoUrl
    const el = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (el && icon) {
      el.removeAttribute('type')
      el.href = resolveBrandUrl(icon)
    }
  }

  function resolveBrandUrl(url: string): string {
    return /^https?:\/\//.test(url) ? url : `${useRuntimeConfig().public.apiBase}${url}`
  }

  function hydrateFromCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      const parsed = raw ? BrandSchema.safeParse(JSON.parse(raw)) : null
      if (parsed?.success) apply(parsed.data)
    } catch { /* ignore */ }
  }

  async function refresh() {
    try {
      const s = await $fetch<{ brand?: Brand | null }>('/settings', { baseURL: useRuntimeConfig().public.apiBase })
      apply(s.brand ?? null)
    } catch { /* keep cached brand */ }
  }

  const logoSrc = computed(() => (brand.value?.logoUrl ? resolveBrandUrl(brand.value.logoUrl) : null))

  return { brand, logoSrc, apply, hydrateFromCache, refresh }
}
