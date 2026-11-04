<script setup lang="ts">
import { ALL_MCP_ABILITIES, MCP_LEVELS, MCP_LEVEL_LABELS, MCP_SECTIONS } from '@amalice/shared'
import type { CreatedMcpToken, McpAbility, McpLevel, McpTokenSummary } from '@amalice/shared'

// AI-agent tokens (MCP). Each token carries abilities "<section>:<level>"; the API checks every
// request an agent makes against them, so ticking a box here is the whole permission model.
definePageMeta({ requiredRole: 'SuperAdmin' })
useHead({ title: 'AI agents' })

const api = useAdminApi()
const toast = useToast()
const config = useRuntimeConfig()

const { data: tokens, pending, error: loadError, refresh } = await useAdminFetch<McpTokenSummary[]>('/admin/mcp-tokens', { key: 'admin-mcp-tokens' })

const mcpUrl = computed(() => (config.public as { mcpUrl?: string }).mcpUrl || 'https://mcp.yourdomain.com/mcp')

// ---- ability matrix --------------------------------------------------------
const selected = ref<Set<McpAbility>>(new Set())

const has = (s: string, l: McpLevel) => selected.value.has(`${s}:${l}` as McpAbility)
function toggle(s: string, l: McpLevel, on: boolean) {
  const next = new Set(selected.value)
  const key = `${s}:${l}` as McpAbility
  if (on) {
    next.add(key)
    // Changing or deleting something is pointless without being able to look at it.
    if (l !== 'read') next.add(`${s}:read` as McpAbility)
  } else {
    next.delete(key)
    // Taking away "view" takes the rest with it.
    if (l === 'read') {
      next.delete(`${s}:write` as McpAbility)
      next.delete(`${s}:delete` as McpAbility)
    }
  }
  selected.value = next
}
function preset(kind: 'none' | 'read' | 'all') {
  selected.value = new Set(kind === 'none' ? [] : kind === 'all' ? ALL_MCP_ABILITIES : ALL_MCP_ABILITIES.filter((a) => a.endsWith(':read')))
}
function sectionAll(s: string, on: boolean) {
  const next = new Set(selected.value)
  for (const l of MCP_LEVELS) on ? next.add(`${s}:${l}` as McpAbility) : next.delete(`${s}:${l}` as McpAbility)
  selected.value = next
}
const sectionFull = (s: string) => MCP_LEVELS.every((l) => has(s, l))
const sensitiveGranted = computed(() => MCP_SECTIONS.filter((s) => 'sensitive' in s && s.sensitive && MCP_LEVELS.some((l) => has(s.id, l))).map((s) => s.label))

// ---- create / edit ---------------------------------------------------------
const formOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const form = reactive({ name: '', expiry: 'never' as 'never' | '30' | '90' | '365' })
const EXPIRY_OPTIONS = [
  { label: 'Never expires', value: 'never' },
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
  { label: '1 year', value: '365' }
]

function openCreate() {
  editingId.value = null
  form.name = ''
  form.expiry = 'never'
  // Nothing is granted until you tick it: access is always an explicit choice.
  preset('none')
  formOpen.value = true
}
function openEdit(t: McpTokenSummary) {
  editingId.value = t.id
  form.name = t.name
  form.expiry = 'never'
  selected.value = new Set(t.abilities)
  formOpen.value = true
}

const created = ref<CreatedMcpToken | null>(null)
const createdOpen = computed({ get: () => created.value !== null, set: (v) => { if (!v) created.value = null } })

async function submit() {
  if (!form.name.trim()) return toast.add({ title: 'Give the token a name', color: 'error' })
  if (selected.value.size === 0) return toast.add({ title: 'Pick at least one ability', color: 'error' })
  saving.value = true
  try {
    const abilities = [...selected.value]
    if (editingId.value) {
      await api(`/admin/mcp-tokens/${editingId.value}`, { method: 'PATCH', body: { name: form.name.trim(), abilities } })
      toast.add({ title: 'Token updated', color: 'success' })
    } else {
      const expiresAt = form.expiry === 'never' ? null : new Date(Date.now() + Number(form.expiry) * 86_400_000).toISOString()
      created.value = await api<CreatedMcpToken>('/admin/mcp-tokens', { method: 'POST', body: { name: form.name.trim(), abilities, expiresAt } })
    }
    formOpen.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: (e as Error).message || 'Could not save the token', color: 'error' })
  } finally {
    saving.value = false
  }
}

