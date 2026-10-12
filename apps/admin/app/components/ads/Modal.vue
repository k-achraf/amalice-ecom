<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from 'reka-ui'
import { cn } from '~/lib/cn'

// The design's `.modal`. Two usages:
//  - `#content` slot: caller supplies the whole panel body (older pages);
//  - or `title` / `description` + default/`#body` slot + `#footer` slot.
// `ui.content` adds classes to the panel (e.g. a wider max-w).
const open = defineModel<boolean>('open', { default: false })
defineProps<{ title?: string; description?: string; ui?: { content?: string } }>()
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="overlay on" />
      <DialogContent :class="cn('modal on', ui?.content)" @open-auto-focus.prevent>
        <DialogTitle class="sr">{{ title ?? 'Dialog' }}</DialogTitle>
        <DialogDescription class="sr">{{ description ?? title ?? 'Dialog' }}</DialogDescription>
        <slot name="content">
          <div v-if="title" class="modal-head">
            <h2>{{ title }}</h2>
            <DialogClose as-child><button class="icon-btn plain sm" type="button" aria-label="Close"><X class="i" /></button></DialogClose>
          </div>
          <div class="modal-body">
            <p v-if="description" class="muted">{{ description }}</p>
            <slot name="body"><slot /></slot>
          </div>
          <div v-if="$slots.footer" class="modal-foot"><slot name="footer" /></div>
        </slot>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
