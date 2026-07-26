<script setup lang="ts">
import type { RevalidationResult } from '../stores/cart'

// If displayCart is false (lead-form mode), there is no cart page — redirect.
const settings = useStoreSettings()
if (!settings.value.displayCart) {
  await navigateTo('/')
}

useSeoMeta({ title: 'Cart' })

const cart = useCartStore()
const apiClient = useApiClient()

const notice = ref<RevalidationResult | null>(null)
const revalidating = ref(false)

onMounted(async () => {
  if (cart.items.length === 0) return
  revalidating.value = true
  const result = await cart.revalidate(apiClient)
  if (result.removed.length > 0 || result.changed.length > 0) notice.value = result
  revalidating.value = false
})

function onDismissNotice() {
  notice.value = null
}
</script>

<template>
  <TemplatePage
    name="Cart"
    :page-props="{
      cart,
      notice,
      revalidating: revalidating ?? false,
      onDismissNotice
    }"
  />
</template>
