<script setup lang="ts">
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'

// Default slot = trigger; `#content` = the floating panel.
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child><slot /></PopoverTrigger>
    <PopoverPortal>
      <PopoverContent :side-offset="6" align="end" class="ads-root z-50 rounded-ads-lg border border-ads-border bg-ads-surface shadow-ads-overlay">
        <slot name="content" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
