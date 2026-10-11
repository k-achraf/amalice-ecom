<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from 'reka-ui'
import { cn } from '~/lib/cn'

// Generic modal with the `UModal`-style surface the existing pages use:
//  - `#content` slot: caller supplies the whole panel body (typically a p-6 div);
//  - or `title` / `description` + default/`#body` slot + `#footer` slot.
// `ui.content` adds classes to the panel (e.g. a wider max-w).
const open = defineModel<boolean>('open', { default: false })
defineProps<{ title?: string; description?: string; ui?: { content?: string } }>()
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="modal-overlay" />
      <DialogContent :class="cn('modal', ui?.content)" @open-auto-focus.prevent>
        <DialogTitle class="sr-only">{{ title ?? 'Dialog' }}</DialogTitle>
        <DialogDescription class="sr-only">{{ description ?? title ?? 'Dialog' }}</DialogDescription>
        <slot name="content">
          <header v-if="title || description" class="modal-head">
            <div style="flex-grow: 1; min-width: 0">
              <h2 v-if="title" style="font-size: 20px">{{ title }}</h2>
              <p v-if="description" class="muted" style="margin: 4px 0 0">{{ description }}</p>
            </div>
            <DialogClose as-child><AdsButton appearance="subtle" square size="sm" aria-label="Close"><X /></AdsButton></DialogClose>
          </header>
          <div class="modal-body"><slot name="body"><slot /></slot></div>
          <footer v-if="$slots.footer" class="modal-foot"><slot name="footer" /></footer>
        </slot>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
