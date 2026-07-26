<script setup lang="ts">
import type { Category } from '@amalice/shared'

const settings = useStoreSettings()
// Reuse the same categories fetch the header uses (Nuxt dedupes by key).
const { data: categories } = await useApiFetch<Category[]>('/categories', { key: 'store-categories' })
</script>

<template>
  <footer class="mt-12 border-t border-default bg-default">
    <div class="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 md:grid-cols-4">
      <div>
        <h3 class="mb-3 text-sm font-semibold text-highlighted">Shop</h3>
        <ul class="space-y-2 text-sm text-muted">
          <li><NuxtLink to="/catalog" class="hover:text-highlighted">All products</NuxtLink></li>
          <li v-for="cat in categories" :key="cat.id">
            <NuxtLink :to="`/collections/${cat.slug}`" class="hover:text-highlighted">{{ cat.name }}</NuxtLink>
          </li>
        </ul>
      </div>
      <div>
        <h3 class="mb-3 text-sm font-semibold text-highlighted">Customer service</h3>
        <ul class="space-y-2 text-sm text-muted">
          <li><NuxtLink to="/contact" class="hover:text-highlighted">Contact us</NuxtLink></li>
          <li><NuxtLink to="/faq" class="hover:text-highlighted">FAQ</NuxtLink></li>
          <li><NuxtLink to="/shipping" class="hover:text-highlighted">Shipping &amp; delivery</NuxtLink></li>
          <li><NuxtLink to="/returns" class="hover:text-highlighted">Returns</NuxtLink></li>
          <li><NuxtLink to="/track" class="hover:text-highlighted">Track your order</NuxtLink></li>
        </ul>
      </div>
      <div>
        <h3 class="mb-3 text-sm font-semibold text-highlighted">Company</h3>
        <ul class="space-y-2 text-sm text-muted">
          <li><NuxtLink to="/about" class="hover:text-highlighted">About Amalice</NuxtLink></li>
          <li><NuxtLink to="/terms" class="hover:text-highlighted">Terms of service</NuxtLink></li>
          <li><NuxtLink to="/privacy" class="hover:text-highlighted">Privacy policy</NuxtLink></li>
        </ul>
      </div>
      <div>
        <h3 class="mb-3 text-sm font-semibold text-highlighted">Why Amalice</h3>
        <ul class="space-y-2 text-sm text-muted">
          <li class="flex items-center gap-2"><Icon name="i-lucide-banknote" class="size-4" /> Cash on delivery</li>
          <li class="flex items-center gap-2"><Icon name="i-lucide-shield-check" class="size-4" /> Phone-verified orders</li>
          <li class="flex items-center gap-2"><Icon name="i-lucide-user-x" class="size-4" /> No account needed</li>
        </ul>
      </div>
    </div>
    <div class="border-t border-default px-4 py-6 text-center text-xs text-muted">
      © {{ new Date().getFullYear() }} {{ settings.storeName }}. Cash on delivery commerce.
    </div>
  </footer>
</template>
