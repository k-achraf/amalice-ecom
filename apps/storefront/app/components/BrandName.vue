<script setup lang="ts">
// The store's wordmark: the uploaded logo when one is set (Settings → Brand),
// otherwise the store name. The default slot is decoration that only belongs
// with the text wordmark (e.g. a trailing dot) and is dropped for a logo.
const props = withDefaults(defineProps<{ imgClass?: string }>(), { imgClass: 'h-9 w-auto max-w-[180px] object-contain' })
const settings = useStoreSettings()
const logo = computed(() => resolveImageUrl(settings.value.brand?.logoUrl))
</script>

<template>
  <img
    v-if="logo"
    :src="logo"
    :alt="settings.storeName"
    :class="props.imgClass"
    width="180"
    height="36"
    fetchpriority="high"
  >
  <template v-else>
    {{ settings.storeName }}<slot />
  </template>
</template>
