// Records the visitor's ad source (utm_*, fbclid, campaign/ad ids…) as soon as
// the app boots, and again after each client-side navigation, so an order
// placed several pages later can still be attributed — see useAttribution.ts.
export default defineNuxtPlugin(() => {
  const { capture } = useAttribution()
  capture()
  useRouter().afterEach(() => capture())
})
