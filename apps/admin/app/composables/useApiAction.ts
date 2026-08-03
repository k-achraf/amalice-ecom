// Wraps a mutating API call with consistent success/error toast feedback —
// every admin page that creates/updates/deletes/transitions something goes
// through this instead of hand-rolling its own try/catch. Error messages
// prefer the server's own message (nestjs-zod/BadRequestException bodies
// shape as { message }) over a generic fallback, so e.g. "Assign a shipping
// company before dispatching it" reaches the user verbatim instead of a
// vague "Something went wrong".
export function useApiAction() {
  const toast = useToast()

  async function run<T>(fn: () => Promise<T>, opts?: { success?: string; errorFallback?: string }): Promise<T | undefined> {
    try {
      const result = await fn()
      if (opts?.success) toast.add({ title: opts.success, color: 'success' })
      return result
    } catch (err: unknown) {
      const data = (err as { data?: { message?: string } })?.data
      const message = Array.isArray(data?.message) ? data.message.join(' ') : data?.message
      toast.add({ title: message ?? opts?.errorFallback ?? 'Something went wrong', color: 'error' })
      return undefined
    }
  }

  return { run }
}
