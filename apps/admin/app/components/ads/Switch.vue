<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

const model = defineModel<boolean>()
defineProps<{ ariaLabel?: string }>()
</script>

<template>
  <SwitchRoot
    v-model="model"
    :aria-label="ariaLabel"
    class="relative inline-flex h-4 w-8 shrink-0 items-center rounded-full bg-ads-input transition-colors data-[state=checked]:bg-ads-primary"
  >
    <SwitchThumb class="block size-3 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-[18px] rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[18px]" />
  </SwitchRoot>
</template>
