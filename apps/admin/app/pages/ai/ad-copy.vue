<script setup lang="ts">
import type { MetaAdCopyResult, ProductListResponse } from '@amalice/shared'

definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager'] })
useHead({ title: 'Meta ad copy' })

const api = useAdminApi()
const { run } = useApiAction()

// Product picker source: the list endpoint pages, so this covers the first 100 products.
const { data: products } = await useAdminFetch<ProductListResponse>('/admin/products', { key: 'admin-adcopy-products', query: { page: '1', pageSize: '100' } })
const productOptions = computed(() => (products.value?.items ?? []).map((p) => ({ label: p.name, value: p.id })))

const productId = ref<string | null>(null)
const language = ref<'ar' | 'fr'>('ar')
const angleCount = ref(3)
const instructions = ref('')
const loading = ref(false)
const result = ref<MetaAdCopyResult | null>(null)

const languages = [{ label: 'العربية (Arabic)', value: 'ar' }, { label: 'Français (French)', value: 'fr' }]
const counts = [2, 3, 4, 5].map((n) => ({ label: `${n} angles`, value: n }))

async function generate() {
  if (!productId.value) return
  loading.value = true
  const res = await run(
    () => api<MetaAdCopyResult>('/admin/ai/meta-ad-copy', {
      method: 'POST',
      body: { productId: productId.value, language: language.value, angleCount: angleCount.value, ...(instructions.value.trim() && { instructions: instructions.value.trim() }) }
    }),
    { errorFallback: 'Could not write the ad copy' }
  )
  loading.value = false
  if (res) result.value = res
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    useToast().add({ title: 'Copied' })
  } catch {
    useToast().add({ title: 'Could not copy', color: 'error' })
  }
}
</script>

<template>
  <AdsPage title="Meta ad copy" description="Angles and headlines for a product, written only from its own data">
    <div class="card" style="margin-bottom: 16px">
      <div class="stack">
        <AdsField label="Product" required><AdsSelect v-model="productId" :items="productOptions" placeholder="Choose a product…" /></AdsField>
        <div style="display: flex; gap: 12px; flex-wrap: wrap">
          <AdsField label="Language"><AdsSelect v-model="language" :items="languages" /></AdsField>
          <AdsField label="How many"><AdsSelect v-model="angleCount" :items="counts" /></AdsField>
        </div>
        <AdsField label="Brief (optional)" help="Audience or tone. A discount or offer is only used if you write it here.">
          <textarea v-model="instructions" class="textarea" rows="2" maxlength="500" />
        </AdsField>
        <div><button class="btn btn-primary" type="button" :disabled="!productId || loading" @click="generate"><AdsIcon name="i-lucide-sparkles" />{{ loading ? 'Writing…' : 'Write ad copy' }}</button></div>
      </div>
    </div>

    <template v-if="result">
      <p class="muted" style="margin-bottom: 8px">
        {{ result.angles.length }} angles for <b>{{ result.productName }}</b>.
        <template v-if="result.rejected"> {{ result.rejected }} draft(s) were dropped for adding claims that are not in the product data.</template>
        Check them before publishing.
      </p>
      <div v-for="a in result.angles" :key="a.angle" class="card" style="margin-bottom: 12px">
        <div class="card-head"><h2>{{ a.angle }}</h2></div>
        <div class="stack" style="gap: 10px">
          <div>
            <span class="muted" style="font-size: 12px">Primary text</span>
            <p :dir="result.language === 'ar' ? 'rtl' : 'ltr'" style="margin: 2px 0">{{ a.primaryText }}</p>
            <button class="btn btn-sm btn-ghost" type="button" @click="copy(a.primaryText)">Copy</button>
          </div>
          <div>
            <span class="muted" style="font-size: 12px">Headlines</span>
            <div v-for="h in a.headlines" :key="h" style="display: flex; gap: 8px; align-items: center" :dir="result.language === 'ar' ? 'rtl' : 'ltr'">
              <span style="flex: 1">{{ h }}</span>
              <button class="btn btn-sm btn-ghost" type="button" @click="copy(h)">Copy</button>
            </div>
          </div>
          <div :dir="result.language === 'ar' ? 'rtl' : 'ltr'"><span class="muted" style="font-size: 12px; display: block">Description</span>{{ a.description }}</div>
        </div>
      </div>
    </template>
  </AdsPage>
</template>
