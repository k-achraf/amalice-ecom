<script setup lang="ts">
import type { Product, ProductImage, ProductVariant, RatingSummary, Review, LeadFormField } from '@amalice/shared'

// Promify PDP — 2-col split: gallery + details left, sticky COD order summary
// card right. Variants are rounded-full pills (selected = primary border +
// ring). Glassy summary card with subtotal / shipping / total + "Place Order".
// Promify palette resolves under .tpl-promify.
interface RichProduct extends Product {
  images: ProductImage[]
  variants: ProductVariant[]
  related: Product[]
  categoryRef: { name: string; slug: string } | null
}

const props = defineProps<{
  product: RichProduct | null
  reviewData: { summary: RatingSummary; items: Review[] } | null
  galleryImages: { url: string; alt: string }[]
  activeImageIndex: number
  quantity: number
  added: boolean
  selectedVariantId: string | null
  selectedVariant: ProductVariant | null
  effectivePriceCents: number
  effectiveStock: number
  inStock: boolean
  variantOptions: Record<string, Set<string>>
  displayCart?: boolean
  leadFields?: LeadFormField[]
  leadFormData?: Record<string, string>
  leadPlacing?: boolean
  leadError?: string | null
  onSelectImage: (i: number) => void
  onSelectVariantByKey: (key: string, val: string) => void
  onUpdateQuantity: (v: number) => void
  onAddToCart: () => void
  onSubmitLead?: () => void
}>()
</script>

