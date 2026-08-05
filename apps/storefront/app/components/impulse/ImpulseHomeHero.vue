<script setup lang="ts">
// Impulse home hero — a funnel LANDING SECTION, not a storefront banner:
// centered single column, one claim, one highlighted risk-reversal phrase,
// one pulsing CTA, a scroll cue — and nothing else competing for the click.
const settings = useStoreSettings()
</script>

<template>
  <section class="bg-white">
    <div class="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 pb-14 pt-16 text-center sm:px-6">
      <ImpulseBadge color="yellow" variant="solid">
        <Icon name="i-lucide-flame" class="size-3.5" />
        موثوق من طرف أكثر من 10,000 زبون سعيد
      </ImpulseBadge>

      <h1 class="font-display text-4xl font-black uppercase leading-[1.05] text-neutral-900 sm:text-6xl">
        اطلب اليوم.
        <br>
        <span class="marker">ادفع عند الوصول.</span>
      </h1>

      <p class="max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
        بدون بطاقة. بدون حساب. بدون مخاطرة. اختر ما يعجبك، نتصل بك للتأكيد،
        وتدفع نقداً فقط عندما يصل الطرد إلى يديك.
      </p>

      <ImpulseButton to="/catalog" size="xl" pulse trailing-icon="i-lucide-arrow-left">
        تسوق العروض
      </ImpulseButton>

      <div class="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs font-semibold text-neutral-500">
        <span class="flex items-center gap-1"><Icon name="i-lucide-check" class="size-3.5 text-[var(--color-impulse-green)]" /> الدفع عند الاستلام</span>
        <span class="flex items-center gap-1"><Icon name="i-lucide-check" class="size-3.5 text-[var(--color-impulse-green)]" /> إرجاع سهل</span>
      </div>

      <Icon name="i-lucide-chevrons-down" class="bounce-cue size-6 text-neutral-300" />
    </div>

    <ImpulseTicker />
  </section>
</template>
