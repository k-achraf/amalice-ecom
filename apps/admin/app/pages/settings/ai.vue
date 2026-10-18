<script setup lang="ts">
import { AI_PROVIDERS, type AiProviderId, type AiProviderModelsResult, type AiSettingsView, type AiTier, type AiTierTestResult } from '@amalice/shared'

definePageMeta({ requiredRole: 'SuperAdmin' })
useHead({ title: 'AI models' })

const api = useAdminApi()
const { run } = useApiAction()

const { data: settings, pending, error: loadError } = await useAdminFetch<AiSettingsView>('/admin/ai/settings', { key: 'admin-ai-settings' })

const TIERS: { id: AiTier; title: string; hint: string }[] = [
  { id: 'fast', title: 'Fast model', hint: 'Address suggestions and the daily-report insight: short, cheap answers.' },
  { id: 'smart', title: 'Smart model', hint: 'The AI assistant. It must support tool (function) calling.' },
  { id: 'fallback', title: 'Fallback model', hint: 'Used automatically when the model above fails (quota used up, outage, bad key). Optional.' }
]

// ---- the tier form: which provider + model serves each tier -----------------
const form = reactive<Record<AiTier, { provider: string; model: string }>>({
  fast: { provider: '', model: '' },
  smart: { provider: '', model: '' },
  fallback: { provider: '', model: '' }
})
const dailyLimit = ref<string | number>('')

function hydrate(view: AiSettingsView) {
  for (const t of TIERS) {
    form[t.id].provider = view[t.id]?.provider ?? ''
    form[t.id].model = view[t.id]?.model ?? ''
  }
  dailyLimit.value = view.dailyCallLimit ?? ''
}
if (settings.value) hydrate(settings.value)

function formPayload() {
  const tier = (id: AiTier) => (form[id].provider ? { provider: form[id].provider as AiProviderId, model: form[id].model.trim() } : null)
  return { fast: tier('fast'), smart: tier('smart'), fallback: tier('fallback'), dailyCallLimit: dailyLimit.value === '' ? null : Math.max(0, Math.round(Number(dailyLimit.value))) }
}
const savedPayload = computed(() => {
  const s = settings.value
  return { fast: s?.fast ?? null, smart: s?.smart ?? null, fallback: s?.fallback ?? null, dailyCallLimit: s?.dailyCallLimit ?? null }
})
// Tests run against what is SAVED, so they are only offered when the form matches it.
const dirty = computed(() => JSON.stringify(formPayload()) !== JSON.stringify(savedPayload.value))

const providers = computed(() => settings.value?.providers ?? [])
const withKey = computed(() => providers.value.filter((p) => p.hasKey))
const providerOptions = (tier: AiTier) => [{ label: tier === 'fallback' ? 'None' : 'Default', value: '' }, ...withKey.value.map((p) => ({ label: p.label, value: p.id }))]

// ---- provider keys + live model lists ---------------------------------------
const keyInputs = reactive<Record<string, string>>({})
const busyKey = ref<string | null>(null)
const models = reactive<Record<string, (AiProviderModelsResult & { loading: boolean }) | undefined>>({})

// A key change affects which providers are usable; unsaved model choices are left alone.
function mergeProviders(view: AiSettingsView) {
  settings.value = settings.value ? { ...settings.value, providers: view.providers, effective: view.effective } : view
}

async function loadModels(id: AiProviderId) {
  models[id] = { ok: false, models: [], error: null, loading: true }
  const result = await run(() => api<AiProviderModelsResult>(`/admin/ai/providers/${id}/models`), { errorFallback: 'Could not reach the provider' })
  models[id] = { ...(result ?? { ok: false, models: [], error: 'Could not reach the provider.' }), loading: false }
}

async function saveKey(id: AiProviderId) {
  const apiKey = (keyInputs[id] ?? '').trim()
  if (apiKey.length < 8) return
  busyKey.value = id
  const view = await run(() => api<AiSettingsView>(`/admin/ai/providers/${id}/key`, { method: 'PUT', body: { apiKey } }), { success: 'Key saved', errorFallback: 'Could not save the key' })
  busyKey.value = null
  if (!view) return
  keyInputs[id] = ''
  mergeProviders(view)
  await loadModels(id) // verifies the key right away
}

async function removeKey(id: AiProviderId) {
  if (!window.confirm(`Remove the saved ${AI_PROVIDERS[id].label} key?`)) return
  busyKey.value = id
  const view = await run(() => api<AiSettingsView>(`/admin/ai/providers/${id}/key`, { method: 'DELETE' }), { success: 'Key removed', errorFallback: 'Could not remove the key' })
  busyKey.value = null
  if (!view) return
  models[id] = undefined
  mergeProviders(view)
}

