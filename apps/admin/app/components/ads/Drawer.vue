<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from 'reka-ui'

// The design's right-hand `.drawer` (460px): head, scrolling body, footer.
const open = defineModel<boolean>('open', { default: false })
defineProps<{ title: string; description?: string; wide?: boolean }>()
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="overlay on" />
      <DialogContent class="drawer on" :style="wide ? { width: 'min(760px, 100vw)' } : undefined" @open-auto-focus.prevent>
        <div class="drawer-head">
          <DialogTitle as="h2">{{ title }}</DialogTitle>
          <DialogClose as-child><button class="icon-btn plain sm" type="button" aria-label="Close"><X class="i" /></button></DialogClose>
        </div>
        <div class="drawer-body">
          <DialogDescription v-if="description" as="p" class="muted">{{ description }}</DialogDescription>
          <DialogDescription v-else class="sr">{{ title }}</DialogDescription>
          <slot />
        </div>
        <div v-if="$slots.footer" class="drawer-foot"><slot name="footer" /></div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
