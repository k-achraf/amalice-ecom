<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// LOGIC ONLY — presentation is resolved by <TemplatePage name="Catalog">.
// Every template's CatalogPage consumes the same state/handlers from here,
// so filter/pagination behavior can't drift between templates.
useSeoMeta({
  title: 'Shop',
  description: 'Browse the full Amalice catalog — cash on delivery, no account required.'
})

const route = useRoute()
const router = useRouter()
const sd = useStructuredData()

const { data: categories } = await useApiFetch<Category[]>('/categories', { key: 'store-categories' })
const categoryOptions = computed(() => [
  { label: 'All categories', value: 'all' },
  ...(categories.value ?? []).map((c) => ({ label: c.name, value: c.slug }))
])

const searchInput = ref((route.query.q as string) ?? '')

const query = computed(() => {
  const q: Record<string, string | number> = { page: Number(route.query.page ?? 1), pageSize: 12 }
  if (route.query.category && route.query.category !== 'all')
    q.category = route.query.category as string
  if (route.query.minPriceCents) q.minPriceCents = Number(route.query.minPriceCents)
  if (route.query.maxPriceCents) q.maxPriceCents = Number(route.query.maxPriceCents)
  if (route.query.q) q.q = route.query.q as string
  return q
})

const { data, pending } = await useApiFetch<ProductListResponse>('/products', {
  query,
  watch: [query]
})

function updateQuery(patch: Record<string, string | number | undefined>) {
  router.push({
    query: { ...route.query, ...patch, page: patch.page === undefined ? 1 : patch.page }
  })
}

function onSearchSubmit() {
  updateQuery({ q: searchInput.value || undefined })
}

const totalPages = computed(() => (data.value ? Math.ceil(data.value.total / data.value.pageSize) : 1))
const currentPage = computed(() => Number(route.query.page ?? 1))

watchEffect(() => {
  if (data.value?.items.length) sd.itemList(data.value.items, 'Amalice catalog')
})
</script>

<template>
  <TemplatePage
    name="Catalog"
    :page-props="{
      data,
      pending,
      categories,
      categoryOptions,
      searchInput: searchInput ?? '',
      routeQuery: route.query,
      totalPages,
      currentPage,
      onSearchSubmit,
      onUpdateSearchInput: (v: string) => (searchInput = v),
      onUpdateQuery: updateQuery
    }"
  />
</template>
