import { Extension } from '@tiptap/core'

// No official Tiptap extension sets per-block `dir` (unlike TextAlign, which
// has one) — this hand-rolls the same pattern: a global attribute added to
// every block-level node (paragraph, heading, blockquote, list items),
// rendered as an actual `dir="rtl"|"ltr"` HTML attribute so it round-trips
// through Product.description's stored HTML and is respected wherever that
// HTML is rendered later (the storefront PDP, order/landing-page copy) —
// not just a display-only toggle inside this editor. Needed because product
// descriptions are commonly Arabic (RTL) while this admin's own chrome is
// LTR-only (see apps/admin/CLAUDE.md — no RTL mode here), so the browser's
// default paragraph direction inside the editor is LTR unless told
// otherwise per block.
//
// Deliberately no addCommands() here (unlike official extensions) — that
// would need a Commands-interface module augmentation to typecheck through
// editor.chain(), the same tradeoff VideoExtension avoids by having its
// caller use insertContent() directly. RichTextEditor.vue instead calls
// editor.chain().focus().updateAttributes(type, { dir }).run() per node type
// itself, which needs no augmentation.
export const TextDirection = Extension.create({
  name: 'textDirection',

  addOptions() {
    return {
      types: ['paragraph', 'heading', 'blockquote', 'listItem']
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          dir: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('dir') || null,
            renderHTML: (attributes: { dir?: string | null }) => (attributes.dir ? { dir: attributes.dir } : {})
          }
        }
      }
    ]
  }
})
