import { Node, mergeAttributes } from '@tiptap/core'

// Tiptap ships no official video node (unlike Image) — this is the minimal
// equivalent: an atomic block rendering a native <video controls> tag, source
// pointed at whatever URL the upload flow returned. Inserted via
// `editor.chain().focus().insertContent({ type: 'video', attrs: { src } })`
// rather than a custom command, so no Commands-interface module augmentation
// is needed for this to typecheck.
export const VideoExtension = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null }
    }
  },

  parseHTML() {
    return [{ tag: 'video' }]
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      'video',
      mergeAttributes(HTMLAttributes, { controls: 'controls', class: 'rte-video' }),
      ['source', { src: HTMLAttributes.src }]
    ]
  }
})
