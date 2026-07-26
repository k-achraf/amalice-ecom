<script setup lang="ts">
import type { Category } from '@amalice/shared'

const settings = useStoreSettings()
const { data: categories } = await useApiFetch<Category[]>('/categories', { key: 'store-categories' })
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t-2 border-black bg-black text-white">
    <!-- Hard-shadow newsletter block — punchy, offset above the columns -->
    <div class="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
      <div class="flex flex-col items-start justify-between gap-4 border-2 border-primary-500 bg-black p-6 shadow-[var(--shadow-nova-pop)] sm:flex-row sm:items-center">
        <div>
          <p class="font-display text-lg uppercase text-white">Get the drop first</p>
          <p class="mt-1 text-sm text-white/50">New stock + deals. No spam, unsubscribe anytime.</p>
        </div>
        <form class="flex w-full max-w-sm gap-2 sm:w-auto" @submit.prevent>
          <NovaInput placeholder="you@email.com" icon="i-lucide-mail" class="flex-1" />
          <NovaButton type="submit">Join</NovaButton>
        </form>
      </div>
    </div>

    <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div class="grid grid-cols-2 gap-8 md:grid-cols-4">
        <div class="col-span-2 md:col-span-1">
          <p class="font-display text-2xl uppercase">{{ settings.storeName }}<span class="text-primary-500">.</span></p>
          <p class="mt-3 text-sm text-white/60">Cash on delivery, no account required. Pay when it arrives.</p>
          <div class="mt-4 flex gap-2">
            <a href="#" class="flex size-9 items-center justify-center border-2 border-white/30 text-white transition-colors hover:border-primary-500 hover:text-primary-500" aria-label="Facebook"><Icon name="i-lucide-facebook" class="size-4" /></a>
            <a href="#" class="flex size-9 items-center justify-center border-2 border-white/30 text-white transition-colors hover:border-primary-500 hover:text-primary-500" aria-label="Instagram"><Icon name="i-lucide-instagram" class="size-4" /></a>
            <a href="#" class="flex size-9 items-center justify-center border-2 border-white/30 text-white transition-colors hover:border-primary-500 hover:text-primary-500" aria-label="Twitter"><Icon name="i-lucide-twitter" class="size-4" /></a>
          </div>
        </div>

        <div>
          <h3 class="text-xs font-bold uppercase tracking-wide text-primary-500">Shop</h3>
          <ul class="mt-3 space-y-2 text-sm text-white/70">
            <li><NuxtLink to="/catalog" class="transition-colors hover:text-white">All products</NuxtLink></li>
            <li v-for="cat in (categories ?? []).slice(0, 4)" :key="cat.id"><NuxtLink :to="`/collections/${cat.slug}`" class="transition-colors hover:text-white">{{ cat.name }}</NuxtLink></li>
            <li><NuxtLink to="/deals" class="transition-colors hover:text-white">Today's deals</NuxtLink></li>
            <li><NuxtLink to="/new-arrivals" class="transition-colors hover:text-white">New arrivals</NuxtLink></li>
          </ul>
        </div>

        <div>
          <h3 class="text-xs font-bold uppercase tracking-wide text-primary-500">Help</h3>
          <ul class="mt-3 space-y-2 text-sm text-white/70">
            <li><NuxtLink to="/contact" class="transition-colors hover:text-white">Contact us</NuxtLink></li>
            <li><NuxtLink to="/faq" class="transition-colors hover:text-white">FAQ</NuxtLink></li>
            <li><NuxtLink to="/shipping" class="transition-colors hover:text-white">Shipping</NuxtLink></li>
            <li><NuxtLink to="/returns" class="transition-colors hover:text-white">Returns</NuxtLink></li>
            <li><NuxtLink to="/track" class="transition-colors hover:text-white">Track order</NuxtLink></li>
          </ul>
        </div>

        <div>
          <h3 class="text-xs font-bold uppercase tracking-wide text-primary-500">Company</h3>
          <ul class="mt-3 space-y-2 text-sm text-white/70">
            <li><NuxtLink to="/about" class="transition-colors hover:text-white">About</NuxtLink></li>
            <li><NuxtLink to="/blog" class="transition-colors hover:text-white">Blog</NuxtLink></li>
            <li><NuxtLink to="/careers" class="transition-colors hover:text-white">Careers</NuxtLink></li>
            <li><NuxtLink to="/terms" class="transition-colors hover:text-white">Terms</NuxtLink></li>
            <li><NuxtLink to="/privacy" class="transition-colors hover:text-white">Privacy</NuxtLink></li>
          </ul>
        </div>
      </div>

      <div class="mt-10 flex flex-col items-center justify-between gap-4 border-t-2 border-white/20 pt-6 sm:flex-row">
        <p class="text-xs text-white/50">© {{ year }} {{ settings.storeName }}. Cash on delivery commerce.</p>
        <div class="flex items-center gap-4 text-xs text-white/50">
          <span class="flex items-center gap-1"><Icon name="i-lucide-banknote" class="size-3.5" /> COD</span>
          <span class="flex items-center gap-1"><Icon name="i-lucide-shield-check" class="size-3.5" /> Verified</span>
        </div>
      </div>
    </div>
  </footer>
</template>
