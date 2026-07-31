<script setup lang="ts">
// Impulse home closing section — the funnel's reassurance stack: how it
// works, the trust row, and a final pulsing CTA. On a funnel home the LAST
// thing before the footer is always another ask.
</script>

<template>
  <section class="mx-auto max-w-3xl space-y-8 px-4 py-12 sm:px-6">
    <ImpulseSteps />
    <ImpulseTrustRow />

    <div class="funnel-card flex flex-col items-center gap-4 p-8 text-center">
      <ImpulseBadge color="green" variant="subtle">
        <Icon name="i-lucide-shield-check" class="size-3.5" />
        ضمان بدون مخاطرة
      </ImpulseBadge>
      <h2 class="font-display text-2xl font-black uppercase text-neutral-900">
        لازلت تفكر؟ <span class="marker">لن تدفع شيئاً اليوم.</span>
      </h2>
      <p class="max-w-md text-sm leading-relaxed text-neutral-600">
        يبقى مالك في جيبك حتى يسلمك عامل التوصيل الطرد. إذا لم يكن كما توقعت،
        ارفضه — مجاناً وبدون أي أسئلة.
      </p>
      <ImpulseButton to="/catalog" size="lg" pulse trailing-icon="i-lucide-arrow-left">
        ابدأ التسوق
      </ImpulseButton>
    </div>
  </section>
</template>
