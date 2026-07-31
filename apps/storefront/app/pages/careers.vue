<script setup lang="ts">
// Careers — static content (no jobs model). Perks grid + open roles list.
useSeoMeta({ title: 'الوظائف', description: 'انضم إلى فريق بناء منصة التجارة القائمة على الدفع عند الاستلام.' })

const perks = [
  { icon: 'i-lucide-rocket', title: 'عمل ذو معنى', body: 'كل طلب تساهم في شحنه يصل إلى زبون حقيقي يدفع نقداً عند بابه.' },
  { icon: 'i-lucide-clock', title: 'ساعات عمل مرنة', body: 'نقيّم النتائج لا ساعات الحضور. العمل عن بُعد متاح افتراضياً.' },
  { icon: 'i-lucide-heart-pulse', title: 'الصحة أولاً', body: 'تغطية صحية شاملة لك ولمن تعيلهم.' },
  { icon: 'i-lucide-graduation-cap', title: 'ميزانية تعلّم', body: 'ميزانية سنوية للدورات والكتب والمؤتمرات.' }
]

const openings = [
  { title: 'مهندس باكند أول', department: 'الهندسة', location: 'عن بُعد', type: 'دوام كامل' },
  { title: 'مهندس فرونت إند (Nuxt/Vue)', department: 'الهندسة', location: 'عن بُعد', type: 'دوام كامل' },
  { title: 'مدير عمليات', department: 'العمليات', location: 'حضوري', type: 'دوام كامل' },
  { title: 'مسؤول دعم الزبائن', department: 'الدعم', location: 'عن بُعد', type: 'دوام كامل' },
  { title: 'عامل مستودع', department: 'العمليات', location: 'حضوري', type: 'دوام كامل' }
]
</script>

<template>
  <div>
    <div class="border-b border-neutral-200 bg-neutral-50">
      <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h1 class="text-3xl font-bold text-neutral-900 sm:text-4xl">ابنِ معنا مستقبل التجارة بالدفع عند الاستلام</h1>
        <p class="mt-3 max-w-2xl text-neutral-500">نحن فريق صغير نبني منصة دفع عند الاستلام لزبائن يستحقون تجربة شراء يمكنهم الوثوق بها. انضم إلينا.</p>
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
      <h2 class="mb-6 text-2xl font-bold text-neutral-900">الوظائف الشاغرة</h2>
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
          <UButton color="neutral" variant="outline" trailing-icon="i-lucide-arrow-right">تقدّم الآن</UButton>
        </div>
      </div>
    </section>
  </div>
</template>
