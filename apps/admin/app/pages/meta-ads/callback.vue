<script setup lang="ts">
definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })
useHead({ title: 'Connecting Meta…' })

// Landing page of the Meta login (the redirect URI): checks the CSRF `state`,
// hands the one-time `code` to the API (which exchanges it for a token and
// loads the ad accounts), then returns to the connection page.
const route = useRoute()
const api = useAdminApi()
const { init } = useMetaAds()
const error = ref<string | null>(null)

onMounted(async () => {
  const { code, state, error: metaError, error_description: description } = route.query as Record<string, string | undefined>
  const expected = sessionStorage.getItem('meta.oauth.state')
  sessionStorage.removeItem('meta.oauth.state')

  if (metaError) {
    error.value = description || 'Meta login was cancelled.'
    return
  }
  if (!code || !state || !expected || state !== expected) {
    error.value = 'This login link is invalid or expired. Start the connection again.'
    return
  }
  try {
    await api('/admin/meta-ads/connect', { method: 'POST', body: { code, redirectUri: `${window.location.origin}/meta-ads/callback` } })
    await init()
    await navigateTo('/meta-ads/accounts', { replace: true })
  } catch (err) {
    error.value = errorMessage(err, 'Could not connect your Meta account.')
  }
})
</script>

<template>
  <AdsPage title="Connecting Meta" description="Meta Ads">
    <AdsEmptyState v-if="error" icon="i-lucide-alert-triangle" title="Connection failed" :description="error">
      <NuxtLink to="/meta-ads/accounts" class="btn" style="margin-top: 8px">Back to connection</NuxtLink>
    </AdsEmptyState>
    <div v-else class="empty">Connecting your Meta account…</div>
  </AdsPage>
</template>
