// Applies the store's brand identity to the admin (cached copy first, then the
// live public /settings). See composables/useAdminBrand.ts.
export default defineNuxtPlugin(() => {
  const { hydrateFromCache, refresh } = useAdminBrand()
  hydrateFromCache()
  refresh()
})
