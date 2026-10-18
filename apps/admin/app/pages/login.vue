<script setup lang="ts">
const { logoSrc } = useAdminBrand()
// ADM-03 — admin login. On success, redirect to the original destination
// (preserved in the ?redirect= query by the auth middleware) or the dashboard.
definePageMeta({ layout: false })

useHead({ title: 'Sign in' })

const auth = useAuthStore()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    // CallCenterAgent has no access to the dashboard's KPI/analytics
    // endpoints (a deliberately narrower role than Support — see
    // AdminRoleNameSchema's comment) — land them on their own queue instead
    // of a dashboard that would just show empty/failed widgets.
    const defaultLanding = auth.role === 'CallCenterAgent' ? '/call-center' : '/'
    const redirect = (route.query.redirect as string) || defaultLanding
    await navigateTo(redirect)
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number; _data?: { message?: string } } }).response?.status
    error.value = status === 401 ? 'Invalid email or password.' : 'Sign-in failed. Try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="ads-root" style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px">
    <div style="width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 24px; align-items: stretch">
      <img :src="logoSrc ?? '/img/leezil-icon-teal.svg'" alt="Logo" style="max-width: 180px; max-height: 64px; width: auto; height: 56px; object-fit: contain; align-self: center">
      <section class="card" style="padding: 32px; gap: 24px">
        <div style="text-align: center">
          <h1 style="font-size: 28px; letter-spacing: -0.01em">Leezil Admin</h1>
          <p class="muted" style="margin: 6px 0 0; font-size: 14px">Sign in to the operations dashboard</p>
        </div>

        <form style="display: flex; flex-direction: column; gap: 16px" @submit.prevent="onSubmit">
          <AdsField label="Email">
            <AdsInput v-model="email" type="email" autocomplete="username" required />
          </AdsField>
          <AdsField label="Password">
            <AdsInput v-model="password" type="password" autocomplete="current-password" required />
          </AdsField>

          <p v-if="error" style="margin: 0; font-size: 13px; color: var(--danger-fg)">{{ error }}</p>

          <AdsButton appearance="primary" type="submit" block :loading="loading">Sign in</AdsButton>
        </form>
      </section>
    </div>
  </div>
</template>