async function onProviderChange(tier: AiTier, value: unknown) {
  const id = value ? (String(value) as AiProviderId) : ''
  form[tier].provider = id
  // Start from the provider's suggested model; the owner can change it.
  form[tier].model = id ? AI_PROVIDERS[id].suggested[tier === 'fast' ? 'fast' : 'smart'] : ''
  if (id && !models[id]) await loadModels(id)
}

const modelChoices = (tier: AiTier): string[] => {
  const id = form[tier].provider as AiProviderId | ''
  return id ? (models[id]?.models ?? []) : []
}

// ---- save / test ---------------------------------------------------------------
const saving = ref(false)
async function save() {
  const payload = formPayload()
  for (const t of TIERS) {
    if (form[t.id].provider && !form[t.id].model.trim()) {
      useToast().add({ title: `Choose a model for the ${t.title.toLowerCase()}`, color: 'error' })
      return
    }
  }
  saving.value = true
  const view = await run(() => api<AiSettingsView>('/admin/ai/settings', { method: 'PUT', body: payload }), { success: 'AI settings saved', errorFallback: 'Could not save the settings' })
  saving.value = false
  if (!view) return
  settings.value = view
  hydrate(view)
}

const tests = reactive<Record<string, AiTierTestResult | 'loading' | undefined>>({})
async function testTier(tier: AiTier) {
  tests[tier] = 'loading'
  const result = await run(() => api<AiTierTestResult>('/admin/ai/test', { method: 'POST', body: { tier } }), { errorFallback: 'The test could not run' })
  tests[tier] = result
  loadUsage()
}

// ---- today's usage ---------------------------------------------------------------
const usage = ref<{ calls: number; tokens: number } | null>(null)
async function loadUsage() {
  try {
    usage.value = (await api<{ calls: number; tokens: number }[]>('/admin/ai/usage'))[0] ?? null
  } catch {
    usage.value = null
  }
}
onMounted(loadUsage)
</script>

