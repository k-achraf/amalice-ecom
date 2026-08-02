// PageSpeed flagged the built CSS bundle (~63KB) as fully render-blocking —
// the browser must download it before first paint. The standard fix is the
// "preload + swap" pattern: load it as a non-blocking preload, then flip it
// to an active stylesheet once it arrives (with a <noscript> fallback for
// the no-JS case). This does NOT touch load/cascade order — it's still the
// same single stylesheet tag in the same position, just no longer blocking;
// nothing about which rules win changes. (A per-template CSS split was
// considered instead but rejected — see TemplatePage.vue's/nuxt.config.ts's
// comments on why that risks breaking rtl.css's override guarantee.)
// Matches only our own built CSS <link> tags — head entries aren't
// reliably one-tag-per-array-item (unhead can concatenate multiple tags
// into a single string), so this replaces the exact stylesheet link
// in-place rather than assuming a whole array entry is just that one tag.
const STYLESHEET_LINK = /<link[^>]*rel="stylesheet"[^>]*href="([^"]*\/_nuxt\/[^"]*\.css)"[^>]*>/g

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html) => {
    html.head = html.head.map((entry) =>
      entry.replace(
        STYLESHEET_LINK,
        (_match, href) =>
          `<link rel="preload" as="style" href="${href}" onload="this.onload=null;this.rel='stylesheet'">` +
          `<noscript><link rel="stylesheet" href="${href}"></noscript>`
      )
    )
  })
})
