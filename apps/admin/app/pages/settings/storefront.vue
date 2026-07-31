<script setup lang="ts">
import { STORE_TEMPLATES, TEMPLATE_META, DEFAULT_LEAD_FORM_FIELDS, type StoreTemplate, type StoreSettings, type LeadFormField } from '@amalice/shared'

definePageMeta({ requiredRole: 'SuperAdmin' })
useHead({ title: 'Storefront' })

const api = useAdminApi()
const toast = useToast()

const { data: settings, pending, error: settingsError } = await useAdminFetch<StoreSettings>('/admin/settings', { key: 'admin-settings' })

// A failed load leaves `settings` null, which makes `dirty` permanently
// false (see below) — the Apply button would otherwise just sit disabled
// forever with no indication why. Surface it instead.
watchEffect(() => {
  if (settingsError.value) {
    toast.add({ title: 'Failed to load storefront settings', description: settingsError.value.message, color: 'error' })
  }
})

// Local editable copies — apply on save, not on click.
const selectedTemplate = ref<StoreTemplate>('minimal')
const storeName = ref('')
const announcementText = ref('')
const displayCart = ref(true)
const leadFormFields = ref<LeadFormField[]>([...DEFAULT_LEAD_FORM_FIELDS])
const abandonedCartDelaySeconds = ref(60)

// Sync from server once loaded.
watchEffect(() => {
  if (settings.value) {
    selectedTemplate.value = settings.value.activeTemplate
    storeName.value = settings.value.storeName
    announcementText.value = settings.value.announcementText ?? ''
    displayCart.value = settings.value.displayCart ?? true
    leadFormFields.value = settings.value.leadFormConfig && settings.value.leadFormConfig.length > 0
      ? settings.value.leadFormConfig.map(f => ({ ...f }))
      : [...DEFAULT_LEAD_FORM_FIELDS]
    abandonedCartDelaySeconds.value = settings.value.abandonedCartDelaySeconds ?? 60
  }
})

const saving = ref(false)
const dirty = computed(() => !!settings.value && (
  selectedTemplate.value !== settings.value.activeTemplate ||
  storeName.value !== settings.value.storeName ||
  (announcementText.value || null) !== (settings.value.announcementText ?? null) ||
  displayCart.value !== (settings.value.displayCart ?? true) ||
  JSON.stringify(leadFormFields.value) !== JSON.stringify(settings.value.leadFormConfig ?? DEFAULT_LEAD_FORM_FIELDS) ||
  abandonedCartDelaySeconds.value !== (settings.value.abandonedCartDelaySeconds ?? 60)
))

async function apply() {
  if (!dirty.value) return
  saving.value = true
  try {
    const updated = await api<StoreSettings>('/admin/settings', {
      method: 'PUT',
      body: {
        activeTemplate: selectedTemplate.value,
        storeName: storeName.value,
        announcementText: announcementText.value || null,
        displayCart: displayCart.value,
        leadFormConfig: leadFormFields.value,
        abandonedCartDelaySeconds: abandonedCartDelaySeconds.value
      }
    })
    settings.value = updated
    toast.add({ title: 'Storefront updated', color: 'success' })
  } catch {
    toast.add({ title: 'Update failed', color: 'error' })
  } finally {
    saving.value = false
  }
}

// ---- Lead form field builder ----
const showFieldModal = ref(false)
const editingField = ref<LeadFormField | null>(null)

const FIELD_TYPES = [
  { label: 'Text', value: 'text' },
  { label: 'Phone', value: 'tel' },
  { label: 'Email', value: 'email' },
  { label: 'Number', value: 'number' },
  { label: 'Dropdown', value: 'select' },
  { label: 'Textarea', value: 'textarea' }
]

function openAddField() {
  editingField.value = {
    id: crypto.randomUUID(),
    key: '',
    label: '',
    type: 'text',
    placeholder: '',
    required: true,
    enabled: true,
    halfWidth: false
  }
  showFieldModal.value = true
}

function openEditField(field: LeadFormField) {
  editingField.value = { ...field }
  showFieldModal.value = true
}

function saveField() {
  if (!editingField.value || !editingField.value.key || !editingField.value.label) return
  const idx = leadFormFields.value.findIndex(f => f.id === editingField.value!.id)
  if (idx >= 0) {
    leadFormFields.value[idx] = { ...editingField.value }
  } else {
    leadFormFields.value.push({ ...editingField.value })
  }
  showFieldModal.value = false
  editingField.value = null
}

