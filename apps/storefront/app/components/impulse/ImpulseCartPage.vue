<script setup lang="ts">
import type { CartItem, RevalidationResult } from '~/stores/cart'

// Impulse cart — the pre-checkout squeeze page: items on top, then ONE
// pulsing "Complete my order" CTA with the free-shipping + COD value stack
// restated right beside it. Line totals use lineTotalCents (offer-aware).
const props = defineProps<{
  cart: {
    items: CartItem[]
    itemCount: number
    totalCents: number
    setQuantity: (productId: string, quantity: number) => void
    removeItem: (productId: string) => void
  }
  notice: RevalidationResult | null
  revalidating: boolean
  onDismissNotice: () => void
}>()
</script>

<template>
  <div class="bg-neutral-50">
    <section class="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 class="mb-6 text-center font-display text-3xl font-black uppercase text-neutral-900">
        أنت <span class="marker">على وشك الانتهاء</span>
      </h1>

      <div v-if="props.notice" class="funnel-card mb-4 flex items-start justify-between gap-3 border-[var(--color-impulse-yellow)] bg-[var(--color-impulse-yellow-soft)] p-4 text-sm">
        <div class="space-y-1 text-neutral-800">
          <p v-for="(name, i) in props.notice.removed" :key="`r-${i}`">"{{ name }}" لم يعد متوفراً وتمت إزالته.</p>
          <p v-for="(change, i) in props.notice.changed" :key="`c-${i}`">تغيّر سعر "{{ change.name }}".</p>
          <p v-for="(offer, i) in props.notice.offersChanged" :key="`o-${i}`">تغيّر العرض على "{{ offer.name }}" — تم تطبيق السعر العادي.</p>
        </div>
        <button class="text-neutral-500 hover:text-neutral-900" aria-label="إغلاق" @click="props.onDismissNotice">
          <Icon name="i-lucide-x" class="size-4" />
        </button>
      </div>

      <ClientOnly>
        <div v-if="props.cart.items.length === 0" class="py-20 text-center">
          <Icon name="i-lucide-shopping-cart" class="mx-auto mb-3 size-10 text-neutral-300" />
          <p class="mb-1 font-bold text-neutral-900">سلتك فارغة.</p>
          <p class="mb-5 text-sm text-neutral-500">العروض بانتظارك — الدفع عند الاستلام، بدون أي مخاطرة.</p>
          <ImpulseButton to="/catalog" size="lg" pulse trailing-icon="i-lucide-arrow-left">شاهد العروض</ImpulseButton>
        </div>

        <template v-else>
          <ul class="space-y-3">
            <li v-for="item in props.cart.items" :key="item.productId" class="funnel-card flex items-center gap-4 p-4">
              <div class="size-16 shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                <NuxtImg v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" class="size-full object-cover" width="64" height="64" />
              </div>
              <div class="min-w-0 flex-1 space-y-1">
                <NuxtLink :to="`/products/${item.slug}`" class="line-clamp-1 text-sm font-bold text-neutral-900 hover:text-primary-600">{{ item.name }}</NuxtLink>
                <ImpulseBadge v-if="item.offerId" color="green" variant="subtle">
                  <Icon name="i-lucide-tag" class="size-3" />
                  تم تطبيق العرض
                </ImpulseBadge>
                <div class="flex items-center gap-3">
                  <ImpulseQuantityStepper :model-value="item.quantity" :min="1" :max="item.stockQuantity" @update:model-value="(v) => props.cart.setQuantity(item.productId, v)" />
                  <button class="text-xs font-semibold text-neutral-400 hover:text-[var(--color-impulse-red)]" @click="props.cart.removeItem(item.productId)">إزالة</button>
                </div>
              </div>
              <PriceDisplay :amount-cents="item.lineTotalCents ?? item.priceCents * item.quantity" class="font-display text-lg font-black text-neutral-900" />
            </li>
          </ul>

          <div class="funnel-card mt-6 space-y-4 border-2 !border-primary-300 p-6">
            <div class="space-y-2 text-sm">
              <div class="flex items-center justify-between"><span class="font-semibold text-neutral-500">المجموع الفرعي</span><PriceDisplay :amount-cents="props.cart.totalCents" class="font-bold" /></div>
              <div class="flex items-center justify-between"><span class="font-semibold text-neutral-500">التوصيل</span><span class="font-bold text-[var(--color-impulse-green)]">مجاني</span></div>
              <div class="flex items-center justify-between border-t border-neutral-100 pt-2">
                <span class="font-bold uppercase text-neutral-900">الدفع عند الاستلام</span>
                <PriceDisplay :amount-cents="props.cart.totalCents" class="font-display text-2xl font-black text-primary-600" />
              </div>
            </div>
            <ImpulseButton to="/checkout" size="xl" block pulse trailing-icon="i-lucide-arrow-left">
              إتمام طلبي
            </ImpulseButton>
            <p class="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-neutral-400">
              <Icon name="i-lucide-shield-check" class="size-3.5 text-[var(--color-impulse-green)]" />
              لن تدفع الآن — الدفع نقداً عند الوصول.
            </p>
          </div>

          <div class="mt-8">
            <ImpulseTrustRow />
          </div>
        </template>

        <template #fallback>
          <div class="flex items-center justify-center py-24 text-neutral-400">
            <Icon name="i-lucide-loader-circle" class="me-2 size-5 animate-spin" /> جارٍ التحميل...
          </div>
        </template>
      </ClientOnly>
    </section>
  </div>
</template>
