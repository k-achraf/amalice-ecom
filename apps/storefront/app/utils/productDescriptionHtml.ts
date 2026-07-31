import DOMPurify from 'isomorphic-dompurify'

// Product descriptions are authored in the admin's Tiptap editor
// (RichTextEditor.vue) and stored as HTML — see packages/shared's
// description field. Sanitizing here (not just trusting admin input) is
// cheap insurance: an admin account compromise or a future "import
// description from URL" feature shouldn't become stored XSS on every PDP.
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'b', 'i',
  'h2', 'h3', 'ul', 'ol', 'li', 'blockquote',
  'a', 'img', 'video', 'source'
]
const ALLOWED_ATTR = ['href', 'target', 'rel', 'src', 'alt', 'width', 'height', 'controls', 'class']

export function sanitizeDescriptionHtml(html: string | null | undefined): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
}

// Impulse's PDP doesn't render the description as HTML — it splits it into
// sentences for a green-check benefits list, so it needs plain text first.
export function stripDescriptionHtml(html: string | null | undefined): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}
