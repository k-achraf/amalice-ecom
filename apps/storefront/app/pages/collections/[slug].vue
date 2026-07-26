<script setup lang="ts">
import type { Category, ProductListResponse } from '@amalice/shared'

// LOGIC ONLY — collection fetch + price filter + pagination. Presentation via
// <TemplatePage name="Collection">.
const route = useRoute()
const router = useRouter()
const slug = route.params.slug as string
const sd = useStructuredData()

const { data: category, error: catError } = await useApiFetch<Category>(`/categories/${slug}`)
if (catError.value) {
  throw createError({ statusCode: 404, statusMessage: 'Collection not found' })
}

useSeoMeta({
  title: () => category.value?.name,
  description: () => category.value?.description ?? `Shop ${category.value?.name} — cash on delivery.`
})

watchEffect(() => {
  if (category.value) {
    sd.breadcrumbs([
      { name: 'Home', path: '/' },
      { name: 'Collections', path: '/collections' },
      { name: category.value.name, path: `/collections/${slug}` }
    ])
    sd.collection(category.value)
  }
})

const minPrice = ref<number | undefined>(undefined)
const maxPrice = ref<number | undefined>(undefined)

const query = computed(() => {
  const q: Record<string, string | number> = { page: Number(route.query.page ?? 1), pageSize: 12, category: slug }
  if (minPrice.value) q.minPriceCents = minPrice.value * 100
  if (maxPrice.value) q.maxPriceCents = maxPrice.value * 100
  return q
})

const { data, pending } = await useApiFetch<ProductListResponse>('/products', {
  query,
  watch: [query]
})

function applyPrice() {
  router.push({ query: { ...route.query, page: 1 } })
}

const totalPages = computed(() => (data.value ? Math.ceil(data.value.total / data.value.pageSize) : 1))
const currentPage = computed(() => Number(route.query.page ?? 1))
function onPaginate(p: number) {
  router.push({ query: { ...route.query, page: p } })
}
</script>

<template>
  <TemplatePage
    name="Collection"
    :page-props="{
      category,
      data,
      pending,
      minPrice: minPrice ?? undefined,
      maxPrice: maxPrice ?? undefined,
      totalPages,
      currentPage,
      onApplyPrice: applyPrice,
      onUpdateMinPrice: (v: number | undefined) => (minPrice = v),
      onUpdateMaxPrice: (v: number | undefined) => (maxPrice = v),
      onPaginate
    }"
  />
</template>
