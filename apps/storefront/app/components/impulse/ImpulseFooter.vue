<script setup lang="ts">
// Impulse funnel footer — trust badges + the bare-minimum utility links
// (track/contact/terms). No category tree, no social wall: the footer's
// only job is reassurance for the shopper who scrolled everything.
const settings = useStoreSettings()
</script>

<template>
  <footer class="mt-16 border-t-2 border-neutral-200 bg-white">
    <div class="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <ImpulseTrustRow />

      <div class="mt-8 flex flex-col items-center gap-3 border-t border-neutral-100 pt-6 text-center">
        <span class="font-display text-lg font-black uppercase text-neutral-900">{{ settings.storeName }}<span class="text-primary-500">.</span></span>
        <nav class="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs font-semibold text-neutral-500">
          <NuxtLink to="/track" class="hover:text-primary-600">تتبع طلبي</NuxtLink>
          <NuxtLink to="/contact" class="hover:text-primary-600">اتصل بنا</NuxtLink>
          <NuxtLink to="/faq" class="hover:text-primary-600">الأسئلة الشائعة</NuxtLink>
          <NuxtLink to="/terms" class="hover:text-primary-600">الشروط</NuxtLink>
          <NuxtLink to="/privacy" class="hover:text-primary-600">الخصوصية</NuxtLink>
        </nav>
        <p class="text-[11px] text-neutral-600">© {{ new Date().getFullYear() }} {{ settings.storeName }} — تجارة الدفع عند الاستلام.</p>
      </div>
    </div>
  </footer>
</template>
