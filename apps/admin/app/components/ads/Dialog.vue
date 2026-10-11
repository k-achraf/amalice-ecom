<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, DialogClose } from 'reka-ui'

// Atlassian-style modal: title row, scrollable body, right-aligned footer actions.
const open = defineModel<boolean>('open', { default: false })
withDefaults(defineProps<{ title: string; description?: string; width?: 'sm' | 'md' | 'lg' }>(), { width: 'md' })
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-ads-overlay" />
      <DialogContent
        class="ads-root fixed start-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-ads-lg bg-ads-surface shadow-ads-overlay rtl:translate-x-1/2"
        :class="{ 'max-w-md': width === 'sm', 'max-w-lg': width === 'md', 'max-w-2xl': width === 'lg' }"
      >
        <header class="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div class="min-w-0">
            <DialogTitle class="text-xl font-medium leading-7 text-ads-text">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="mt-1 text-sm text-ads-subtle">{{ description }}</DialogDescription>
            <DialogDescription v-else class="sr-only">{{ title }}</DialogDescription>
          </div>
          <DialogClose as-child>
            <AdsButton appearance="subtle" square aria-label="Close"><X /></AdsButton>
          </DialogClose>
        </header>
        <div class="space-y-4 overflow-y-auto px-6 py-2"><slot /></div>
        <footer v-if="$slots.footer" class="flex justify-end gap-2 px-6 pt-3 pb-5"><slot name="footer" /></footer>
        <div v-else class="pb-3" />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
