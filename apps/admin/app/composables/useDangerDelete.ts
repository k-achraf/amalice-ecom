// Permanent deletion is SuperAdmin-only (the API enforces it; this only decides
// whether to show the buttons) and always needs an explicit typed confirmation.
export function useDangerDelete() {
  const auth = useAuthStore()
  const isSuperAdmin = computed(() => auth.role === 'SuperAdmin')

  function confirmDelete(message: string): boolean {
    if (!import.meta.client) return false
    const answer = window.prompt(`${message}\n\nThis cannot be undone. Type DELETE to confirm.`)
    return answer?.trim() === 'DELETE'
  }

  return { isSuperAdmin, confirmDelete }
}