<template>
  <AdsPage title="AI models" description="Add an API key for the AI services you want, then choose which model does what.">
    <template #actions>
      <button class="btn btn-primary" type="button" :disabled="saving || !dirty" @click="save">{{ saving ? 'Saving…' : 'Save' }}</button>
    </template>

    <div v-if="pending" class="empty">Loading…</div>
    <div v-else-if="loadError" class="empty"><p style="color: var(--danger-fg)">Failed to load the AI settings.</p><p>{{ loadError.message }}</p></div>
    <div v-else-if="settings" class="stack">
      <!-- 1. Providers and their keys -->
      <section class="card" aria-labelledby="prov-h">
        <div class="card-head"><h2 id="prov-h">AI services</h2></div>
        <p class="card-sub">Keys are stored encrypted and are never shown again. Free plans have limits that differ per provider and change over time: check the provider's console for the current ones.</p>

        <div v-for="p in providers" :key="p.id" style="border-top: 1px solid var(--line, #e5e2d8); padding: 14px 0">
          <div style="display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: baseline">
            <b>{{ p.label }}</b>
            <span class="muted" style="font-size: 13px">
              <template v-if="p.keySource === 'settings'">Key saved (…{{ p.keyHint }})</template>
              <template v-else-if="p.keySource === 'env'">Using the server's GEMINI_API_KEY</template>
              <template v-else>No key</template>
            </span>
          </div>
          <p class="muted" style="margin: 4px 0 8px; font-size: 13px">{{ p.note }} <a :href="p.keyUrl" target="_blank" rel="noopener noreferrer">Get a key</a></p>

          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center">
            <div style="flex: 1; min-width: 220px">
              <AdsInput v-model="keyInputs[p.id]" type="password" autocomplete="off" :placeholder="p.keySource === 'settings' ? 'Paste a new key to replace it' : 'Paste the API key'" />
            </div>
            <button class="btn btn-primary" type="button" :disabled="busyKey === p.id || (keyInputs[p.id] ?? '').trim().length < 8" @click="saveKey(p.id)">{{ busyKey === p.id ? 'Saving…' : 'Save key' }}</button>
            <button v-if="p.hasKey" class="btn" type="button" :disabled="models[p.id]?.loading" @click="loadModels(p.id)">{{ models[p.id]?.loading ? 'Testing…' : 'Test connection' }}</button>
            <button v-if="p.keySource === 'settings'" class="btn btn-ghost" type="button" :disabled="busyKey === p.id" @click="removeKey(p.id)">Remove</button>
          </div>

          <p v-if="models[p.id] && !models[p.id]!.loading" style="margin: 8px 0 0; font-size: 13px" :style="{ color: models[p.id]!.ok ? 'var(--teal)' : 'var(--danger-fg)' }">
            <template v-if="models[p.id]!.ok">Connected: {{ models[p.id]!.models.length }} models available.</template>
            <template v-else>{{ models[p.id]!.error }}</template>
          </p>
        </div>
      </section>

      <!-- 2. Which model serves which tier -->
      <section class="card" aria-labelledby="tier-h">
        <div class="card-head"><h2 id="tier-h">Models</h2></div>
        <p class="card-sub">
          Only services with a key can be chosen. "Default" uses Gemini with the server's key.
          <template v-if="settings.effective.fast || settings.effective.smart">
            Right now: fast = {{ settings.effective.fast ? `${AI_PROVIDERS[settings.effective.fast.provider].label} / ${settings.effective.fast.model}` : 'nothing configured' }},
            smart = {{ settings.effective.smart ? `${AI_PROVIDERS[settings.effective.smart.provider].label} / ${settings.effective.smart.model}` : 'nothing configured' }}.
          </template>
          <template v-else>Nothing is configured yet: add a key above.</template>
        </p>

        <div v-for="t in TIERS" :key="t.id" style="border-top: 1px solid var(--line, #e5e2d8); padding: 14px 0">
          <b>{{ t.title }}</b>
          <p class="muted" style="margin: 2px 0 8px; font-size: 13px">{{ t.hint }}</p>
          <div class="grid-2">
            <AdsField label="Service">
              <AdsSelect :model-value="form[t.id].provider" :options="providerOptions(t.id)" @update:model-value="(v) => onProviderChange(t.id, v)" />
            </AdsField>
            <AdsField label="Model" :help="form[t.id].provider ? (models[form[t.id].provider]?.ok ? 'Pick from the list or type a model id.' : 'Type a model id (use Test connection above to load the list).') : undefined">
              <AdsInput v-model="form[t.id].model" :list="`models-${t.id}`" :disabled="!form[t.id].provider" placeholder="Model id" autocomplete="off" />
              <datalist :id="`models-${t.id}`"><option v-for="m in modelChoices(t.id)" :key="m" :value="m" /></datalist>
            </AdsField>
          </div>
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap">
            <button class="btn btn-sm" type="button" :disabled="dirty || tests[t.id] === 'loading'" :title="dirty ? 'Save your changes first: the test runs against the saved settings' : undefined" @click="testTier(t.id)">{{ tests[t.id] === 'loading' ? 'Testing…' : 'Test' }}</button>
            <span v-if="dirty" class="muted" style="font-size: 12px">Save first to test.</span>
            <span v-else-if="tests[t.id] && tests[t.id] !== 'loading'" style="font-size: 13px" :style="{ color: (tests[t.id] as AiTierTestResult).ok ? 'var(--teal)' : 'var(--danger-fg)' }">
              <template v-if="(tests[t.id] as AiTierTestResult).ok">Works: {{ (tests[t.id] as AiTierTestResult).provider }} / {{ (tests[t.id] as AiTierTestResult).model }} answered in {{ (tests[t.id] as AiTierTestResult).ms }} ms.</template>
              <template v-else>{{ (tests[t.id] as AiTierTestResult).error }}</template>
            </span>
          </div>
        </div>
      </section>

      <!-- 3. Daily cap -->
      <section class="card" aria-labelledby="cap-h">
        <div class="card-head"><h2 id="cap-h">Daily limit</h2></div>
        <p class="card-sub">Stops AI features for the rest of the day after this many model requests (the assistant uses 2-3 per question). Leave blank to use the server default ({{ settings.effectiveDailyCallLimit === 0 ? 'no limit' : settings.effectiveDailyCallLimit }}); 0 means no limit.</p>
        <div style="max-width: 240px"><AdsField label="Requests per day"><AdsInput v-model="dailyLimit" type="number" min="0" placeholder="Server default" /></AdsField></div>
        <p v-if="usage" class="muted" style="font-size: 13px">Today: {{ usage.calls }} requests, {{ usage.tokens.toLocaleString('en-US') }} tokens.</p>
      </section>
    </div>
  </AdsPage>
</template>
