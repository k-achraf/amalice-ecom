<script setup lang="ts">
// Blog index — static content (no blog model in Amalice yet). A featured post
// + a grid of post cards. Same v1 scope decision as the other CMS pages: real
// content authoring is a CMS, out of scope; this ships the structure + placeholder
// copy so the page exists and renders on-brand.
useSeoMeta({ title: 'Blog', description: 'Stories, guides, and updates from the team.' })

const featured = {
  title: 'How cash-on-delivery builds trust where cards fail',
  excerpt: 'For customers who have never trusted an online checkout, COD removes the risk entirely. Here is what we have learned shipping it.',
  category: 'Insights',
  date: 'July 2026'
}

const posts = [
  { title: 'The phone-OTP checkout, explained', category: 'Guides', date: 'Jul 2026', excerpt: 'Why a 6-digit code is the highest-leverage anti-fraud control we ship.' },
  { title: 'Packing a COD order: what happens behind the scenes', category: 'Behind the scenes', date: 'Jun 2026', excerpt: 'From confirmation to courier handoff — the path an order takes.' },
  { title: '5 everyday essentials worth paying on delivery for', category: 'Lists', date: 'Jun 2026', excerpt: 'A short edit of goods that earn their place in your routine.' },
  { title: 'What we do when a delivery fails', category: 'Operations', date: 'May 2026', excerpt: 'Failed deliveries cost real money. Here is how we handle them honestly.' },
  { title: 'Why we do not ask you to create an account', category: 'Product', date: 'May 2026', excerpt: 'Accounts add friction. For a COD flow, your phone number is enough.' },
  { title: 'Meet the couriers who deliver your orders', category: 'Stories', date: 'Apr 2026', excerpt: 'The people behind every doorstep handoff.' }
]
</script>

<template>
  <div>
    <div class="border-b border-neutral-200 bg-neutral-50">
      <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <nav class="mb-4 flex items-center gap-2 text-sm text-neutral-400">
          <NuxtLink to="/" class="transition-colors hover:text-primary-600">Home</NuxtLink>
          <UIcon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-neutral-600">Blog</span>
        </nav>
        <h1 class="text-3xl font-bold text-neutral-900 sm:text-4xl">The Blog</h1>
        <p class="mt-2 text-neutral-500">Stories, guides, and updates from the team.</p>
      </div>
    </div>

    <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <!-- Featured post -->
      <article class="mb-12 overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm sm:grid sm:grid-cols-2">
        <div class="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-primary-200 to-primary-400 sm:aspect-auto">
          <UIcon name="i-lucide-newspaper" class="size-16 text-white/60" />
        </div>
        <div class="p-6 sm:p-8">
          <div class="flex items-center gap-3 text-xs">
            <span class="rounded-full bg-primary-100 px-2.5 py-0.5 font-semibold text-primary-700">{{ featured.category }}</span>
            <span class="text-neutral-400">{{ featured.date }}</span>
          </div>
          <h2 class="mt-3 text-2xl font-bold text-neutral-900">{{ featured.title }}</h2>
          <p class="mt-3 text-neutral-500">{{ featured.excerpt }}</p>
          <UButton class="mt-5" color="primary" variant="link" trailing-icon="i-lucide-arrow-right">Read more</UButton>
        </div>
      </article>

      <!-- Post grid -->
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="post in posts"
          :key="post.title"
          class="overflow-hidden rounded-2xl border border-neutral-100 bg-white transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-neutral-200/50"
        >
          <div class="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200">
            <UIcon name="i-lucide-image" class="size-10 text-neutral-300" />
          </div>
          <div class="p-5">
            <span class="text-xs font-semibold text-primary-600">{{ post.category }}</span>
            <h3 class="mt-1 font-semibold text-neutral-900">{{ post.title }}</h3>
            <p class="mt-2 text-sm text-neutral-500">{{ post.excerpt }}</p>
            <p class="mt-3 text-xs text-neutral-400">{{ post.date }}</p>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>
