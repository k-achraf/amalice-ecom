<script setup lang="ts">
// Press — static brand-assets + mentions page.
useSeoMeta({ title: 'Press', description: 'Brand assets and press contact.' })
</script>

<template>
  <div>
    <div class="border-b border-neutral-200 bg-neutral-50">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h1 class="text-3xl font-bold text-neutral-900 sm:text-4xl">Press &amp; brand</h1>
        <p class="mt-3 max-w-2xl text-neutral-500">Resources for journalists, partners, and anyone writing about us.</p>
      </div>
    </div>

    <div class="mx-auto max-w-7xl space-y-12 px-4 py-12 sm:px-6 lg:px-8">
      <!-- Brand assets -->
      <section>
        <h2 class="mb-6 text-2xl font-bold text-neutral-900">Brand assets</h2>
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div class="rounded-2xl border border-neutral-100 bg-white p-8 text-center">
            <div class="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary-600">
              <span class="text-2xl font-bold text-white">A</span>
            </div>
            <h3 class="font-semibold text-neutral-900">Logo</h3>
            <p class="mt-1 text-sm text-neutral-500">Primary mark on light/dark</p>
          </div>
          <div class="rounded-2xl border border-neutral-100 bg-white p-8 text-center">
            <div class="mx-auto mb-4 size-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700" />
            <h3 class="font-semibold text-neutral-900">Palette</h3>
            <p class="mt-1 text-sm text-neutral-500">Primary blue ramp + neutrals</p>
          </div>
          <div class="rounded-2xl border border-neutral-100 bg-white p-8 text-center">
            <div class="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-neutral-100">
              <span class="text-xl font-bold text-neutral-900">Aa</span>
            </div>
            <h3 class="font-semibold text-neutral-900">Typography</h3>
            <p class="mt-1 text-sm text-neutral-500">Inter — our typeface</p>
          </div>
        </div>
      </section>

      <!-- Press mentions -->
      <section>
        <h2 class="mb-6 text-2xl font-bold text-neutral-900">In the news</h2>
        <div class="space-y-4">
          <article
            v-for="mention in [
              { outlet: 'Tech Daily', title: 'How this startup made cash-on-delivery work at scale', date: 'Jul 2026' },
              { outlet: 'Retail Wire', title: 'The checkout that asks for a phone code, not a card', date: 'Jun 2026' },
              { outlet: 'Logistics Weekly', title: 'Inside the courier network behind COD commerce', date: 'May 2026' }
            ]"
            :key="mention.title"
            class="flex flex-col gap-1 rounded-2xl border border-neutral-100 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <span class="text-xs font-semibold uppercase tracking-wide text-primary-600">{{ mention.outlet }}</span>
              <h3 class="mt-1 font-semibold text-neutral-900">{{ mention.title }}</h3>
            </div>
            <span class="text-sm text-neutral-400">{{ mention.date }}</span>
          </article>
        </div>
      </section>

      <!-- Contact -->
      <section class="rounded-2xl bg-primary-600 p-8 text-center text-white sm:p-12">
        <h2 class="text-2xl font-bold">Press inquiries</h2>
        <p class="mx-auto mt-2 max-w-md text-white/80">For interviews, quotes, or product demos, reach our team directly.</p>
        <UButton to="/contact" class="mt-6 !bg-white !text-primary-600 hover:!bg-white/90">Contact press</UButton>
      </section>
    </div>
  </div>
</template>
