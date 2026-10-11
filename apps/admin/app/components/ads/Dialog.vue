<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from 'reka-ui'

// Standard modal: title row, body, right-aligned footer actions.
const open = defineModel<boolean>('open', { default: false })
withDefaults(defineProps<{ title: string; description?: string; width?: 'sm' | 'md' | 'lg' }>(), { width: 'md' })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="modal-overlay" />
      <DialogContent class="modal" :style="{ maxWidth: width === 'sm' ? '440px' : width === 'lg' ? '680px' : '540px' }">
        <header class="modal-head">
          <div style="flex-grow: 1; min-width: 0">
            <DialogTitle as="h2" style="font-size: 20px">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="muted" style="margin: 4px 0 0">{{ description }}</DialogDescription>
            <DialogDescription v-else class="sr-only">{{ title }}</DialogDescription>
          </div>
          <DialogClose as-child><AdsButton appearance="subtle" square size="sm" aria-label="Close"><X /></AdsButton></DialogClose>
        </header>
        <div class="modal-body"><slot /></div>
        <footer v-if="$slots.footer" class="modal-foot"><slot name="footer" /></footer>
        <div v-else style="height: 16px" />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
