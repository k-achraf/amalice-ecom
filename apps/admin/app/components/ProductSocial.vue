<script setup lang="ts">
import type { SocialCaption, SocialPostView, SocialStatus } from '@amalice/shared'

// Product editor → Social tab: connect the store's Facebook Pages / Instagram
// accounts once (paste a Meta token), then post the product to any of them.
const props = defineProps<{ productId: string }>()

const api = useAdminApi()
const { run } = useApiAction()

const status = ref<SocialStatus | null>(null)
const posts = ref<SocialPostView[]>([])
const message = ref('')
const language = ref<'ar' | 'fr'>('ar')
const hasImage = ref(true)
const selected = ref<string[]>([])
const token = ref('')
const connecting = ref(false)
const publishing = ref(false)
const loaded = ref(false)

async function load() {
  const [s, p] = await Promise.all([
    api<SocialStatus>('/admin/social/status'),
    api<SocialPostView[]>(`/admin/social/products/${props.productId}/posts`)
  ])
  status.value = s
  posts.value = p
  if (!selected.value.length) selected.value = s.accounts.filter((a) => a.status === 'Active').map((a) => a.id)
  await loadCaption()
  loaded.value = true
}

async function loadCaption() {
  const c = await api<SocialCaption>(`/admin/social/products/${props.productId}/caption`, { query: { language: language.value } })
  message.value = c.message
  hasImage.value = c.hasImage
}

async function connect() {
  connecting.value = true
  const res = await run(() => api<SocialStatus>('/admin/social/connect', { method: 'POST', body: { accessToken: token.value } }), {
    success: 'Pages connected',
    errorFallback: 'Could not connect'
  })
  connecting.value = false
  if (res) {
    status.value = res
    token.value = ''
    selected.value = res.accounts.filter((a) => a.status === 'Active').map((a) => a.id)
  }
}

async function disconnect(id: string) {
  await run(() => api(`/admin/social/accounts/${id}`, { method: 'DELETE' }), { success: 'Page removed' })
  selected.value = selected.value.filter((x) => x !== id)
  status.value = await api<SocialStatus>('/admin/social/status')
}

async function publish() {
  publishing.value = true
  const res = await run(
    () => api<{ posts: SocialPostView[] }>(`/admin/social/products/${props.productId}/publish`, { method: 'POST', body: { accountIds: selected.value, message: message.value } }),
    { errorFallback: 'Could not publish' }
  )
  publishing.value = false
  if (!res) return
  const failed = res.posts.filter((p) => p.status === 'Failed').length
  const toast = useToast()
  toast.add({ title: failed ? `${res.posts.length - failed} published, ${failed} failed` : 'Published', color: failed ? 'error' : 'success' })
  posts.value = await api<SocialPostView[]>(`/admin/social/products/${props.productId}/posts`)
  status.value = await api<SocialStatus>('/admin/social/status')
}

function toggle(id: string) {
  selected.value = selected.value.includes(id) ? selected.value.filter((x) => x !== id) : [...selected.value, id]
}

const noImageForInstagram = computed(() => !hasImage.value && (status.value?.accounts ?? []).some((a) => a.platform === 'Instagram' && selected.value.includes(a.id)))

onMounted(load)
</script>

<template>
  <div class="stack">
    <div v-if="!loaded" class="empty">Loading…</div>
    <template v-else>
      <div class="card">
        <h2>Publish to social media</h2>
        <p v-if="!status?.accounts.length" class="muted">No page connected yet. Paste a Meta access token below to link your Facebook Pages and Instagram accounts.</p>
        <template v-else>
          <div class="stack" style="gap: 8px">
            <label v-for="a in status.accounts" :key="a.id" style="display: flex; align-items: center; gap: 10px">
              <input type="checkbox" :checked="selected.includes(a.id)" :disabled="a.status === 'Expired'" @change="toggle(a.id)">
              <AdsIcon :name="a.platform === 'Facebook' ? 'i-lucide-facebook' : 'i-lucide-instagram'" />
              <span class="grow"><b>{{ a.name }}</b> <span class="muted">{{ a.platform }}<template v-if="a.handle"> · @{{ a.handle }}</template></span></span>
              <span v-if="a.status === 'Expired'" class="pill neutral">Reconnect</span>
              <button type="button" class="btn btn-sm" @click="disconnect(a.id)"><AdsIcon name="i-lucide-trash-2" /></button>
            </label>
          </div>

          <AdsField label="Caption language">
            <AdsSelect v-model="language" :items="[{ label: 'العربية', value: 'ar' }, { label: 'Français', value: 'fr' }]" class="w-full" @update:model-value="loadCaption" />
          </AdsField>
          <AdsField label="Caption" help="Generated from the product's name, description, benefits, price and link. Edit freely before publishing.">
            <AdsTextarea v-model="message" :rows="9" class="w-full" />
          </AdsField>
          <p v-if="noImageForInstagram" class="muted">Instagram needs a product image — add one in the Images tab.</p>
          <div class="flex justify-end">
            <AdsButton :loading="publishing" :disabled="!selected.length || !message.trim()" icon="i-lucide-send" color="primary" @click="publish">Publish now</AdsButton>
          </div>
        </template>
      </div>

      <div v-if="posts.length" class="card">
        <h2>History</h2>
        <div v-for="p in posts" :key="p.id" style="display: flex; gap: 10px; align-items: center; padding: 6px 0">
          <span class="pill" :class="p.status === 'Published' ? 'installed' : 'neutral'">{{ p.status }}</span>
          <span class="grow">{{ p.platform }} · {{ p.accountName }}<template v-if="p.error"> — <span class="muted">{{ p.error }}</span></template></span>
          <a v-if="p.externalUrl" :href="p.externalUrl" target="_blank" rel="noopener">View</a>
          <span class="muted">{{ new Date(p.createdAt).toLocaleString() }}</span>
        </div>
      </div>

      <div class="card">
        <h2>{{ status?.accounts.length ? 'Reconnect or add pages' : 'Connect your pages' }}</h2>
        <p class="muted">
          Paste a Meta access token (Graph API Explorer user token, or a Business Manager system-user token) with the permissions
          <code>pages_show_list</code>, <code>pages_manage_posts</code>, <code>pages_read_engagement</code> and, for Instagram,
          <code>instagram_basic</code> + <code>instagram_content_publish</code>. Every Page it manages (and its linked Instagram business account) is added. The token is stored encrypted and never shown again.
        </p>
        <AdsField label="Access token"><AdsInput v-model="token" type="password" autocomplete="off" class="w-full" /></AdsField>
        <div class="flex justify-end">
          <AdsButton :loading="connecting" :disabled="token.trim().length < 20" icon="i-lucide-link" color="primary" @click="connect">Connect</AdsButton>
        </div>
      </div>
    </template>
  </div>
</template>