// ---- revoke / delete -------------------------------------------------------
const confirm = ref<{ kind: 'revoke' | 'delete'; token: McpTokenSummary } | null>(null)
const confirmOpen = computed({ get: () => confirm.value !== null, set: (v) => { if (!v) confirm.value = null } })
const working = ref(false)
async function runConfirm() {
  if (!confirm.value) return
  working.value = true
  try {
    const { kind, token } = confirm.value
    if (kind === 'revoke') await api(`/admin/mcp-tokens/${token.id}/revoke`, { method: 'POST' })
    else await api(`/admin/mcp-tokens/${token.id}`, { method: 'DELETE' })
    toast.add({ title: kind === 'revoke' ? 'Token revoked' : 'Token deleted', color: 'success' })
    confirm.value = null
    await refresh()
  } catch (e) {
    toast.add({ title: (e as Error).message || 'Failed', color: 'error' })
  } finally {
    working.value = false
  }
}

// ---- display helpers -------------------------------------------------------
function status(t: McpTokenSummary): { label: string; color: string } {
  if (t.revokedAt) return { label: 'Revoked', color: 'error' }
  if (t.expiresAt && new Date(t.expiresAt).getTime() <= Date.now()) return { label: 'Expired', color: 'warning' }
  return { label: 'Active', color: 'success' }
}
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—')
function summarize(t: McpTokenSummary): string {
  const sections = new Set(t.abilities.map((a) => a.split(':')[0]))
  const can = (l: McpLevel) => t.abilities.filter((a) => a.endsWith(`:${l}`)).length
  return `${sections.size} section${sections.size === 1 ? '' : 's'} · ${can('read')} view · ${can('write')} edit · ${can('delete')} delete`
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: 'Copied', color: 'success' })
  } catch {
    toast.add({ title: 'Could not copy', color: 'error' })
  }
}
const claudeCmd = computed(() => (created.value ? `claude mcp add --transport http amalice ${mcpUrl.value} --header "Authorization: Bearer ${created.value.token}"` : ''))
const geminiJson = computed(() =>
  created.value ? JSON.stringify({ mcpServers: { amalice: { httpUrl: mcpUrl.value, headers: { Authorization: `Bearer ${created.value.token}` } } } }, null, 2) : ''
)
</script>