<template>
  <div v-if="props.product" class="bg-neutral-50">
    <!-- Breadcrumb band -->
    <div class="border-b border-neutral-100 bg-white">
      <nav class="mx-auto flex max-w-7xl items-center gap-2 px-4 py-4 text-sm text-neutral-500 sm:px-6 lg:px-8">
        <NuxtLink to="/" class="transition-colors hover:text-primary-600">Home</NuxtLink>
        <Icon name="i-lucide-chevron-right" class="size-3.5" />
        <NuxtLink to="/catalog" class="transition-colors hover:text-primary-600">Shop</NuxtLink>
        <Icon name="i-lucide-chevron-right" class="size-3.5" />
        <span class="truncate text-neutral-900">{{ props.product.name }}</span>
      </nav>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <!-- Gallery -->
        <div class="space-y-4">
          <div class="aspect-square overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
            <NuxtImg
              v-if="props.galleryImages.length"
              :src="props.galleryImages[props.activeImageIndex]?.url"
              :alt="props.galleryImages[props.activeImageIndex]?.alt"
              class="size-full object-cover"
              width="600"
              height="600"
              loading="eager"
              format="webp"
            />
          </div>
          <div v-if="props.galleryImages.length > 1" class="flex gap-3">
            <button
              v-for="(img, i) in props.galleryImages"
              :key="i"
              class="size-20 overflow-hidden rounded-xl border-2 transition-all"
              :class="i === props.activeImageIndex ? 'border-primary-600 ring-2 ring-primary-200' : 'border-neutral-200 hover:border-primary-300'"
              @click="props.onSelectImage(i)"
            >
              <NuxtImg :src="img.url" :alt="img.alt" class="size-full object-cover" width="80" height="80" loading="lazy" />
            </button>
          </div>
        </div>

        <!-- Detail + order summary -->
        <div class="space-y-6">
          <div>
            <p v-if="props.product.category" class="text-xs font-semibold uppercase tracking-wide text-primary-600">{{ props.product.category }}</p>
            <h1 class="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">{{ props.product.name }}</h1>
          </div>

          <!-- Star rating -->
          <div v-if="props.reviewData?.summary && props.reviewData.summary.count > 0" class="flex items-center gap-2 text-sm">
            <div class="flex">
              <Icon
                v-for="i in 5"
                :key="i"
                name="i-lucide-star"
                class="size-4"
                :class="i <= Math.round(props.reviewData.summary.average ?? 0) ? 'text-amber-400' : 'text-neutral-300'"
              />
            </div>
            <span class="font-medium text-neutral-900">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
            <span class="text-neutral-400">({{ props.reviewData.summary.count }} reviews)</span>
          </div>

          <!-- Price + stock badges -->
          <div class="flex items-center gap-3">
            <PriceDisplay :amount-cents="props.effectivePriceCents" class="text-3xl font-bold text-neutral-900" />
            <PromifyBadge v-if="!props.inStock" color="error">Out of stock</PromifyBadge>
            <PromifyBadge v-else-if="props.effectiveStock <= props.product.lowStockThreshold" color="warning">
              Only {{ props.effectiveStock }} left
            </PromifyBadge>
          </div>

          <p v-if="props.product.description" class="leading-relaxed text-neutral-600">{{ props.product.description }}</p>

          <!-- Variants as rounded-full pills -->
          <div v-for="(values, key) in props.variantOptions" :key="key" class="space-y-3">
            <p class="text-sm font-semibold capitalize text-neutral-900">{{ key }}</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="val in values"
                :key="val"
                class="rounded-full border-2 px-4 py-1.5 text-sm font-medium transition-all"
                :class="props.selectedVariant?.attributes[key] === val
                  ? 'border-primary-600 bg-primary-50 text-primary-700 ring-2 ring-primary-200'
                  : 'border-neutral-200 text-neutral-700 hover:border-primary-400 hover:text-primary-600'"
                @click="props.onSelectVariantByKey(key, val)"
              >
                {{ val }}
              </button>
            </div>
          </div>

          <!-- Sticky add-to-cart panel — stays pinned in the viewport as the
               shopper scrolls past the description/variants above it. -->
          <div class="lg:sticky lg:top-24">
            <!-- Cart mode: COD order summary card -->
            <div v-if="props.displayCart !== false" class="rounded-2xl border border-neutral-100 bg-white p-6 shadow-[var(--shadow-promify-md)]">
              <div class="mb-4 flex items-center gap-2">
                <Icon name="i-lucide-truck" class="size-5 text-primary-600" />
                <h2 class="text-base font-semibold text-neutral-900">Order summary</h2>
              </div>
              <div class="mb-4">
                <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Quantity</p>
                <PromifyQuantityStepper :model-value="props.quantity" :min="1" :max="props.effectiveStock" :disabled="!props.inStock" @update:model-value="props.onUpdateQuantity" />
              </div>
              <div class="space-y-2 border-t border-neutral-100 pt-4 text-sm">
                <div class="flex items-center justify-between"><span class="text-neutral-500">Subtotal</span><PriceDisplay :amount-cents="props.effectivePriceCents * props.quantity" class="font-medium text-neutral-900" /></div>
                <div class="flex items-center justify-between"><span class="text-neutral-500">Shipping</span><span class="font-medium text-primary-600">Free</span></div>
              </div>
              <div class="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4">
                <span class="text-base font-semibold text-neutral-900">Total</span>
                <PriceDisplay :amount-cents="props.effectivePriceCents * props.quantity" class="text-xl font-bold text-neutral-900" />
              </div>
              <p class="mt-2 flex items-center gap-1.5 text-xs text-neutral-400"><Icon name="i-lucide-banknote" class="size-3.5" /> Cash on delivery</p>
              <PromifyButton :disabled="!props.inStock" icon="i-lucide-shopping-bag" size="xl" block class="mt-5" @click="props.onAddToCart">{{ props.inStock ? 'Add to cart' : 'Out of stock' }}</PromifyButton>
              <p v-if="props.added" class="mt-3 flex items-center gap-1.5 text-sm text-emerald-600"><Icon name="i-lucide-check-circle" class="size-4" /> Added to cart.</p>
            </div>

            <!-- Lead form mode -->
            <div v-if="props.displayCart === false && props.inStock" class="rounded-2xl border border-neutral-100 bg-white p-6 shadow-[var(--shadow-promify-md)] space-y-4">
              <div class="flex items-center gap-2">
                <Icon name="i-lucide-banknote" class="size-5 text-primary-600" />
                <h2 class="text-base font-semibold text-neutral-900">Order now — cash on delivery</h2>
              </div>
              <PromifyLeadFormFields :fields="props.leadFields ?? []" :data="props.leadFormData ?? {}" />
              <div class="flex items-center justify-between border-t border-neutral-100 pt-4">
                <span class="text-base font-semibold text-neutral-900">Total</span>
                <PriceDisplay :amount-cents="props.effectivePriceCents * props.quantity" class="text-xl font-bold text-neutral-900" />
              </div>
              <div class="flex items-center gap-3">
                <PromifyQuantityStepper :model-value="props.quantity" :min="1" :max="props.effectiveStock" @update:model-value="props.onUpdateQuantity" />
                <PromifyButton block size="xl" :loading="props.leadPlacing" @click="props.onSubmitLead">Place order</PromifyButton>
              </div>
              <p v-if="props.leadError" class="text-sm text-red-500">{{ props.leadError }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Reviews -->
    <section v-if="props.reviewData" class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div class="rounded-2xl border border-neutral-100 bg-white p-8 shadow-sm">
        <h2 class="mb-6 text-2xl font-bold text-neutral-900">Customer reviews</h2>
        <div v-if="props.reviewData.summary.count > 0" class="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div class="space-y-2">
            <span class="text-4xl font-bold text-neutral-900">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
            <div class="flex">
              <Icon
                v-for="i in 5"
                :key="i"
                name="i-lucide-star"
                class="size-5"
                :class="i <= Math.round(props.reviewData.summary.average ?? 0) ? 'text-amber-400' : 'text-neutral-300'"
              />
            </div>
            <p class="text-sm text-neutral-500">{{ props.reviewData.summary.count }} review{{ props.reviewData.summary.count === 1 ? '' : 's' }}</p>
          </div>
          <div class="space-y-5 lg:col-span-2">
            <div v-for="review in props.reviewData.items" :key="review.id" class="border-b border-neutral-100 pb-5 last:border-0">
              <div class="flex items-center gap-2">
                <div class="flex">
                  <Icon
                    v-for="i in 5"
                    :key="i"
                    name="i-lucide-star"
                    class="size-3.5"
                    :class="i <= review.rating ? 'text-amber-400' : 'text-neutral-300'"
                  />
                </div>
                <span class="text-sm font-medium text-neutral-900">{{ review.customerName ?? 'Verified buyer' }}</span>
              </div>
              <p v-if="review.title" class="mt-2 font-medium text-neutral-900">{{ review.title }}</p>
              <p v-if="review.body" class="mt-1 text-sm leading-relaxed text-neutral-600">{{ review.body }}</p>
            </div>
          </div>
        </div>
        <p v-else class="text-neutral-500">No reviews yet — be the first after your order is delivered.</p>
      </div>
    </section>

    <!-- Related -->
    <section v-if="props.product.related?.length" class="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <h2 class="mb-6 text-2xl font-bold text-neutral-900">You may also like</h2>
      <div class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <TemplateSection v-for="p in props.product.related" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
    </section>
  </div>
</template>
