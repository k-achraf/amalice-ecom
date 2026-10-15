<script setup lang="ts">
import type { AdminUser } from '@amalice/shared'

definePageMeta({ requiredRole: 'SuperAdmin' })
useHead({ title: 'Users & Roles' })

const api = useAdminApi()
const { run } = useApiAction()
const { data: users, pending, refresh } = await useAdminFetch<AdminUser[]>('/admin/users', { key: 'admin-users' })
const { data: roles } = await useAdminFetch<{ id: string; name: string }[]>('/admin/roles', { key: 'admin-roles' })

const showCreate = ref(false)
const newEmail = ref('')
const newPassword = ref('')
const newRoleId = ref('')
const saving = ref(false)

async function createUser() {
  if (!newEmail.value || !newPassword.value || !newRoleId.value) return
  saving.value = true
  const result = await run(
    () => api('/admin/users', { method: 'POST', body: { email: newEmail.value, password: newPassword.value, roleId: newRoleId.value } }),
    { success: 'Admin user created', errorFallback: 'Could not create the user' }
  )
  if (result !== undefined) {
    showCreate.value = false
    newEmail.value = ''
    newPassword.value = ''
  }
  await refresh()
  saving.value = false
}

const { confirmDelete } = useDangerDelete()
async function deleteUser(user: AdminUser) {
  if (!confirmDelete(`Permanently delete the admin account ${user.email}?`)) return
  await run(() => api(`/admin/users/${user.id}`, { method: 'DELETE' }), { success: 'User deleted', errorFallback: 'Could not delete the user' })
  await refresh()
}

async function toggle(user: AdminUser) {
  await run(() => api(`/admin/users/${user.id}/${user.active ? 'deactivate' : 'reactivate'}`, { method: 'POST' }), {
    success: user.active ? 'User deactivated' : 'User reactivated',
    errorFallback: 'Could not update the user'
  })
  await refresh()
}

// ---- Design chrome: tabs, role filter, search ----
const auth = useAuthStore()
const tab = ref('users')
const roleFilter = ref('all')
const search = ref('')
const ROLE_DESC: Record<string, string> = {
  SuperAdmin: 'Full access to everything, including users, apps and storefront settings.',
  OpsManager: 'Runs daily operations: orders, call center, fulfillment, shipping and inventory.',
  Finance: 'Reconciliation, cash collection, reports and the audit log.',
  Support: 'Orders, customers and abandoned carts; confirms orders by phone.',
  Warehouse: 'Inventory only: stock levels and product preparation.',
  CallCenterAgent: 'Works the call-center queue: confirmation calls and notes.'
}
const roleTabs = computed(() => [
  { label: 'All', value: 'all', count: (users.value ?? []).length },
  ...(roles.value ?? []).map((r) => ({ label: r.name, value: r.name, count: (users.value ?? []).filter((u) => u.roleName === r.name).length }))
])
const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (users.value ?? []).filter((u) => (roleFilter.value === 'all' || u.roleName === roleFilter.value) && (!q || u.email.toLowerCase().includes(q)))
})


// ---- Bulk select + permanent delete (SuperAdmin only) ----
const { isSuperAdmin } = useDangerDelete()
const { selected: selIds, allChecked: selAll, indeterminate: selSome, toggleAll: selToggleAll, toggle: selToggle, clear: selClear, count: selCount } = useBulkSelect(computed(() => visible.value.filter((u) => u.email !== auth.user?.email)))
const { bulkDelete, busy: bulkBusy } = useBulkDelete()
const bulkApi = useAdminApi()

async function deleteSelected() {
  const deleted = await bulkDelete([...selIds.value], { noun: 'user', remove: (id) => bulkApi(`/admin/users/__ID__`.replace('__ID__', id), { method: 'DELETE' }) })
  if (deleted.length) {
    selClear()
    await refresh()
  }
}
</script>

