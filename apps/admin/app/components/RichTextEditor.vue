<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { VideoExtension } from '../tiptap/video-extension'

// Product-description rich text editor — built directly on Tiptap's Vue
// bindings rather than Nuxt UI's <UEditor>. UEditor reactively rebuilds its
// extension set on every prop/attrs change (it calls Code.extend()/
// HorizontalRule.extend() inside a computed, and @tiptap/vue-3's useEditor
// reactively re-applies options), and each rebuild produces fresh extension
// classes whose ProseMirror plugin keys collide with the still-registered
// ones from the previous configuration — "Adding different instances of a
// keyed plugin", reproducible on every visit to this page. That's upstream
// @nuxt/ui/@tiptap/vue-3 behavior, not something fixable via props, so the
// editor is constructed once here and updated imperatively instead.
//
// Images use Tiptap's official Image extension; video has no official
// equivalent so VideoExtension (../tiptap/video-extension.ts) fills that gap
// with a plain <video controls> node.
//
// Uploads (toolbar buttons, drag-drop, and clipboard paste of a screenshot)
// all funnel through uploadAndInsert(), which POSTs to the same
// /admin/upload endpoint the Images tab already uses (see products/[id].vue's
// onFileSelected) — same multipart/bearer-token pattern, just inserting the
// returned URL into the editor instead of attaching it as a gallery image.
const props = defineProps<{
  // Product.description is a nullable column — callers commonly bind it
  // straight through (see products/[id].vue).
  modelValue: string | null | undefined
  placeholder?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const runtimeConfig = useRuntimeConfig()
const auth = useAuthStore()
const toast = useToast()

const uploading = ref(false)
const imageInput = ref<HTMLInputElement | null>(null)
const videoInput = ref<HTMLInputElement | null>(null)

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await $fetch<{ url: string }>('/admin/upload', {
    baseURL: runtimeConfig.public.apiBase,
    method: 'POST',
    body: formData,
    headers: { Authorization: `Bearer ${auth.token}` }
  })
  return res.url
}

function resolveUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${runtimeConfig.public.apiBase}${url}`
}

async function uploadAndInsert(file: File) {
  if (!editor.value) return
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    toast.add({ title: 'Only image or video files are allowed', color: 'error' })
    return
  }
  uploading.value = true
  try {
    const url = resolveUrl(await uploadFile(file))
    if (file.type.startsWith('image/')) {
      editor.value.chain().focus().setImage({ src: url }).run()
    } else {
      editor.value.chain().focus().insertContent({ type: 'video', attrs: { src: url } }).run()
    }
  } catch {
    toast.add({ title: 'Upload failed', color: 'error' })
  } finally {
    uploading.value = false
  }
}

function onImageSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) uploadAndInsert(file)
  ;(event.target as HTMLInputElement).value = ''
}
function onVideoSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) uploadAndInsert(file)
  ;(event.target as HTMLInputElement).value = ''
}

// Constructed exactly once (useEditor auto-destroys on scope dispose) —
// extensions are static, never rebuilt reactively.
const editor = useEditor({
  content: props.modelValue ?? '',
  extensions: [
    StarterKit.configure({ horizontalRule: false }),
    Link.configure({ openOnClick: false }),
    Image,
    VideoExtension
  ],
  editorProps: {
    attributes: { class: 'rte-content min-h-40 rounded-md border border-default px-3 py-2 text-sm' },
    handleDrop: (_view, event) => {
      const files = Array.from(event.dataTransfer?.files ?? [])
      if (!files.length) return false
      event.preventDefault()
      for (const file of files) uploadAndInsert(file)
      return true
    },
    handlePaste: (_view, event) => {
      const files = Array.from(event.clipboardData?.files ?? [])
      if (!files.length) return false
      event.preventDefault()
      for (const file of files) uploadAndInsert(file)
      return true
    }
  },
  onUpdate: ({ editor: e }) => emit('update:modelValue', e.getHTML())
})

// External changes to product.description (e.g. a refetch after save) get
// synced in without fighting the user's own typing — only pushed when it
// actually differs from what the editor already has.
watch(
  () => props.modelValue,
  (v) => {
    if (!editor.value) return
    const next = v ?? ''
    if (editor.value.getHTML() !== next) editor.value.commands.setContent(next)
  }
)

// Re-render on selection/transaction so toolbar active/disabled states track
// the cursor (isActive/can() aren't reactive on their own).
const editorVersion = ref(0)
function bumpVersion() {
  editorVersion.value++
}
watch(editor, (e, _old, onCleanup) => {
  if (!e) return
  e.on('transaction', bumpVersion)
  onCleanup(() => e.off('transaction', bumpVersion))
}, { immediate: true })

interface ToolbarButton {
  title: string
  icon: string
  active?: () => boolean
  disabled?: () => boolean
  run: () => void
}
const toolbarGroups = computed<ToolbarButton[][]>(() => {
  editorVersion.value // establish reactive dependency
  const e = editor.value
  if (!e) return []
  return [
    [
      { title: 'Undo', icon: 'i-lucide-undo-2', disabled: () => !e.can().undo(), run: () => e.chain().focus().undo().run() },
      { title: 'Redo', icon: 'i-lucide-redo-2', disabled: () => !e.can().redo(), run: () => e.chain().focus().redo().run() }
    ],
    [
      { title: 'Heading 2', icon: 'i-lucide-heading-2', active: () => e.isActive('heading', { level: 2 }), run: () => e.chain().focus().toggleHeading({ level: 2 }).run() },
      { title: 'Heading 3', icon: 'i-lucide-heading-3', active: () => e.isActive('heading', { level: 3 }), run: () => e.chain().focus().toggleHeading({ level: 3 }).run() }
    ],
    [
      { title: 'Bold', icon: 'i-lucide-bold', active: () => e.isActive('bold'), run: () => e.chain().focus().toggleBold().run() },
      { title: 'Italic', icon: 'i-lucide-italic', active: () => e.isActive('italic'), run: () => e.chain().focus().toggleItalic().run() },
      { title: 'Strikethrough', icon: 'i-lucide-strikethrough', active: () => e.isActive('strike'), run: () => e.chain().focus().toggleStrike().run() }
    ],
    [
      { title: 'Bullet list', icon: 'i-lucide-list', active: () => e.isActive('bulletList'), run: () => e.chain().focus().toggleBulletList().run() },
      { title: 'Numbered list', icon: 'i-lucide-list-ordered', active: () => e.isActive('orderedList'), run: () => e.chain().focus().toggleOrderedList().run() },
      { title: 'Quote', icon: 'i-lucide-quote', active: () => e.isActive('blockquote'), run: () => e.chain().focus().toggleBlockquote().run() }
    ],
    [
      {
        title: 'Link',
        icon: 'i-lucide-link',
        active: () => e.isActive('link'),
        run: () => {
          if (e.isActive('link')) {
            e.chain().focus().unsetLink().run()
            return
          }
          const href = window.prompt('Enter the URL:')
          if (href) e.chain().focus().setLink({ href }).run()
        }
      }
    ]
  ]
})
</script>

<template>
  <div class="rte space-y-2">
    <div v-if="editor" class="mb-2 flex flex-wrap items-center gap-1 border-b border-default pb-2">
      <template v-for="(group, gi) in toolbarGroups" :key="gi">
        <div class="flex items-center gap-0.5">
          <UButton
            v-for="btn in group"
            :key="btn.title"
            :icon="btn.icon"
            :title="btn.title"
            color="neutral"
            :variant="btn.active?.() ? 'soft' : 'ghost'"
            :active="btn.active?.()"
            size="sm"
            :disabled="btn.disabled?.()"
            @click="btn.run"
          />
        </div>
        <div v-if="gi < toolbarGroups.length - 1" class="mx-1 h-5 w-px bg-[var(--color-admin-border)]" />
      </template>
      <UButton
        icon="i-lucide-image"
        color="neutral"
        variant="ghost"
        size="sm"
        :loading="uploading"
        title="Insert image"
        @click="imageInput?.click()"
      />
      <UButton
        icon="i-lucide-video"
        color="neutral"
        variant="ghost"
        size="sm"
        :loading="uploading"
        title="Insert video"
        @click="videoInput?.click()"
      />
      <input ref="imageInput" type="file" accept="image/*" class="hidden" @change="onImageSelected">
      <input ref="videoInput" type="file" accept="video/*" class="hidden" @change="onVideoSelected">
    </div>
    <EditorContent :editor="editor" />
    <p class="text-xs text-muted">Drag and drop or paste images/videos directly into the editor.</p>
  </div>
</template>

<style scoped>
.rte :deep(.rte-content img) {
  max-width: 100%;
  border-radius: 0.5rem;
}
.rte :deep(.rte-content .rte-video) {
  max-width: 100%;
  border-radius: 0.5rem;
}
.rte :deep(.rte-content:focus) {
  outline: none;
  border-color: var(--ui-primary);
}
</style>
