<script setup lang="ts">
import type { Product, ProductListResponse } from '@amalice/shared'

// LOGIC ONLY — wishlist state (client-side) + product resolution.
// Presentation via <TemplatePage name="Wishlist">.
useSeoMeta({ title: 'Wishlist', description: 'Your saved products.' })

const wishlist = useState<string[]>('wishlist', () => [])

const { data } = await useApiFetch<ProductListResponse>('/products', {
  query: { pageSize: 100 },
  key: 'wishlist-catalog'
})

const savedProducts = computed<Product[]>(() =>
  (data.value?.items ?? []).filter((p) => wishlist.value.includes(p.id))
)

function remove(id: string) {
  wishlist.value = wishlist.value.filter((w) => w !== id)
}
</script>

<template>
  <TemplatePage name="Wishlist" :page-props="{ savedProducts, onRemove: remove }" />
</template>
