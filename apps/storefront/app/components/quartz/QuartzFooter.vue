<script setup lang="ts">
// Quartz footer — trust badges + bare-minimum utility links, same
// generic-store convention as the header (no category tree).
const settings = useStoreSettings()
</script>

<template>
  <footer class="mt-16 border-t border-neutral-200 bg-white">
    <div class="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <QuartzTrustRow />

      <div class="mt-8 flex flex-col items-center gap-3 border-t border-neutral-100 pt-6 text-center">
        <span class="font-display text-lg font-medium text-neutral-900">{{ settings.storeName }}</span>
        <nav class="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs font-medium text-neutral-500">
          <NuxtLink to="/track" class="hover:text-primary-700">تتبع طلبي</NuxtLink>
          <NuxtLink to="/contact" class="hover:text-primary-700">اتصل بنا</NuxtLink>
          <NuxtLink to="/faq" class="hover:text-primary-700">الأسئلة الشائعة</NuxtLink>
          <NuxtLink to="/terms" class="hover:text-primary-700">الشروط</NuxtLink>
          <NuxtLink to="/privacy" class="hover:text-primary-700">الخصوصية</NuxtLink>
        </nav>
        <p class="text-[11px] text-neutral-500">© {{ new Date().getFullYear() }} {{ settings.storeName }} — تجارة الدفع عند الاستلام.</p>
      </div>
    </div>
  </footer>
</template>
