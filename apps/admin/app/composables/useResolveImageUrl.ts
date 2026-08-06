// Local uploads (stored as /uploads/xxx.jpg) are relative to the API server,
// not this SPA — same problem/fix as products/[id].vue's own resolveImgUrl,
// pulled out here so the Call Center/Orders/Shipping inline product
// thumbnails (OrderLineItemsInline.vue) don't each hand-roll it again.
export function useResolveImageUrl() {
  const runtimeConfig = useRuntimeConfig()
  function resolveImageUrl(url: string): string {
    if (!url) return ''
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    return `${runtimeConfig.public.apiBase}${url}`
  }
  return { resolveImageUrl }
}
