<script setup lang="ts">
// Careers — static content (no jobs model). Perks grid + open roles list.
useSeoMeta({ title: 'Careers', description: 'Join the team building the COD commerce platform.' })

const perks = [
  { icon: 'i-lucide-rocket', title: 'Meaningful work', body: 'Every order you help ship reaches a real customer paying cash on their doorstep.' },
  { icon: 'i-lucide-clock', title: 'Flexible hours', body: 'We measure outcomes, not hours at a desk. Remote-friendly by default.' },
  { icon: 'i-lucide-heart-pulse', title: 'Health first', body: 'Comprehensive health cover for you and your dependents.' },
  { icon: 'i-lucide-graduation-cap', title: 'Learning budget', body: 'An annual budget for courses, books, and conferences.' }
]

const openings = [
  { title: 'Senior Backend Engineer', department: 'Engineering', location: 'Remote', type: 'Full-time' },
  { title: 'Frontend Engineer (Nuxt/Vue)', department: 'Engineering', location: 'Remote', type: 'Full-time' },
  { title: 'Operations Manager', department: 'Operations', location: 'On-site', type: 'Full-time' },
  { title: 'Customer Support Lead', department: 'Support', location: 'Remote', type: 'Full-time' },
  { title: 'Warehouse Associate', department: 'Operations', location: 'On-site', type: 'Full-time' }
]
</script>

<template>
  <div>
    <div class="border-b border-neutral-200 bg-neutral-50">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h1 class="text-3xl font-bold text-neutral-900 sm:text-4xl">Build the future of COD commerce</h1>
        <p class="mt-3 max-w-2xl text-neutral-500">We are a small team shipping a cash-on-delivery platform for customers who deserve a checkout they can trust. Come help.</p>
      </div>
    </div>

    <!-- Perks -->
    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="perk in perks" :key="perk.title" class="rounded-2xl border border-neutral-100 bg-white p-6">
          <div class="mb-4 flex size-10 items-center justify-center rounded-xl bg-primary-100">
            <UIcon :name="perk.icon" class="size-5 text-primary-600" />
          </div>
          <h3 class="font-semibold text-neutral-900">{{ perk.title }}</h3>
          <p class="mt-1 text-sm text-neutral-500">{{ perk.body }}</p>
        </div>
      </div>
    </section>

    <!-- Open roles -->
    <section class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <h2 class="mb-6 text-2xl font-bold text-neutral-900">Open positions</h2>
      <div class="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        <div
          v-for="(role, i) in openings"
          :key="role.title"
          class="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between"
          :class="i !== openings.length - 1 ? 'border-b border-neutral-100' : ''"
        >
          <div>
            <h3 class="font-semibold text-neutral-900">{{ role.title }}</h3>
            <p class="text-sm text-neutral-500">{{ role.department }} · {{ role.location }} · {{ role.type }}</p>
          </div>
          <UButton color="neutral" variant="outline" trailing-icon="i-lucide-arrow-right">Apply</UButton>
        </div>
      </div>
    </section>
  </div>
</template>
