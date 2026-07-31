<script setup lang="ts">
// Blog index — static content (no blog model in Amalice yet). A featured post
// + a grid of post cards. Same v1 scope decision as the other CMS pages: real
// content authoring is a CMS, out of scope; this ships the structure + placeholder
// copy so the page exists and renders on-brand.
useSeoMeta({ title: 'المدونة', description: 'قصص وأدلة وآخر مستجدات فريقنا.' })

const featured = {
  title: 'كيف يبني الدفع عند الاستلام الثقة حيث تفشل البطاقات',
  excerpt: 'بالنسبة للزبائن الذين لم يثقوا يوماً بالدفع الإلكتروني، يزيل الدفع عند الاستلام المخاطرة تماماً. إليك ما تعلمناه من تطبيقه.',
  category: 'رؤى',
  date: 'يوليو 2026'
}

const posts = [
  { title: 'اتصال التأكيد من مركز الاتصال، بالتفصيل', category: 'أدلة', date: 'يوليو 2026', excerpt: 'لماذا تُعد المكالمة الهاتفية السريعة أقوى إجراء لدينا لمكافحة الاحتيال.' },
  { title: 'تحضير طلب الدفع عند الاستلام: ماذا يحدث خلف الكواليس', category: 'خلف الكواليس', date: 'يونيو 2026', excerpt: 'من التأكيد إلى تسليم المندوب — المسار الذي يقطعه كل طلب.' },
  { title: '5 أساسيات يومية تستحق الدفع عند استلامها', category: 'قوائم', date: 'يونيو 2026', excerpt: 'مجموعة مختارة من المنتجات التي تستحق مكاناً في روتينك اليومي.' },
  { title: 'ماذا نفعل عندما يفشل التوصيل', category: 'العمليات', date: 'مايو 2026', excerpt: 'حالات التوصيل الفاشلة تكلّفنا مالاً حقيقياً. إليك كيف نتعامل معها بصدق.' },
  { title: 'لماذا لا نطلب منك إنشاء حساب', category: 'المنتج', date: 'مايو 2026', excerpt: 'الحسابات تضيف عائقاً إضافياً. في نظام الدفع عند الاستلام، رقم هاتفك كافٍ.' },
  { title: 'تعرف على مندوبي التوصيل الذين يوصلون طلباتك', category: 'قصص', date: 'أبريل 2026', excerpt: 'الأشخاص الذين يقفون خلف كل عملية تسليم عند الباب.' }
]
</script>

<template>
  <div>
    <div class="border-b border-neutral-200 bg-neutral-50">
      <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <nav class="mb-4 flex items-center gap-2 text-sm text-neutral-400">
          <NuxtLink to="/" class="transition-colors hover:text-primary-600">الرئيسية</NuxtLink>
          <UIcon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-neutral-600">المدونة</span>
        </nav>
        <h1 class="text-3xl font-bold text-neutral-900 sm:text-4xl">المدونة</h1>
        <p class="mt-2 text-neutral-500">قصص وأدلة وآخر مستجدات فريقنا.</p>
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
          <UButton class="mt-5" color="primary" variant="link" trailing-icon="i-lucide-arrow-right">اقرأ المزيد</UButton>
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