function deleteField(id: string) {
  leadFormFields.value = leadFormFields.value.filter(f => f.id !== id)
}

function moveField(idx: number, dir: 'up' | 'down') {
  const swap = dir === 'up' ? idx - 1 : idx + 1
  if (swap < 0 || swap >= leadFormFields.value.length) return
  const arr = [...leadFormFields.value]
  ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
  leadFormFields.value = arr
}

const showFieldModalBool = computed({
  get: () => showFieldModal.value,
  set: (v) => { if (!v) { showFieldModal.value = false; editingField.value = null } }
})
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Storefront">
        <template #leading><UDashboardSidebarCollapse /></template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="pending" class="py-24 text-center text-muted">Loading…</div>
      <div v-else-if="settingsError" class="py-24 text-center">
        <p class="text-error">Failed to load storefront settings.</p>
        <p class="mt-1 text-sm text-muted">{{ settingsError.message }}</p>
      </div>
      <div v-else class="max-w-4xl space-y-10">
        <!-- Template picker -->
        <section class="space-y-4">
          <div>
            <h2 class="text-lg font-semibold text-highlighted">Storefront template</h2>
            <p class="text-sm text-muted">Each template has its own visual identity — color, shadow, radius, and type, not just layout.</p>
          </div>

          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <button
              v-for="tpl in STORE_TEMPLATES"
              :key="tpl"
              type="button"
              class="admin-kpi-card group overflow-hidden text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-admin-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              :class="selectedTemplate === tpl ? 'ring-2 ring-primary' : ''"
              @click="selectedTemplate = tpl"
            >
              <!-- SVG preview mockup — a stylized representation of the template's home -->
              <div class="aspect-[4/3] overflow-hidden border-b border-[var(--color-admin-border)] bg-[var(--color-admin-bg)] p-3">
                <!-- Minimal preview: clean grid + thin header -->
                <svg v-if="tpl === 'minimal'" viewBox="0 0 200 150" class="size-full" preserveAspectRatio="xMidYMid meet">
                  <rect x="0" y="0" width="200" height="20" fill="#e5e7eb" />
                  <rect x="60" y="70" width="80" height="14" rx="2" fill="#1a1a1a" />
                  <rect x="70" y="90" width="60" height="6" rx="1" fill="#9ca3af" />
                  <rect x="75" y="108" width="50" height="14" rx="3" fill="#1a1a1a" />
                  <rect x="20" y="128" width="35" height="6" fill="#d1d5db" />
                  <rect x="83" y="128" width="35" height="6" fill="#d1d5db" />
                  <rect x="145" y="128" width="35" height="6" fill="#d1d5db" />
                </svg>
                <!-- Editorial preview: full-bleed dark hero + bold type -->
                <svg v-else-if="tpl === 'editorial'" viewBox="0 0 200 150" class="size-full" preserveAspectRatio="xMidYMid meet">
                  <rect x="0" y="0" width="200" height="95" fill="#1a1a1a" />
                  <rect x="20" y="30" width="160" height="22" rx="1" fill="#ffffff" />
                  <rect x="40" y="60" width="120" height="8" fill="#9ca3af" />
                  <rect x="70" y="76" width="60" height="10" rx="2" fill="#ffffff" />
                  <rect x="15" y="108" width="52" height="32" rx="2" fill="#d1d5db" />
                  <rect x="74" y="108" width="52" height="32" rx="2" fill="#d1d5db" />
                  <rect x="133" y="108" width="52" height="32" rx="2" fill="#d1d5db" />
                </svg>
                <!-- Boutique preview: sparse, refined, narrow -->
                <svg v-else-if="tpl === 'boutique'" viewBox="0 0 200 150" class="size-full" preserveAspectRatio="xMidYMid meet">
                  <rect x="0" y="0" width="200" height="150" fill="#ffffff" />
                  <rect x="80" y="34" width="40" height="5" fill="#9ca3af" />
                  <rect x="55" y="48" width="90" height="10" fill="#1a1a1a" />
                  <rect x="65" y="66" width="70" height="5" fill="#9ca3af" />
                  <rect x="70" y="84" width="60" height="9" fill="none" stroke="#1a1a1a" stroke-width="1" />
                  <rect x="30" y="112" width="50" height="26" fill="#e5e7eb" />
                  <rect x="120" y="112" width="50" height="26" fill="#e5e7eb" />
                </svg>
                <!-- Promify preview: glassy header + blue hero + card grid -->
                <svg v-else-if="tpl === 'promify'" viewBox="0 0 200 150" class="size-full" preserveAspectRatio="xMidYMid meet">
                  <rect x="0" y="0" width="200" height="150" fill="#f9fafb" />
                  <rect x="0" y="0" width="200" height="14" fill="#ffffff" />
                  <rect x="8" y="4" width="6" height="6" rx="1" fill="#0074c7" />
                  <circle cx="184" cy="7" r="2.5" fill="#d1d5db" />
                  <circle cx="192" cy="7" r="2.5" fill="#d1d5db" />
                  <!-- Hero band with blue gradient feel -->
                  <rect x="0" y="14" width="200" height="48" fill="#0074c7" />
                  <rect x="14" y="26" width="60" height="8" rx="1" fill="#ffffff" />
                  <rect x="14" y="40" width="80" height="4" fill="#ffffff" opacity="0.7" />
                  <rect x="14" y="50" width="28" height="6" rx="1" fill="#ffffff" />
                  <!-- Decorative circle -->
                  <circle cx="165" cy="38" r="14" fill="#ffffff" opacity="0.15" />
                  <!-- Product card grid -->
                  <rect x="14" y="76" width="40" height="44" rx="3" fill="#ffffff" stroke="#e5e7eb" />
                  <rect x="18" y="80" width="32" height="20" rx="1" fill="#bae0fd" />
                  <rect x="18" y="104" width="20" height="3" rx="1" fill="#1f2937" />
                  <rect x="18" y="110" width="12" height="3" rx="1" fill="#0074c7" />
                  <rect x="62" y="76" width="40" height="44" rx="3" fill="#ffffff" stroke="#e5e7eb" />
                  <rect x="66" y="80" width="32" height="20" rx="1" fill="#bae0fd" />
                  <rect x="66" y="104" width="20" height="3" rx="1" fill="#1f2937" />
                  <rect x="66" y="110" width="12" height="3" rx="1" fill="#0074c7" />
                  <rect x="110" y="76" width="40" height="44" rx="3" fill="#ffffff" stroke="#e5e7eb" />
                  <rect x="114" y="80" width="32" height="20" rx="1" fill="#bae0fd" />
                  <rect x="114" y="104" width="20" height="3" rx="1" fill="#1f2937" />
                  <rect x="114" y="110" width="12" height="3" rx="1" fill="#0074c7" />
                  <rect x="158" y="76" width="40" height="44" rx="3" fill="#ffffff" stroke="#e5e7eb" />
                  <rect x="162" y="80" width="32" height="20" rx="1" fill="#bae0fd" />
                  <rect x="162" y="104" width="20" height="3" rx="1" fill="#1f2937" />
                  <rect x="162" y="110" width="12" height="3" rx="1" fill="#0074c7" />
                </svg>
                <!-- Nova preview: neubrutalist — thick borders, hard offset shadow, lime accent -->
                <svg v-else-if="tpl === 'nova'" viewBox="0 0 200 150" class="size-full" preserveAspectRatio="xMidYMid meet">
                  <rect x="0" y="0" width="200" height="150" fill="#ffffff" />
                  <rect x="0" y="0" width="200" height="18" fill="#ffffff" stroke="#000000" stroke-width="2" />
                  <rect x="8" y="5" width="30" height="8" fill="#000000" />
                  <!-- Headline block with hard offset shadow -->
                  <rect x="18" y="34" width="90" height="14" fill="#000000" />
                  <rect x="14" y="30" width="90" height="14" fill="#ccff00" stroke="#000000" stroke-width="2" />
                  <rect x="14" y="52" width="70" height="6" fill="#d1d5db" />
                  <!-- CTA button with offset shadow -->
                  <rect x="18" y="68" width="46" height="16" fill="#000000" />
                  <rect x="14" y="64" width="46" height="16" fill="#ccff00" stroke="#000000" stroke-width="2" />
                  <!-- Sticker badge -->
                  <rect x="150" y="20" width="40" height="14" fill="#ff3d6e" stroke="#000000" stroke-width="2" rx="7" transform="rotate(-6 170 27)" />
                  <!-- Product card grid, hard shadows -->
                  <rect x="16" y="100" width="50" height="42" fill="#000000" />
                  <rect x="12" y="96" width="50" height="42" fill="#ffffff" stroke="#000000" stroke-width="2" />
                  <rect x="76" y="100" width="50" height="42" fill="#000000" />
                  <rect x="72" y="96" width="50" height="42" fill="#ffffff" stroke="#000000" stroke-width="2" />
                  <rect x="136" y="100" width="50" height="42" fill="#000000" />
                  <rect x="132" y="96" width="50" height="42" fill="#ffffff" stroke="#000000" stroke-width="2" />
                </svg>
                <!-- Atelier preview: velvet header/hero + rose-gold accent + rounded cards -->
                <svg v-else-if="tpl === 'atelier'" viewBox="0 0 200 150" class="size-full" preserveAspectRatio="xMidYMid meet">
                  <rect x="0" y="0" width="200" height="150" fill="#faf3ef" />
                  <!-- Velvet hero band -->
                  <rect x="0" y="0" width="200" height="66" fill="#12211c" />
                  <circle cx="170" cy="24" r="18" fill="none" stroke="#b76e79" stroke-width="1" opacity="0.5" />
                  <circle cx="170" cy="24" r="10" fill="#b76e79" opacity="0.85" />
                  <rect x="14" y="18" width="70" height="10" rx="5" fill="#faf3ef" />
                  <rect x="14" y="34" width="90" height="5" fill="#b76e79" opacity="0.7" />
                  <rect x="14" y="46" width="44" height="12" rx="6" fill="#b76e79" />
                  <!-- Rounded product cards on cream surface -->
                  <rect x="14" y="80" width="50" height="50" rx="10" fill="#12211c" />
                  <rect x="14" y="130" width="50" height="6" rx="3" fill="#e8d5cb" />
                  <rect x="74" y="80" width="50" height="50" rx="10" fill="#12211c" />
                  <rect x="74" y="130" width="50" height="6" rx="3" fill="#e8d5cb" />
                  <rect x="134" y="80" width="50" height="50" rx="10" fill="#12211c" />
                  <rect x="134" y="130" width="50" height="6" rx="3" fill="#e8d5cb" />
                </svg>
                <!-- Drop preview: black surface, red-orange accent, condensed streetwear -->
                <svg v-else-if="tpl === 'drop'" viewBox="0 0 200 150" class="size-full" preserveAspectRatio="xMidYMid meet">
                  <rect x="0" y="0" width="200" height="150" fill="#0a0a0a" />
                  <rect x="0" y="0" width="200" height="16" fill="#0a0a0a" stroke="#ff3300" stroke-width="1" />
                  <rect x="8" y="4" width="26" height="8" fill="#ffffff" />
                  <rect x="14" y="30" width="150" height="18" fill="#ffffff" />
                  <rect x="14" y="52" width="90" height="6" fill="#8a8a8a" />
                  <rect x="14" y="68" width="60" height="16" fill="#ff3300" />
                  <rect x="150" y="16" width="36" height="14" fill="#ff3300" transform="rotate(-6 168 23)" />
                  <rect x="14" y="98" width="52" height="42" fill="#171717" stroke="#ff3300" stroke-width="1" />
                  <rect x="74" y="98" width="52" height="42" fill="#171717" stroke="#ff3300" stroke-width="1" />
                  <rect x="134" y="98" width="52" height="42" fill="#171717" stroke="#ff3300" stroke-width="1" />
                </svg>
                <!-- Bloom preview: airy blush surface, pink accent, rounded pill shapes -->
                <svg v-else-if="tpl === 'bloom'" viewBox="0 0 200 150" class="size-full" preserveAspectRatio="xMidYMid meet">
                  <rect x="0" y="0" width="200" height="150" fill="#fdf3f6" />
                  <rect x="0" y="0" width="200" height="60" fill="#fbe4ec" />
                  <rect x="20" y="18" width="110" height="14" rx="7" fill="#3a2a30" />
                  <rect x="20" y="38" width="80" height="6" rx="3" fill="#c67a94" />
                  <rect x="140" y="16" width="44" height="24" rx="12" fill="#ec6f9b" />
                  <rect x="16" y="78" width="52" height="52" rx="16" fill="#ffffff" stroke="#f6c9d6" stroke-width="1" />
                  <rect x="76" y="78" width="52" height="52" rx="16" fill="#ffffff" stroke="#f6c9d6" stroke-width="1" />
                  <rect x="136" y="78" width="52" height="52" rx="16" fill="#ffffff" stroke="#f6c9d6" stroke-width="1" />
                  <rect x="24" y="138" width="30" height="6" rx="3" fill="#ec6f9b" />
                  <rect x="84" y="138" width="30" height="6" rx="3" fill="#ec6f9b" />
                  <rect x="144" y="138" width="30" height="6" rx="3" fill="#ec6f9b" />
                </svg>
                <!-- Hearth preview: sandy linen surface, terracotta + sage, framed cards -->
                <svg v-else-if="tpl === 'hearth'" viewBox="0 0 200 150" class="size-full" preserveAspectRatio="xMidYMid meet">
                  <rect x="0" y="0" width="200" height="150" fill="#f4ede3" />
                  <rect x="0" y="0" width="200" height="18" fill="#ece2d3" />
                  <rect x="8" y="5" width="30" height="8" fill="#8a5a3f" />
                  <rect x="16" y="34" width="130" height="14" rx="3" fill="#3f342a" />
                  <rect x="16" y="54" width="90" height="6" rx="2" fill="#8f7e6a" />
                  <rect x="16" y="70" width="50" height="16" rx="4" fill="#c1633d" />
                  <rect x="16" y="98" width="56" height="42" fill="#ffffff" stroke="#d8c8b3" stroke-width="3" />
                  <rect x="24" y="104" width="40" height="30" fill="#c1633d" opacity="0.8" />
                  <rect x="80" y="98" width="56" height="42" fill="#ffffff" stroke="#d8c8b3" stroke-width="3" />
                  <rect x="88" y="104" width="40" height="30" fill="#8a9a7b" opacity="0.85" />
                  <rect x="144" y="98" width="44" height="42" fill="#ffffff" stroke="#d8c8b3" stroke-width="3" />
                  <rect x="150" y="104" width="32" height="30" fill="#b89a78" opacity="0.85" />
                </svg>
                <!-- Volt preview: near-black surface, cyan accent, grid-line blueprint motif -->
                <svg v-else-if="tpl === 'volt'" viewBox="0 0 200 150" class="size-full" preserveAspectRatio="xMidYMid meet">
                  <rect x="0" y="0" width="200" height="150" fill="#050708" />
                  <line x1="0" y1="30" x2="200" y2="30" stroke="#1c2a2c" stroke-width="1" />
                  <line x1="0" y1="60" x2="200" y2="60" stroke="#1c2a2c" stroke-width="1" />
                  <line x1="50" y1="0" x2="50" y2="150" stroke="#1c2a2c" stroke-width="1" />
                  <line x1="150" y1="0" x2="150" y2="150" stroke="#1c2a2c" stroke-width="1" />
                  <rect x="14" y="14" width="60" height="7" fill="#2fe6e6" />
                  <rect x="14" y="34" width="140" height="14" rx="2" fill="#ffffff" />
                  <rect x="14" y="54" width="90" height="5" fill="#7a8a8c" />
                  <rect x="14" y="70" width="10" height="10" fill="none" stroke="#2fe6e6" stroke-width="1" />
                  <rect x="30" y="70" width="60" height="10" fill="none" stroke="#2fe6e6" stroke-width="1" />
                  <rect x="14" y="96" width="52" height="40" rx="2" fill="#0c1113" stroke="#1c2a2c" stroke-width="1" />
                  <rect x="20" y="102" width="40" height="20" fill="#12181a" />
                  <rect x="74" y="96" width="52" height="40" rx="2" fill="#0c1113" stroke="#1c2a2c" stroke-width="1" />
                  <rect x="80" y="102" width="40" height="20" fill="#12181a" />
                  <rect x="134" y="96" width="52" height="40" rx="2" fill="#0c1113" stroke="#2fe6e6" stroke-width="1" />
                  <rect x="140" y="102" width="40" height="20" fill="#12181a" />
                </svg>
                <!-- Pulse preview: white surface, gradient-mesh violet/cyan blobs, rounded-2xl -->
                <svg v-else-if="tpl === 'pulse'" viewBox="0 0 200 150" class="size-full" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <radialGradient id="pulseGrad" cx="30%" cy="20%" r="80%">
                      <stop offset="0%" stop-color="#a78bfa" stop-opacity="0.55" />
                      <stop offset="100%" stop-color="#67e8f9" stop-opacity="0" />
                    </radialGradient>
                  </defs>
                  <rect x="0" y="0" width="200" height="150" fill="#ffffff" />
                  <rect x="0" y="0" width="200" height="70" fill="url(#pulseGrad)" />
                  <rect x="16" y="20" width="130" height="14" rx="7" fill="#241b3f" />
                  <rect x="16" y="40" width="90" height="6" rx="3" fill="#8b8399" />
                  <rect x="16" y="54" width="60" height="16" rx="8" fill="#6d5ef5" />
                  <rect x="14" y="86" width="52" height="46" rx="12" fill="#ffffff" stroke="#ece9fb" stroke-width="2" />
                  <rect x="74" y="86" width="52" height="46" rx="12" fill="#ffffff" stroke="#ece9fb" stroke-width="2" />
                  <rect x="134" y="86" width="52" height="46" rx="12" fill="#ffffff" stroke="#ece9fb" stroke-width="2" />
                  <circle cx="40" cy="107" r="10" fill="#c4b8fb" />
                  <circle cx="100" cy="107" r="10" fill="#8ee3ec" />
                  <circle cx="160" cy="107" r="10" fill="#c4b8fb" />
                </svg>
                <!-- Lumière preview: stark black/white, crimson block, diagonal cut, oversized type -->
                <svg v-else-if="tpl === 'lumiere'" viewBox="0 0 200 150" class="size-full" preserveAspectRatio="xMidYMid meet">
                  <rect x="0" y="0" width="200" height="150" fill="#ffffff" />
                  <polygon points="0,0 130,0 90,150 0,150" fill="#0a0a0a" />
                  <rect x="14" y="24" width="70" height="16" fill="#ffffff" />
                  <rect x="14" y="46" width="50" height="6" fill="#c81854" />
                  <rect x="150" y="16" width="36" height="36" fill="#c81854" />
                  <rect x="110" y="70" width="76" height="8" fill="#0a0a0a" />
                  <rect x="110" y="86" width="50" height="5" fill="#8a8a8a" />
                  <rect x="14" y="100" width="70" height="34" fill="#f2f2f2" />
                  <rect x="110" y="100" width="34" height="34" fill="#0a0a0a" />
                  <rect x="150" y="100" width="34" height="34" fill="#c81854" />
                </svg>
                <!-- Trove preview: cream surface, mustard/teal duo-tone, circular crops + sharp cards -->
                <svg v-else-if="tpl === 'trove'" viewBox="0 0 200 150" class="size-full" preserveAspectRatio="xMidYMid meet">
                  <rect x="0" y="0" width="200" height="150" fill="#faf6ee" />
                  <rect x="0" y="0" width="200" height="16" fill="#f1e9d8" />
                  <rect x="8" y="4" width="28" height="8" fill="#3f3424" />
                  <rect x="16" y="32" width="120" height="14" rx="3" fill="#3f3424" />
                  <rect x="16" y="52" width="80" height="6" rx="2" fill="#8a7a5c" />
                  <circle cx="40" cy="98" r="26" fill="#d9a017" />
                  <rect x="80" y="76" width="44" height="44" fill="#ffffff" stroke="#e4d8bc" stroke-width="2" />
                  <circle cx="102" cy="98" r="14" fill="#1f6f6b" />
                  <rect x="136" y="76" width="44" height="44" rx="4" fill="#1f6f6b" />
                  <circle cx="158" cy="98" r="12" fill="#faf6ee" />
                </svg>
                <!-- Forge preview: concrete-gray surface, safety-yellow accent, hazard stripes -->
                <svg v-else-if="tpl === 'forge'" viewBox="0 0 200 150" class="size-full" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <pattern id="forgeHazard" width="12" height="12" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                      <rect width="6" height="12" fill="#171412" />
                      <rect x="6" width="6" height="12" fill="#f2a900" />
                    </pattern>
                  </defs>
                  <rect x="0" y="0" width="200" height="150" fill="#e7e5e2" />
                  <rect x="0" y="0" width="200" height="10" fill="url(#forgeHazard)" />
                  <rect x="14" y="26" width="140" height="16" fill="#232120" />
                  <rect x="14" y="48" width="90" height="6" fill="#6b6863" />
                  <rect x="14" y="64" width="56" height="16" fill="#f2a900" stroke="#232120" stroke-width="2" />
                  <rect x="14" y="96" width="52" height="42" fill="#ffffff" stroke="#232120" stroke-width="3" />
                  <rect x="74" y="96" width="52" height="42" fill="#ffffff" stroke="#232120" stroke-width="3" />
                  <rect x="134" y="96" width="52" height="42" fill="#ffffff" stroke="#232120" stroke-width="3" />
                  <rect x="134" y="96" width="52" height="8" fill="url(#forgeHazard)" />
                </svg>
                <!-- Impulse preview: funnel page — green trust band, centered headline with yellow marker, glowing orange CTA, countdown pills -->
                <svg v-else viewBox="0 0 200 150" class="size-full" preserveAspectRatio="xMidYMid meet">
                  <rect x="0" y="0" width="200" height="150" fill="#fdf9f4" />
                  <rect x="0" y="0" width="200" height="8" fill="#16a34a" />
                  <rect x="45" y="24" width="110" height="10" rx="2" fill="#1c1712" />
                  <rect x="55" y="40" width="90" height="10" rx="2" fill="#ffd43b" />
                  <rect x="62" y="42" width="76" height="6" rx="1" fill="#1c1712" />
                  <ellipse cx="100" cy="72" rx="42" ry="12" fill="#ff6a1f" opacity="0.25" />
                  <rect x="60" y="62" width="80" height="20" rx="10" fill="#ff6a1f" />
                  <rect x="70" y="69" width="60" height="6" rx="3" fill="#ffffff" opacity="0.9" />
                  <rect x="66" y="94" width="20" height="12" rx="2" fill="#1c1712" />
                  <rect x="90" y="94" width="20" height="12" rx="2" fill="#1c1712" />
                  <rect x="114" y="94" width="20" height="12" rx="2" fill="#1c1712" />
                  <rect x="20" y="118" width="76" height="22" rx="6" fill="#ffffff" stroke="#ece1d4" stroke-width="2" />
                  <rect x="104" y="118" width="76" height="22" rx="6" fill="#ffffff" stroke="#ece1d4" stroke-width="2" />
                  <rect x="26" y="124" width="34" height="10" rx="5" fill="#dcf5e5" />
                  <rect x="110" y="124" width="34" height="10" rx="5" fill="#dcf5e5" />
                </svg>
              </div>

              <div class="space-y-2 p-4">
                <div class="flex items-center justify-between">
                  <h3 class="font-semibold text-highlighted">{{ TEMPLATE_META[tpl].label }}</h3>
                  <UIcon
                    v-if="selectedTemplate === tpl"
                    name="i-lucide-circle-check-big"
                    class="size-5 text-primary"
                  />
                </div>
                <p class="text-sm text-muted">{{ TEMPLATE_META[tpl].description }}</p>
                <p class="text-xs text-muted"><span class="font-medium">Best for:</span> {{ TEMPLATE_META[tpl].bestFor }}</p>
              </div>
            </button>
          </div>
        </section>

        <!-- Store identity -->
        <section class="admin-kpi-card space-y-4 p-6">
          <h2 class="text-lg font-semibold text-highlighted">Store identity</h2>
          <UFormField label="Store name" help="Shown in the header, footer, and browser title.">
            <UInput v-model="storeName" class="w-full max-w-md" />
          </UFormField>
          <UFormField label="Announcement bar text" help="Leave empty to hide the announcement bar. Shown across all templates.">
            <UTextarea v-model="announcementText" :rows="2" class="w-full max-w-md" />
          </UFormField>
        </section>

        <!-- Abandoned carts -->
        <section class="admin-kpi-card space-y-4 p-6">
          <h2 class="text-lg font-semibold text-highlighted">Abandoned carts</h2>
          <p class="text-sm text-muted">
            On the Impulse template's lead form, if a customer types a phone number and then goes idle without
            submitting, an order is created automatically and marked abandoned — visible on the
            <NuxtLink to="/abandoned-carts" class="text-primary hover:underline">Abandoned Carts</NuxtLink> page for
            follow-up.
          </p>
          <UFormField label="Idle delay before creating the abandoned order" help="10–3600 seconds.">
            <UInputNumber v-model="abandonedCartDelaySeconds" :min="10" :max="3600" class="w-40" />
          </UFormField>
        </section>

        <!-- Checkout behavior -->
        <section class="admin-kpi-card space-y-4 p-6">
          <h2 class="text-lg font-semibold text-highlighted">Checkout behavior</h2>
          <div class="flex items-center justify-between rounded-lg border border-[var(--color-admin-border)] p-4">
            <div>
              <p class="font-medium text-highlighted">Cart-based checkout</p>
              <p class="text-sm text-muted">
                {{ displayCart
                  ? 'Customers add products to a cart, then check out with phone + address — a call-center agent confirms the order after.'
                  : 'No cart — customers fill a lead form directly on the product page (phone + address + quantity); a call-center agent confirms after.' }}
              </p>
            </div>
            <USwitch v-model="displayCart" />
          </div>
        </section>

        <!-- Lead form field builder (only when displayCart is off) -->
        <section v-if="!displayCart" class="admin-kpi-card space-y-4 p-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-highlighted">Lead form fields</h2>
            <UButton icon="i-lucide-plus" size="xs" color="primary" label="Add field" @click="openAddField" />
          </div>
          <p class="text-sm text-muted">Configure the fields customers fill on the product page. Drag or reorder with arrows. Toggle to enable/disable. Core fields (name, phone) can't be deleted.</p>

          <div class="space-y-2">
            <div
              v-for="(field, idx) in leadFormFields"
              :key="field.id"
              class="flex items-center gap-3 rounded-lg border border-[var(--color-admin-border)] bg-[var(--color-admin-bg)] p-3"
              :class="field.enabled === false ? 'opacity-50' : ''"
            >
              <div class="flex flex-col gap-0.5">
                <UButton icon="i-lucide-chevron-up" size="xs" variant="ghost" color="neutral" :disabled="idx === 0" @click="moveField(idx, 'up')" />
                <UButton icon="i-lucide-chevron-down" size="xs" variant="ghost" color="neutral" :disabled="idx === leadFormFields.length - 1" @click="moveField(idx, 'down')" />
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-highlighted">{{ field.label }}</span>
                  <UBadge size="sm" color="neutral" variant="subtle">{{ field.type }}</UBadge>
                  <UBadge v-if="field.required" size="sm" color="warning" variant="subtle">Required</UBadge>
                  <UBadge v-if="field.isCore" size="sm" color="info" variant="subtle">Core</UBadge>
                </div>
                <p class="text-xs text-muted">Key: <code>{{ field.key }}</code>{{ field.placeholder ? ` · Placeholder: "${field.placeholder}"` : '' }}</p>
              </div>
              <USwitch v-model="field.enabled" />
              <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" @click="openEditField(field)" />
              <UButton v-if="!field.isCore" icon="i-lucide-trash-2" size="xs" variant="ghost" color="error" @click="deleteField(field.id)" />
            </div>
          </div>
        </section>

        <!-- Apply bar -->
        <div class="sticky bottom-4 flex items-center justify-between rounded-md border border-[var(--color-admin-border)] bg-[var(--color-admin-surface)] px-5 py-3 shadow-[var(--shadow-admin-md)]">
          <p class="text-sm" :class="dirty ? 'text-highlighted' : 'text-muted'">
            {{ dirty ? 'Unsaved changes — the storefront updates on the next visitor load.' : 'All changes saved.' }}
          </p>
          <UButton :loading="saving" :disabled="!dirty" color="primary" icon="i-lucide-check" @click="apply">Apply changes</UButton>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- Field editor modal -->
  <UModal v-model:open="showFieldModalBool">
    <template #content>
      <div v-if="editingField" class="w-full max-w-md space-y-4 p-6">
        <h3 class="text-lg font-semibold">{{ editingField.isCore ? 'Edit' : 'New' }} field</h3>
        <UFormField label="Label" hint="Shown above the input">
          <UInput v-model="editingField.label" placeholder="Full name" class="w-full" />
        </UFormField>
        <UFormField label="Key" hint="The data key sent to the server (lowercase, no spaces)">
          <UInput v-model="editingField.key" placeholder="fullName" class="w-full" :disabled="editingField.isCore" />
        </UFormField>
        <UFormField label="Type">
          <USelect v-model="editingField.type" :items="FIELD_TYPES" class="w-full" :disabled="editingField.isCore" />
        </UFormField>
        <UFormField label="Placeholder (optional)">
          <UInput v-model="editingField.placeholder" placeholder="Enter your…" class="w-full" />
        </UFormField>
        <p v-if="['wilaya', 'commune'].includes(editingField.key)" class="text-xs text-muted">
          Options for this field come from the Algeria wilaya/commune dataset, not a manual list — commune choices follow whichever wilaya the customer picks.
        </p>
        <div v-else-if="editingField.type === 'select'" class="space-y-2">
          <UFormField label="Options (comma-separated)">
            <UInput
              :model-value="(editingField.options ?? []).join(', ')"
              placeholder="Option 1, Option 2, Option 3"
              class="w-full"
              @update:model-value="(v: string) => editingField!.options = v.split(',').map(s => s.trim()).filter(Boolean)"
            />
          </UFormField>
        </div>
        <div class="flex items-center gap-4">
          <UCheckbox v-model="editingField.required" label="Required" />
          <UCheckbox v-model="editingField.halfWidth" label="Half width" />
        </div>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" label="Cancel" @click="showFieldModalBool = false" />
          <UButton :disabled="!editingField.key || !editingField.label" label="Save field" color="primary" @click="saveField" />
        </div>
      </div>
    </template>
  </UModal>
</template>
