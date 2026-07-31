<script setup lang="ts">
import type { Category } from '@amalice/shared'

const settings = useStoreSettings()
const { data: categories } = await useApiFetch<Category[]>('/categories', { key: 'store-categories' })
</script>

<template>
  <footer class="mt-24 border-t border-default bg-default">
    <div class="mx-auto max-w-6xl px-4 py-12">
      <p class="mb-8 text-center text-2xl font-bold tracking-tight text-highlighted">{{ settings.storeName }}</p>
      <div class="grid grid-cols-2 gap-8 text-sm md:grid-cols-4">
        <div>
          <h3 class="kicker mb-3">Shop</h3>
          <ul class="space-y-2">
            <li><NuxtLink to="/catalog" class="hover:text-highlighted">All products</NuxtLink></li>
            <li v-for="cat in categories" :key="cat.id"><NuxtLink :to="`/collections/${cat.slug}`" class="hover:text-highlighted">{{ cat.name }}</NuxtLink></li>
          </ul>
        </div>
        <div>
          <h3 class="kicker mb-3">Service</h3>
          <ul class="space-y-2">
            <li><NuxtLink to="/contact" class="hover:text-highlighted">Contact</NuxtLink></li>
            <li><NuxtLink to="/faq" class="hover:text-highlighted">FAQ</NuxtLink></li>
            <li><NuxtLink to="/shipping" class="hover:text-highlighted">Shipping</NuxtLink></li>
            <li><NuxtLink to="/track" class="hover:text-highlighted">Track order</NuxtLink></li>
          </ul>
        </div>
        <div>
          <h3 class="kicker mb-3">Company</h3>
          <ul class="space-y-2">
            <li><NuxtLink to="/about" class="hover:text-highlighted">About</NuxtLink></li>
            <li><NuxtLink to="/terms" class="hover:text-highlighted">Terms</NuxtLink></li>
            <li><NuxtLink to="/privacy" class="hover:text-highlighted">Privacy</NuxtLink></li>
          </ul>
        </div>
        <div>
          <h3 class="kicker mb-3">Promise</h3>
          <ul class="space-y-2">
            <li class="flex items-center gap-2"><Icon name="i-lucide-banknote" class="size-4" /> Cash on delivery</li>
            <li class="flex items-center gap-2"><Icon name="i-lucide-shield-check" class="size-4" /> Confirmed by phone</li>
          </ul>
        </div>
      </div>
      <p class="mt-10 text-center text-xs text-muted">© {{ new Date().getFullYear() }} {{ settings.storeName }}</p>
    </div>
  </footer>
</template>