<template>
  <AdsPage title="AI agents" description="Let Claude, Gemini or any MCP-compatible assistant work on your store, with exactly the permissions you tick.">
    <template #actions>
      <button class="btn btn-primary" type="button" @click="openCreate">New token</button>
    </template>

    <div class="stack">
      <section class="card" aria-labelledby="how-h">
        <div class="card-head"><h2 id="how-h">How it works</h2></div>
        <p class="card-sub">
          Create a token, tick what it may do (view, create &amp; edit, delete) in each part of the site, then give it to your AI assistant together with the server address below.
          Whatever you tick, the assistant can do; everything else is refused by the server, even if the assistant tries.
        </p>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">
          <code class="muted" style="font-size: 13px">{{ mcpUrl }}</code>
          <button class="btn btn-sm" type="button" @click="copy(mcpUrl)">Copy address</button>
        </div>
      </section>

      <section class="card" aria-labelledby="tok-h">
        <div class="card-head"><h2 id="tok-h">Tokens</h2></div>
        <div v-if="pending" class="empty">Loading…</div>
        <div v-else-if="loadError" class="empty"><p style="color: var(--danger-fg)">Failed to load tokens.</p><p>{{ loadError.message }}</p></div>
        <div v-else-if="!tokens?.length" class="empty">No tokens yet. Create one to connect an AI assistant.</div>
        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Token</th><th>Access</th><th>Last used</th><th>Expires</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              <tr v-for="t in tokens" :key="t.id">
                <td><b>{{ t.name }}</b><span class="sub">by {{ t.createdByEmail ?? 'unknown' }} · {{ when(t.createdAt) }}</span></td>
                <td><code>{{ t.prefix }}…</code></td>
                <td>{{ summarize(t) }}</td>
                <td>{{ when(t.lastUsedAt) }}</td>
                <td>{{ t.expiresAt ? when(t.expiresAt) : 'Never' }}</td>
                <td><AdsBadge :color="status(t).color" :label="status(t).label" /></td>
                <td class="num">
                  <button v-if="!t.revokedAt" class="btn btn-sm" type="button" @click="openEdit(t)">Edit access</button>
                  <button v-if="!t.revokedAt" class="btn btn-sm btn-danger" type="button" @click="confirm = { kind: 'revoke', token: t }">Revoke</button>
                  <button v-else class="btn btn-sm btn-danger" type="button" @click="confirm = { kind: 'delete', token: t }">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- create / edit -->
    <AdsDialog v-model:open="formOpen" :title="editingId ? 'Edit token access' : 'New AI token'" width="lg">
      <AdsField label="Name" help="Who or what uses it, e.g. Claude (marketing).">
        <AdsInput v-model="form.name" placeholder="Claude" />
      </AdsField>
      <AdsField v-if="!editingId" label="Expires">
        <AdsSelect v-model="form.expiry" :items="EXPIRY_OPTIONS" value-key="value" />
      </AdsField>

      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 8px 0">
        <b style="margin-right: auto">What can it do?</b>
        <button class="btn btn-sm" type="button" @click="preset('read')">View everything</button>
        <button class="btn btn-sm" type="button" @click="preset('all')">Full access</button>
        <button class="btn btn-sm" type="button" @click="preset('none')">Clear</button>
      </div>

      <div class="table-wrap" style="max-height: 46vh; overflow-y: auto">
        <table>
          <thead>
            <tr><th>Section</th><th v-for="l in MCP_LEVELS" :key="l" style="text-align: center">{{ MCP_LEVEL_LABELS[l] }}</th><th style="text-align: center">All</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in MCP_SECTIONS" :key="s.id">
              <td>
                <b>{{ s.label }}</b>
                <AdsBadge v-if="'sensitive' in s && s.sensitive" color="warning" label="sensitive" style="margin-left: 6px" />
                <span class="sub">{{ s.description }}</span>
              </td>
              <td v-for="l in MCP_LEVELS" :key="l" style="text-align: center">
                <AdsCheckbox :model-value="has(s.id, l)" :aria-label="`${s.label}: ${MCP_LEVEL_LABELS[l]}`" @update:model-value="(v) => toggle(s.id, l, !!v)" />
              </td>
              <td style="text-align: center">
                <AdsCheckbox :model-value="sectionFull(s.id)" :aria-label="`${s.label}: everything`" @update:model-value="(v) => sectionAll(s.id, !!v)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AdsBanner v-if="sensitiveGranted.length" tone="warning" style="margin-top: 12px">
        This token can reach sensitive areas ({{ sensitiveGranted.join(', ') }}): money, integrations, keys or accounts. Grant them only to an assistant you trust.
      </AdsBanner>

      <template #footer>
        <button class="btn" type="button" @click="formOpen = false">Cancel</button>
        <AdsButton :loading="saving" icon="i-lucide-check" @click="submit">{{ editingId ? 'Save' : 'Create token' }}</AdsButton>
      </template>
    </AdsDialog>

    <!-- shown once -->
    <AdsDialog v-model:open="createdOpen" title="Token created" description="Copy it now. For security it is never shown again." width="lg">
      <template v-if="created">
        <AdsField label="Token">
          <div style="display: flex; gap: 8px">
            <AdsInput :model-value="created.token" readonly style="font-family: monospace" />
            <button class="btn" type="button" @click="copy(created.token)">Copy</button>
          </div>
        </AdsField>
        <AdsField label="Claude Code">
          <div style="display: flex; gap: 8px; align-items: flex-start">
            <pre style="flex: 1; margin: 0; white-space: pre-wrap; word-break: break-all; font-size: 12px">{{ claudeCmd }}</pre>
            <button class="btn btn-sm" type="button" @click="copy(claudeCmd)">Copy</button>
          </div>
        </AdsField>
        <AdsField label="Gemini CLI (~/.gemini/settings.json)">
          <div style="display: flex; gap: 8px; align-items: flex-start">
            <pre style="flex: 1; margin: 0; white-space: pre-wrap; word-break: break-all; font-size: 12px">{{ geminiJson }}</pre>
            <button class="btn btn-sm" type="button" @click="copy(geminiJson)">Copy</button>
          </div>
        </AdsField>
        <p class="muted" style="font-size: 12px">Any other MCP client: server address {{ mcpUrl }}, header <code>Authorization: Bearer &lt;token&gt;</code>.</p>
      </template>
      <template #footer><button class="btn btn-primary" type="button" @click="created = null">Done</button></template>
    </AdsDialog>

    <!-- revoke / delete -->
    <AdsDialog v-model:open="confirmOpen" :title="confirm?.kind === 'revoke' ? 'Revoke this token?' : 'Delete this token?'" width="sm"
      :description="confirm?.kind === 'revoke' ? `${confirm.token.name} stops working immediately. This cannot be undone.` : `${confirm?.token.name} is removed from the list.`">
      <template #footer>
        <button class="btn" type="button" @click="confirm = null">Cancel</button>
        <AdsButton :loading="working" @click="runConfirm">{{ confirm?.kind === 'revoke' ? 'Revoke' : 'Delete' }}</AdsButton>
      </template>
    </AdsDialog>
  </AdsPage>
</template>
