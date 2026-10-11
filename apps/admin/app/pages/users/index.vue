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

async function toggle(user: AdminUser) {
  await run(() => api(`/admin/users/${user.id}/${user.active ? 'deactivate' : 'reactivate'}`, { method: 'POST' }), {
    success: user.active ? 'User deactivated' : 'User reactivated',
    errorFallback: 'Could not update the user'
  })
  await refresh()
}
</script>

<template>
  <AdsPage title="Users & Roles" wide>
  <template #actions>
    <AdsButton icon="i-lucide-user-plus" size="sm" label="New admin" @click="showCreate = true" />
  </template>
  <div class="admin-table-wrap">
    <table class="admin-table w-full text-sm">
      <thead>
        <tr>
          <th class="px-4 py-2.5 text-left">Email</th>
          <th class="px-4 py-2.5 text-left">Role</th>
          <th class="px-4 py-2.5 text-left">Status</th>
          <th class="px-4 py-2.5 text-right">Action</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="pending"><td colspan="4" class="px-4 py-12 text-center text-muted">Loading…</td></tr>
        <tr v-for="u in users" :key="u.id">
          <td class="px-4 py-3 font-medium">{{ u.email }}</td>
          <td class="px-4 py-3"><AdsBadge color="info" variant="subtle">{{ u.roleName }}</AdsBadge></td>
          <td class="px-4 py-3">
            <AdsBadge :color="u.active ? 'success' : 'neutral'" variant="subtle">{{ u.active ? 'Active' : 'Deactivated' }}</AdsBadge>
          </td>
          <td class="px-4 py-3 text-right">
            <AdsButton
              size="xs"
              :variant="u.active ? 'outline' : 'soft'"
              :color="u.active ? 'error' : 'success'"
              :label="u.active ? 'Deactivate' : 'Reactivate'"
              @click="toggle(u)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Role reference -->
  <div v-if="roles?.length" class="admin-kpi-card mt-6 p-5">
    <h3 class="mb-2 text-sm font-medium text-muted">Roles (fixed five-role model — plan §8)</h3>
    <div class="flex flex-wrap gap-2">
      <AdsBadge v-for="r in roles" :key="r.id" color="neutral" variant="subtle">{{ r.name }}</AdsBadge>
    </div>
  </div>

  <AdsModal v-model:open="showCreate">
    <template #content>
      <div class="space-y-4 p-6">
        <h3 class="text-lg font-semibold">New admin user</h3>
        <AdsField label="Email"><AdsInput v-model="newEmail" type="email" class="w-full" /></AdsField>
        <AdsField label="Password (min 8 chars)"><AdsInput v-model="newPassword" type="password" class="w-full" /></AdsField>
        <AdsField label="Role">
          <AdsSelect v-model="newRoleId" :items="(roles ?? []).map(r => ({ label: r.name, value: r.id }))" class="w-full" />
        </AdsField>
        <div class="flex justify-end gap-2">
          <AdsButton color="neutral" variant="ghost" label="Cancel" @click="showCreate = false" />
          <AdsButton :loading="saving" label="Create" @click="createUser" />
        </div>
      </div>
    </template>
  </AdsModal>
</AdsPage>
</template>
