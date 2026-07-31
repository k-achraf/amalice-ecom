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
        <h3 class="mb-3 text-sm font-semibold text-highlighted">المتجر</h3>
        <ul class="space-y-2 text-sm text-muted">
          <li><NuxtLink to="/catalog" class="hover:text-highlighted">كل المنتجات</NuxtLink></li>
          <li v-for="cat in categories" :key="cat.id">
            <NuxtLink :to="`/collections/${cat.slug}`" class="hover:text-highlighted">{{ cat.name }}</NuxtLink>
          </li>
        </ul>
      </div>
      <div>
        <h3 class="mb-3 text-sm font-semibold text-highlighted">خدمة العملاء</h3>
        <ul class="space-y-2 text-sm text-muted">
          <li><NuxtLink to="/contact" class="hover:text-highlighted">اتصل بنا</NuxtLink></li>
          <li><NuxtLink to="/faq" class="hover:text-highlighted">الأسئلة الشائعة</NuxtLink></li>
          <li><NuxtLink to="/shipping" class="hover:text-highlighted">الشحن والتوصيل</NuxtLink></li>
          <li><NuxtLink to="/returns" class="hover:text-highlighted">الإرجاع</NuxtLink></li>
          <li><NuxtLink to="/track" class="hover:text-highlighted">تتبع طلبك</NuxtLink></li>
        </ul>
      </div>
      <div>
        <h3 class="mb-3 text-sm font-semibold text-highlighted">الشركة</h3>
        <ul class="space-y-2 text-sm text-muted">
          <li><NuxtLink to="/about" class="hover:text-highlighted">عن أماليس</NuxtLink></li>
          <li><NuxtLink to="/terms" class="hover:text-highlighted">الشروط والأحكام</NuxtLink></li>
          <li><NuxtLink to="/privacy" class="hover:text-highlighted">سياسة الخصوصية</NuxtLink></li>
        </ul>
      </div>
      <div>
        <h3 class="mb-3 text-sm font-semibold text-highlighted">لماذا أماليس</h3>
        <ul class="space-y-2 text-sm text-muted">
          <li class="flex items-center gap-2"><Icon name="i-lucide-banknote" class="size-4" /> الدفع عند الاستلام</li>
          <li class="flex items-center gap-2"><Icon name="i-lucide-shield-check" class="size-4" /> تأكيد الطلبات هاتفياً</li>
          <li class="flex items-center gap-2"><Icon name="i-lucide-user-x" class="size-4" /> بدون حساب</li>
        </ul>
      </div>
    </div>
    <div class="border-t border-default px-4 py-6 text-center text-xs text-muted">
      © {{ new Date().getFullYear() }} {{ settings.storeName }}. تجارة الدفع عند الاستلام.
    </div>
  </footer>
</template>
