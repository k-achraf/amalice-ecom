<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from 'reka-ui'

// The design's `.modal`: head with title + close, body, right-aligned footer.
const open = defineModel<boolean>('open', { default: false })
withDefaults(defineProps<{ title: string; description?: string; width?: 'sm' | 'md' | 'lg' }>(), { width: 'md' })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="overlay on" />
      <DialogContent class="modal on" :style="{ width: width === 'sm' ? 'min(440px, calc(100vw - 32px))' : width === 'lg' ? 'min(720px, calc(100vw - 32px))' : undefined }">
        <div class="modal-head">
          <DialogTitle as="h2">{{ title }}</DialogTitle>
          <DialogClose as-child><button class="icon-btn plain sm" type="button" aria-label="Close"><X class="i" /></button></DialogClose>
        </div>
        <div class="modal-body">
          <DialogDescription v-if="description" as="p" class="muted">{{ description }}</DialogDescription>
          <DialogDescription v-else class="sr">{{ title }}</DialogDescription>
          <slot />
        </div>
        <div v-if="$slots.footer" class="modal-foot"><slot name="footer" /></div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
