<script setup lang="ts">
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
    const redirect = (route.query.redirect as string) || '/'
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
  <div class="admin-surface flex min-h-screen items-center justify-center p-6">
    <div class="admin-kpi-card w-full max-w-sm space-y-6 p-8">
      <div class="space-y-1 text-center">
        <div class="mx-auto mb-2 flex size-10 items-center justify-center rounded-md bg-primary text-white">
          <UIcon name="i-lucide-package" class="size-5" />
        </div>
        <h1 class="text-xl font-semibold text-highlighted">Amalice Admin</h1>
        <p class="text-sm text-muted">Sign in to the operations dashboard</p>
      </div>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <UFormField label="Email">
          <UInput v-model="email" type="email" autocomplete="username" class="w-full" required />
        </UFormField>
        <UFormField label="Password">
          <UInput v-model="password" type="password" autocomplete="current-password" class="w-full" required />
        </UFormField>

        <p v-if="error" class="text-sm text-error">{{ error }}</p>

        <UButton type="submit" block :loading="loading">Sign in</UButton>
      </form>
    </div>
  </div>
</template>
