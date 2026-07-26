<script setup lang="ts">
import type { ProductListResponse } from '@amalice/shared'

// LOGIC ONLY — newest-products fetch. Presentation via <TemplatePage name="NewArrivals">.
useSeoMeta({ title: 'New Arrivals', description: 'The latest additions to our catalog.' })

const { data } = await useApiFetch<ProductListResponse>('/products', {
  query: { pageSize: 20 },
  key: 'new-arrivals'
})
</script>

<template>
  <TemplatePage name="NewArrivals" :page-props="{ data }" />
</template>
