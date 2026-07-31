<script setup lang="ts">
import type { Category } from '@amalice/shared'

defineProps<{ categories: Category[] }>()
</script>

<template>
  <section v-if="categories?.length" class="mx-auto max-w-7xl px-4 py-16">
    <h2 class="mb-6 text-2xl font-semibold">تسوق حسب الفئة</h2>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="cat in categories"
        :key="cat.id"
        :to="`/collections/${cat.slug}`"
        class="group relative overflow-hidden rounded-lg border border-default transition-shadow hover:shadow-[var(--shadow-polaris-200)]"
      >
        <div class="aspect-[4/3] bg-elevated">
          <NuxtImg
            v-if="cat.imageUrl"
            :src="cat.imageUrl"
            :alt="cat.name"
            class="size-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
            width="600"
            height="450"
            loading="lazy"
            format="webp"
          />
        </div>
        <div class="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/60 to-transparent p-4">
          <h3 class="text-lg font-semibold text-white">{{ cat.name }}</h3>
          <p v-if="cat.description" class="text-sm text-white/80">{{ cat.description }}</p>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>