<template>
  <AdsPage title="Users & roles" description="People who can sign in to this admin">
    <template #actions>
      <button class="btn btn-primary" type="button" @click="showCreate = true"><AdsIcon name="i-lucide-user-plus" />New admin</button>
    </template>

    <AdsTabs v-model="tab" underline :items="[{ label: 'Users', value: 'users' }, { label: 'Roles', value: 'roles' }]" />

    <section v-if="tab === 'users'" class="stack">
      <section class="kpis" aria-label="Team summary">
        <AdsKpiCard label="Users" :value="(users ?? []).length" />
        <AdsKpiCard label="Active" :value="(users ?? []).filter((u) => u.active).length" color="dark" meta="Can sign in" />
        <AdsKpiCard label="Deactivated" :value="(users ?? []).filter((u) => !u.active).length" color="warning" meta="Sign-in blocked" />
        <AdsKpiCard label="Roles" :value="(roles ?? []).length" meta="Fixed role model" />
      </section>

      <section class="card" aria-label="Users">
        <div class="card-head">
          <AdsTabs v-model="roleFilter" :items="roleTabs" />
          <AdsSearch v-model="search" soft placeholder="Email" label="Search users" />
        </div>
        <BulkBar v-if="isSuperAdmin" :count="selCount" :busy="bulkBusy" can-delete @delete="deleteSelected" @clear="selClear" />
      <div class="table-wrap">
          <table style="min-width: 640px">
            <thead><tr><th v-if="isSuperAdmin" style="width: 28px"><input type="checkbox" aria-label="Select all" :checked="selAll" :indeterminate="selSome" @change="selToggleAll(($event.target as HTMLInputElement).checked)"></th><th>User</th><th>Role</th><th>Status</th><th><span class="sr">Actions</span></th></tr></thead>
            <tbody>
              <tr v-if="pending"><td :colspan="4 + (isSuperAdmin ? 1 : 0)" class="empty">Loading…</td></tr>
              <tr v-else-if="!visible.length"><td :colspan="4 + (isSuperAdmin ? 1 : 0)" class="empty">No users found.</td></tr>
              <tr v-for="u in visible" v-else :key="u.id"><td v-if="isSuperAdmin" @click.stop><input v-if="u.email !== auth.user?.email" type="checkbox" :aria-label="`Select ${u.email}`" :checked="selIds.has(u.id)" @change="selToggle(u.id, ($event.target as HTMLInputElement).checked)"></td>
                <td>
                  <div class="prod">
                    <span class="initials" :class="{ dark: u.email === auth.user?.email }">{{ u.email.slice(0, 2).toUpperCase() }}</span>
                    <span><span class="strong">{{ u.email }}</span><span v-if="u.email === auth.user?.email" class="sub">You</span></span>
                  </div>
                </td>
                <td>{{ u.roleName }}</td>
                <td><span class="pill" :class="u.active ? 'active' : 'suspended'">{{ u.active ? 'Active' : 'Deactivated' }}</span></td>
                <td class="num"><button v-if="u.email !== auth.user?.email" class="btn btn-sm" :class="{ 'btn-danger': u.active }" type="button" @click="toggle(u)">{{ u.active ? 'Deactivate' : 'Reactivate' }}</button><button v-if="u.email !== auth.user?.email" class="btn btn-sm btn-danger" type="button" style="margin-left: 6px" @click="deleteUser(u)"><AdsIcon name="i-lucide-trash-2" />Delete</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>

    <section v-else class="stack">
      <div class="cards-grid">
        <div v-for="r in roles" :key="r.id" class="card" style="gap: 10px">
          <div class="card-head"><h2>{{ r.name }}</h2><span class="pill neutral">{{ (users ?? []).filter((u) => u.roleName === r.name).length }} users</span></div>
          <p class="muted" style="line-height: 1.5">{{ ROLE_DESC[r.name] ?? 'Custom role' }}</p>
        </div>
      </div>
    </section>
  </AdsPage>

  <AdsDialog v-model:open="showCreate" title="New admin user" width="sm">
    <AdsField label="Email"><AdsInput v-model="newEmail" type="email" /></AdsField>
    <AdsField label="Password" help="Minimum 8 characters."><AdsInput v-model="newPassword" type="password" /></AdsField>
    <AdsField label="Role"><AdsSelect v-model="newRoleId" :items="(roles ?? []).map((r) => ({ label: r.name, value: r.id }))" placeholder="Choose a role…" /></AdsField>
    <template #footer>
      <button class="btn" type="button" @click="showCreate = false">Cancel</button>
      <button class="btn btn-primary" type="button" :disabled="saving || !newEmail || !newPassword || !newRoleId" @click="createUser">Create</button>
    </template>
  </AdsDialog>
</template>
