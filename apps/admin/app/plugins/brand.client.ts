// Applies the store's brand identity to the admin (cached copy first, then the
// live public /settings). See composables/useAdminBrand.ts.
export default defineNuxtPlugin(() => {
  const { hydrateFromCache, refresh, adminTitle } = useAdminBrand()
  hydrateFromCache()
  refresh()
  // Overrides nuxt.config's fixed "%s — Leezil Admin" with the store's own name.
  useHead({ titleTemplate: (title) => (title ? `${title} — ${adminTitle.value}` : adminTitle.value) })
})
