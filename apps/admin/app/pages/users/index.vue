<script setup lang="ts">
import type { AdminUser } from '@amalice/shared'

definePageMeta({ requiredRole: 'SuperAdmin' })
useHead({ title: 'Users & Roles' })

const api = useAdminApi()
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
  try {
    await api('/admin/users', { method: 'POST', body: { email: newEmail.value, password: newPassword.value, roleId: newRoleId.value } })
    showCreate.value = false
    newEmail.value = ''
    newPassword.value = ''
    await refresh()
  } finally {
    saving.value = false
  }
}

async function toggle(user: AdminUser) {
  await api(`/admin/users/${user.id}/${user.active ? 'deactivate' : 'reactivate'}`, { method: 'POST' })
  await refresh()
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Users & Roles">
        <template #leading><UDashboardSidebarCollapse /></template>
        <template #right><UButton icon="i-lucide-user-plus" size="sm" label="New admin" @click="showCreate = true" /></template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="admin-kpi-card overflow-hidden">
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
              <td class="px-4 py-3"><UBadge color="info" variant="subtle">{{ u.roleName }}</UBadge></td>
              <td class="px-4 py-3">
                <UBadge :color="u.active ? 'success' : 'neutral'" variant="subtle">{{ u.active ? 'Active' : 'Deactivated' }}</UBadge>
              </td>
              <td class="px-4 py-3 text-right">
                <UButton
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
          <UBadge v-for="r in roles" :key="r.id" color="neutral" variant="subtle">{{ r.name }}</UBadge>
        </div>
      </div>

      <UModal v-model:open="showCreate">
        <template #content>
          <div class="space-y-4 p-6">
            <h3 class="text-lg font-semibold">New admin user</h3>
            <UFormField label="Email"><UInput v-model="newEmail" type="email" class="w-full" /></UFormField>
            <UFormField label="Password (min 8 chars)"><UInput v-model="newPassword" type="password" class="w-full" /></UFormField>
            <UFormField label="Role">
              <USelect v-model="newRoleId" :items="(roles ?? []).map(r => ({ label: r.name, value: r.id }))" class="w-full" />
            </UFormField>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" label="Cancel" @click="showCreate = false" />
              <UButton :loading="saving" label="Create" @click="createUser" />
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
