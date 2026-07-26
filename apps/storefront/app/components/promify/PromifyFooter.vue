<script setup lang="ts">
import type { Category } from '@amalice/shared'

const settings = useStoreSettings()
const { data: categories } = await useApiFetch<Category[]>('/categories', { key: 'store-categories' })
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-neutral-200 bg-neutral-50">
    <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="grid grid-cols-2 gap-8 md:grid-cols-4">
        <!-- Brand -->
        <div class="col-span-2 md:col-span-1">
          <div class="flex items-center gap-2">
            <div class="flex size-8 items-center justify-center rounded-lg bg-primary-600">
              <span class="text-sm font-bold text-white">{{ settings.storeName.charAt(0) }}</span>
            </div>
            <span class="text-lg font-bold text-neutral-900">{{ settings.storeName }}</span>
          </div>
          <p class="mt-3 text-sm text-neutral-500">Cash on delivery, no account required. Pay when it arrives.</p>
          <div class="mt-4 flex gap-2">
            <PromifyButton icon="i-lucide-facebook" color="neutral" variant="ghost" square class="!size-8 !rounded-full" aria-label="Facebook" />
            <PromifyButton icon="i-lucide-instagram" color="neutral" variant="ghost" square class="!size-8 !rounded-full" aria-label="Instagram" />
            <PromifyButton icon="i-lucide-twitter" color="neutral" variant="ghost" square class="!size-8 !rounded-full" aria-label="Twitter" />
          </div>
        </div>

        <!-- Shop -->
        <div>
          <h3 class="text-sm font-semibold text-neutral-900">Shop</h3>
          <ul class="mt-3 space-y-2 text-sm text-neutral-500">
            <li><NuxtLink to="/catalog" class="transition-colors hover:text-primary-600">All products</NuxtLink></li>
            <li v-for="cat in (categories ?? []).slice(0, 4)" :key="cat.id">
              <NuxtLink :to="`/collections/${cat.slug}`" class="transition-colors hover:text-primary-600">{{ cat.name }}</NuxtLink>
            </li>
            <li><NuxtLink to="/deals" class="transition-colors hover:text-primary-600">Today's deals</NuxtLink></li>
            <li><NuxtLink to="/new-arrivals" class="transition-colors hover:text-primary-600">New arrivals</NuxtLink></li>
          </ul>
        </div>

        <!-- Help -->
        <div>
          <h3 class="text-sm font-semibold text-neutral-900">Help</h3>
          <ul class="mt-3 space-y-2 text-sm text-neutral-500">
            <li><NuxtLink to="/contact" class="transition-colors hover:text-primary-600">Contact us</NuxtLink></li>
            <li><NuxtLink to="/faq" class="transition-colors hover:text-primary-600">FAQ</NuxtLink></li>
            <li><NuxtLink to="/shipping" class="transition-colors hover:text-primary-600">Shipping</NuxtLink></li>
            <li><NuxtLink to="/returns" class="transition-colors hover:text-primary-600">Returns</NuxtLink></li>
            <li><NuxtLink to="/track" class="transition-colors hover:text-primary-600">Track order</NuxtLink></li>
          </ul>
        </div>

        <!-- Company -->
        <div>
          <h3 class="text-sm font-semibold text-neutral-900">Company</h3>
          <ul class="mt-3 space-y-2 text-sm text-neutral-500">
            <li><NuxtLink to="/about" class="transition-colors hover:text-primary-600">About</NuxtLink></li>
            <li><NuxtLink to="/blog" class="transition-colors hover:text-primary-600">Blog</NuxtLink></li>
            <li><NuxtLink to="/careers" class="transition-colors hover:text-primary-600">Careers</NuxtLink></li>
            <li><NuxtLink to="/press" class="transition-colors hover:text-primary-600">Press</NuxtLink></li>
            <li><NuxtLink to="/terms" class="transition-colors hover:text-primary-600">Terms</NuxtLink></li>
            <li><NuxtLink to="/privacy" class="transition-colors hover:text-primary-600">Privacy</NuxtLink></li>
          </ul>
        </div>
      </div>

      <div class="mt-10 flex flex-col items-center justify-between gap-4 border-t border-neutral-200 pt-6 sm:flex-row">
        <p class="text-xs text-neutral-500">© {{ year }} {{ settings.storeName }}. Cash on delivery commerce.</p>
        <div class="flex items-center gap-4 text-xs text-neutral-400">
          <span class="flex items-center gap-1"><Icon name="i-lucide-banknote" class="size-4" /> COD</span>
          <span class="flex items-center gap-1"><Icon name="i-lucide-shield-check" class="size-4" /> Verified</span>
        </div>
      </div>
    </div>
  </footer>
</template>
