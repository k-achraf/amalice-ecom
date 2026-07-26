// Hydrates the auth store from localStorage before the first route renders.
// Client-only (admin is SPA anyway) — mirrors the storefront's cart-hydrate pattern.
export default defineNuxtPlugin(() => {
  const auth = useAuthStore()
  auth.hydrate()
})
