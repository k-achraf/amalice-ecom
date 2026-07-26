import type { AdminRoleName } from '@amalice/shared'

// Global auth gate. Every admin route except /login requires an authenticated
// session; /login is the only public route.
//
// Client-side nav hiding is UX only — the server re-checks every request via
// JwtAuthGuard + RolesGuard (plan §ADM-02). This middleware prevents a flash
// of a page the user can't actually see, nothing more.
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  // /login is the only public route.
  if (to.path === '/login') {
    if (auth.isAuthenticated) return navigateTo('/')
    return
  }

  // Per-page role gate: pages set definePageMeta({ middleware: 'role', requiredRole }).
  const required = to.meta.requiredRole as AdminRoleName | AdminRoleName[] | undefined
  if (required) {
    const allowed = Array.isArray(required) ? required : [required]
    if (!auth.role || !allowed.includes(auth.role)) {
      return navigateTo('/')
    }
  }

  if (!auth.isAuthenticated) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
