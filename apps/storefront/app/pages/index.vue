<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// Home page — LOGIC stays here (data fetching, SEO, structured data).
// PRESENTATION delegates to template-overridable sections via <TemplateSection>.
// Each template can override HomeHero / HomeUsps / ProductCard; the grids reuse
// HomeProductGrid (which itself uses the overridable card).

useSeoMeta({
  title: 'أماليس — التسوق بنظام الدفع عند الاستلام',
  description: 'تسوّق منتجاتك اليومية وادفع عند وصولها. لا حساب، لا دفع مسبق — نتصل بك للتأكيد، ثم تدفع نقداً عند الاستلام.'
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

// First-party view-tracking (admin dashboard's traffic stats) — client-only,
// fires once per mount. Nuxt reuses this page's component instance for
// repeat "/" navigations in the same SPA session (rare for the home route
// specifically, unlike PDP), so a plain one-shot call here is enough —
// there's no per-entity id to key a re-fire guard against, unlike ViewContent
// on the product/landing pages.
if (import.meta.client) {
  useViewTracking().recordView('Home')
}
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
      :section-props="{ title: 'وصل حديثاً', products: featured.items, viewAllTo: '/catalog' }"
    />
    <TemplateSection
      v-if="bestSellers?.items.length"
      name="HomeProductGrid"
      :section-props="{ title: 'الأكثر مبيعاً', products: bestSellers.items, viewAllTo: '/catalog' }"
    />

    <!-- USP / trust strip — template-overridable -->
    <TemplateSection name="HomeUsps" />
  </main>
</template>
