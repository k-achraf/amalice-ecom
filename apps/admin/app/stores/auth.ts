import { defineStore } from 'pinia'
import type { AdminRoleName } from '@amalice/shared'

// ADM-03 — admin auth state. The JWT (access token) persists in localStorage
// so a reload keeps the session; the role drives client-side nav filtering
// (the real gate is server-side RBAC — plan §ADM-02). Refresh-token rotation
// / proactive refresh before the 15m access-token expiry is a refinement;
// today a 401 clears the session and bounces to /login (graceful, per ADM-03).
//
// Note: this is a back-office tool for a handful of staff, not a public app —
// storing the access token in localStorage is acceptable here (unlike the
// customer storefront, where there's no persisted session at all).

export interface AdminUser {
  id: string
  email: string
  role: AdminRoleName
}

const TOKEN_KEY = 'amalice.admin.token'
const USER_KEY = 'amalice.admin.user'

export const useAuthStore = defineStore('admin-auth', {
  state: () => ({
    token: '' as string,
    user: null as AdminUser | null,
    hydrated: false
  }),
  getters: {
    isAuthenticated: (s) => !!s.token && !!s.user,
    role: (s) => s.user?.role ?? null
  },
  actions: {
    // localStorage is client-only; hydrate once on mount (the plugin does this).
    hydrate() {
      if (this.hydrated || !import.meta.client) return
      this.hydrated = true
      this.token = localStorage.getItem(TOKEN_KEY) ?? ''
      const userRaw = localStorage.getItem(USER_KEY)
      this.user = userRaw ? (JSON.parse(userRaw) as AdminUser) : null
    },
    setSession(token: string, user: AdminUser) {
      this.token = token
      this.user = user
      if (import.meta.client) {
        localStorage.setItem(TOKEN_KEY, token)
        localStorage.setItem(USER_KEY, JSON.stringify(user))
      }
    },
    clear() {
      this.token = ''
      this.user = null
      if (import.meta.client) {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      }
    },
    async login(email: string, password: string) {
      const config = useRuntimeConfig()
      const res = await $fetch<{ accessToken: string; refreshToken: string }>(
        '/auth/admin/login',
        { baseURL: config.public.apiBase, method: 'POST', body: { email, password } }
      )
      // Decode the JWT payload to get id/email/role without an extra /me round
      // trip. The token is verified server-side on every request regardless.
      const part = res.accessToken.split('.')[1]
      const payload = JSON.parse(atob(part ?? '')) as {
        sub: string
        email: string
        role: AdminRoleName
      }
      this.setSession(res.accessToken, { id: payload.sub, email: payload.email, role: payload.role })
      return res
    }
  }
})
