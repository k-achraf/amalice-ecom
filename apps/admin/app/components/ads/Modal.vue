<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from 'reka-ui'
import { cn } from '~/lib/cn'

// Generic modal with the Nuxt UI `UModal` surface the existing pages use:
//  - `#content` slot: caller supplies the whole panel body (typically a p-6 div);
//  - or `title` / `description` + default/`#body` slot + `#footer` slot.
// `ui.content` adds classes to the panel (e.g. a wider max-w). Use AdsDialog for
// new code that wants the standard header/footer chrome.
const open = defineModel<boolean>('open', { default: false })
defineProps<{ title?: string; description?: string; ui?: { content?: string } }>()
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-ads-overlay" />
      <DialogContent
        :class="cn('ads-root fixed start-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-ads-lg bg-ads-surface shadow-ads-overlay rtl:translate-x-1/2', ui?.content)"
        @open-auto-focus.prevent
      >
        <DialogTitle class="sr-only">{{ title ?? 'Dialog' }}</DialogTitle>
        <DialogDescription class="sr-only">{{ description ?? title ?? 'Dialog' }}</DialogDescription>
        <slot name="content">
          <header v-if="title || description" class="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
            <div class="min-w-0">
              <h2 v-if="title" class="text-xl font-medium leading-7 text-ads-text">{{ title }}</h2>
              <p v-if="description" class="mt-1 text-sm text-ads-subtle">{{ description }}</p>
            </div>
            <DialogClose as-child><AdsButton appearance="subtle" square aria-label="Close"><X /></AdsButton></DialogClose>
          </header>
          <div class="space-y-4 px-6 py-3"><slot name="body"><slot /></slot></div>
          <footer v-if="$slots.footer" class="flex justify-end gap-2 px-6 pt-2 pb-5"><slot name="footer" /></footer>
        </slot>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
