// Returns a ref that flips true on the FIRST of: a real user interaction
// (pointer/touch/key/scroll), or an idle-callback budget (falls back to a
// plain setTimeout where requestIdleCallback isn't supported, e.g. Safari).
// Built for gating third-party tracking scripts (Meta/TikTok pixels) out of
// the critical rendering path — PageSpeed flagged them as competing with
// first paint for bandwidth/CPU. Always false during SSR (no window), which
// is exactly what we want: the script tag never lands in the initial HTML.
export function useDeferredLoad(idleTimeoutMs = 3500) {
  const ready = ref(false)

  if (import.meta.client) {
    let settled = false
    const events = ['pointerdown', 'touchstart', 'keydown', 'scroll'] as const

    const settle = () => {
      if (settled) return
      settled = true
      ready.value = true
      for (const e of events) window.removeEventListener(e, settle)
    }

    for (const e of events) window.addEventListener(e, settle, { once: true, passive: true })

    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback
    if (ric) {
      ric(settle, { timeout: idleTimeoutMs })
    } else {
      setTimeout(settle, idleTimeoutMs)
    }
  }

  return ready
}
