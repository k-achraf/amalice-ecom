<script setup lang="ts">
import { TabsRoot, TabsList, TabsTrigger } from 'reka-ui'

// Tab strip only — callers render the active panel themselves (v-if on the model).
const model = defineModel<string>()
defineProps<{ items: { label: string; value: string; icon?: string }[] }>()
</script>

<template>
  <TabsRoot v-model="model">
    <TabsList class="flex gap-1 overflow-x-auto border-b-2 border-ads-border">
      <TabsTrigger
        v-for="t in items"
        :key="t.value"
        :value="t.value"
        class="relative -mb-0.5 inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm font-medium text-ads-subtle hover:text-ads-text data-[state=active]:border-ads-primary data-[state=active]:text-ads-primary"
      >
        <AdsIcon v-if="t.icon" :name="t.icon" class="size-4" />
        {{ t.label }}
      </TabsTrigger>
    </TabsList>
  </TabsRoot>
</template>
