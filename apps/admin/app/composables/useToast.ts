import { toast } from 'vue-sonner'

// Thin adapter so pages written against `toast.add({ title, description, color })`
// keep working on vue-sonner. New code can import `toast` from 'vue-sonner' directly.
type ToastColor = 'success' | 'error' | 'warning' | 'info' | 'primary' | 'neutral'

export function useToast() {
  function add(opts: { title: string; description?: string; color?: ToastColor }) {
    const extra = opts.description ? { description: opts.description } : undefined
    switch (opts.color) {
      case 'success': return toast.success(opts.title, extra)
      case 'error': return toast.error(opts.title, extra)
      case 'warning': return toast.warning(opts.title, extra)
      case 'info': return toast.info(opts.title, extra)
      default: return toast(opts.title, extra)
    }
  }
  return { add }
}
