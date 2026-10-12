<script setup lang="ts">
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'

// Default slot = trigger; `#content` = the floating panel (design card styling).
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child><slot /></PopoverTrigger>
    <PopoverPortal>
      <PopoverContent :side-offset="6" align="end" style="z-index: 60; background: var(--white); border: 1px solid var(--line); border-radius: var(--r-lg); box-shadow: var(--shadow); color: var(--pine); font-family: var(--font); font-size: 14px">
        <slot name="content" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
