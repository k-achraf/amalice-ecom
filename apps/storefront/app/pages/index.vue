<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Home page — LOGIC stays here (data fetching, SEO, structured data).
// PRESENTATION delegates to template-overridable sections via <TemplateSection>.
// Each template can override HomeHero / HomeUsps / ProductCard; the grids reuse
// HomeProductGrid (which itself uses the overridable card).

useSeoMeta({
  title: 'Amalice — Cash on delivery shopping',
  description: 'Shop everyday goods and pay when they arrive. No account, no prepayment — just phone-verified cash on delivery.'
})

const sd = useStructuredData()
sd.organization()
sd.website()

const { data: categories } = await useApiFetch<Category[]>('/categories/featured', { key: 'store-featured-categories' })
const { data: featured } = await useApiFetch<ProductListResponse>('/products?pageSize=4', { key: 'store-featured' })
const { data: bestSellers } = await useApiFetch<ProductListResponse>('/products?pageSize=4', {
  query: { q: 'mug' },
  key: 'store-bestsellers'
})
</script>

<template>
  <main>
    <!-- Hero — template-overridable -->
    <TemplateSection name="HomeHero" />

    <!-- Featured categories -->
    <TemplateSection name="HomeFeaturedCategories" :section-props="{ categories: categories ?? [] }" />

    <!-- New arrivals / best sellers grids (template-overridable cards via HomeProductGrid) -->
    <TemplateSection
      v-if="featured?.items.length"
      name="HomeProductGrid"
      :section-props="{ title: 'New arrivals', products: featured.items, viewAllTo: '/catalog' }"
    />
    <TemplateSection
      v-if="bestSellers?.items.length"
      name="HomeProductGrid"
      :section-props="{ title: 'Best sellers', products: bestSellers.items, viewAllTo: '/catalog' }"
    />

    <!-- USP / trust strip — template-overridable -->
    <TemplateSection name="HomeUsps" />
  </main>
</template>
