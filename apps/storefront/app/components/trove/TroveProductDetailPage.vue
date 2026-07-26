<script setup lang="ts">
import type { Product, ProductImage, ProductVariant, RatingSummary, Review, LeadFormField } from '@amalice/shared'

// Trove PDP — a circular main-photo mounted on a sharp frame + trove-card
// order summary. Thumbnails are small circular crops too. Variants as
// sharp-cornered chips. Lead form mode uses TroveLeadFormFields (cascading
// wilaya/commune). No @nuxt/ui anywhere.
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

// Fixed offsets for the satellite thumbnails scattered around the main
// circular photo — echoes the home hero's corkboard collage instead of a
// plain thumbnail row, cycling through a short list of positions regardless
// of how many gallery images there are.
const satellitePositions = ['-left-5 -top-5', '-right-5 -top-6', '-left-7 bottom-2', '-right-4 bottom-6', 'left-1/2 -top-9 -translate-x-1/2']
function satelliteClass(i: number) {
  return satellitePositions[i % satellitePositions.length]
}
</script>

<template>
  <div v-if="props.product" class="bg-white">
    <!-- Breadcrumb -->
    <div class="border-b border-neutral-100">
      <nav class="mx-auto flex max-w-7xl items-center gap-2 px-4 py-4 text-xs font-bold uppercase tracking-wide text-neutral-400 sm:px-6 lg:px-8">
        <NuxtLink to="/" class="hover:text-[var(--color-trove-teal)]">Home</NuxtLink>
        <Icon name="i-lucide-chevron-right" class="size-3" />
        <NuxtLink to="/catalog" class="hover:text-[var(--color-trove-teal)]">Shop</NuxtLink>
        <Icon name="i-lucide-chevron-right" class="size-3" />
        <span class="truncate text-neutral-600">{{ props.product.name }}</span>
      </nav>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <!-- Circular photo mounted on a sharp frame, with satellite
             thumbnails scattered around its edge on larger screens — a
             collage echo of the home hero, rather than a plain row. -->
        <div class="space-y-4">
          <div class="relative mx-auto w-full max-w-md lg:max-w-none">
            <div class="trove-mount aspect-square border border-neutral-200 p-10 shadow-[var(--shadow-trove-md)]">
              <div class="trove-photo relative aspect-square w-full">
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
            </div>

            <template v-if="props.galleryImages.length > 1">
              <button
                v-for="(img, i) in props.galleryImages"
                :key="i"
                class="trove-photo absolute z-10 hidden size-16 shrink-0 ring-2 transition-all sm:block lg:size-20"
                :class="[i === props.activeImageIndex ? 'ring-primary-500' : 'ring-transparent hover:ring-primary-300', satelliteClass(i)]"
                :aria-label="`View image ${i + 1}`"
                @click="props.onSelectImage(i)"
              >
                <NuxtImg :src="img.url" :alt="img.alt" class="size-full object-cover" width="80" height="80" loading="lazy" />
              </button>
            </template>
          </div>

          <!-- Mobile fallback: plain scrollable row instead of scattered satellites -->
          <div v-if="props.galleryImages.length > 1" class="flex gap-3 overflow-x-auto sm:hidden">
            <button
              v-for="(img, i) in props.galleryImages"
              :key="i"
              class="trove-photo size-16 shrink-0 ring-2 transition-all"
              :class="i === props.activeImageIndex ? 'ring-primary-500' : 'ring-transparent hover:ring-primary-300'"
              @click="props.onSelectImage(i)"
            >
              <NuxtImg :src="img.url" :alt="img.alt" class="size-full object-cover" width="64" height="64" loading="lazy" />
            </button>
          </div>
        </div>

        <!-- Detail + order summary -->
        <div class="space-y-6">
          <div>
            <p v-if="props.product.category" class="text-xs font-bold uppercase tracking-[0.1em] text-[var(--color-trove-teal)]">{{ props.product.category }}</p>
            <h1 class="font-display mt-1 text-3xl text-[var(--color-trove-ink)] sm:text-4xl">{{ props.product.name }}</h1>
          </div>

          <!-- Star rating -->
          <div v-if="props.reviewData?.summary && props.reviewData.summary.count > 0" class="flex items-center gap-2 text-sm">
            <div class="flex">
              <Icon
                v-for="i in 5"
                :key="i"
                name="i-lucide-star"
                class="size-4"
                :class="i <= Math.round(props.reviewData.summary.average ?? 0) ? 'text-primary-500' : 'text-neutral-200'"
              />
            </div>
            <span class="font-medium text-[var(--color-trove-ink)]">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
            <span class="text-neutral-400">({{ props.reviewData.summary.count }} reviews)</span>
          </div>

          <!-- Price + stock badges -->
          <div class="flex items-center gap-3">
            <PriceDisplay :amount-cents="props.effectivePriceCents" class="text-3xl font-bold text-primary-700" />
            <TroveBadge v-if="!props.inStock" color="error">Out of stock</TroveBadge>
            <TroveBadge v-else-if="props.effectiveStock <= props.product.lowStockThreshold" color="teal">Only {{ props.effectiveStock }} left</TroveBadge>
          </div>

          <p v-if="props.product.description" class="leading-relaxed text-neutral-600">{{ props.product.description }}</p>

          <!-- Variants as sharp-cornered chips -->
          <div v-for="(values, key) in props.variantOptions" :key="key" class="space-y-3">
            <p class="text-sm font-bold capitalize text-[var(--color-trove-ink)]">{{ key }}</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="val in values"
                :key="val"
                class="rounded border px-4 py-1.5 text-sm font-medium transition-all"
                :class="props.selectedVariant?.attributes[key] === val
                  ? 'border-primary-500 bg-primary-50 text-primary-800'
                  : 'border-neutral-200 text-neutral-600 hover:border-primary-300'"
                @click="props.onSelectVariantByKey(key, val)"
              >
                {{ val }}
              </button>
            </div>
          </div>

          <!-- Cart mode: COD order summary card -->
          <div v-if="props.displayCart !== false" class="trove-card p-6">
            <div class="mb-4 flex items-center gap-2">
              <Icon name="i-lucide-truck" class="size-5 text-primary-700" />
              <h2 class="font-display text-xl text-[var(--color-trove-ink)]">Order summary</h2>
            </div>
            <div class="mb-4">
              <p class="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">Quantity</p>
              <TroveQuantityStepper :model-value="props.quantity" :min="1" :max="props.effectiveStock" :disabled="!props.inStock" @update:model-value="props.onUpdateQuantity" />
            </div>
            <div class="space-y-2 border-t border-neutral-100 pt-4 text-sm">
              <div class="flex items-center justify-between"><span class="text-neutral-500">Subtotal</span><PriceDisplay :amount-cents="props.effectivePriceCents * props.quantity" class="font-medium" /></div>
              <div class="flex items-center justify-between"><span class="text-neutral-500">Shipping</span><span class="font-bold text-primary-700">Free</span></div>
            </div>
            <div class="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4">
              <span class="font-medium text-[var(--color-trove-ink)]">Total</span>
              <PriceDisplay :amount-cents="props.effectivePriceCents * props.quantity" class="text-xl font-bold text-primary-700" />
            </div>
            <p class="mt-2 flex items-center gap-1.5 text-xs text-neutral-400"><Icon name="i-lucide-banknote" class="size-3.5" /> Cash on delivery</p>
            <TroveButton :disabled="!props.inStock" icon="i-lucide-shopping-bag" size="lg" block class="mt-5" @click="props.onAddToCart">{{ props.inStock ? 'Add to cart' : 'Out of stock' }}</TroveButton>
            <p v-if="props.added" class="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary-700"><Icon name="i-lucide-check-circle" class="size-4" /> Added to cart.</p>
          </div>

          <!-- Lead form mode -->
          <div v-if="props.displayCart === false && props.inStock" class="trove-card space-y-4 p-6">
            <div class="flex items-center gap-2">
              <Icon name="i-lucide-banknote" class="size-5 text-primary-700" />
              <h2 class="font-display text-xl text-[var(--color-trove-ink)]">Order now — cash on delivery</h2>
            </div>
            <TroveLeadFormFields :fields="props.leadFields ?? []" :data="props.leadFormData ?? {}" />
            <div class="flex items-center justify-between border-t border-neutral-100 pt-4">
              <span class="font-medium text-[var(--color-trove-ink)]">Total</span>
              <PriceDisplay :amount-cents="props.effectivePriceCents * props.quantity" class="text-xl font-bold text-primary-700" />
            </div>
            <div class="flex items-center gap-3">
              <TroveQuantityStepper :model-value="props.quantity" :min="1" :max="props.effectiveStock" @update:model-value="props.onUpdateQuantity" />
              <TroveButton block size="lg" :loading="props.leadPlacing" @click="props.onSubmitLead">Place order</TroveButton>
            </div>
            <p v-if="props.leadError" class="text-sm font-medium text-red-600">{{ props.leadError }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Reviews -->
    <section v-if="props.reviewData" class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div class="trove-card p-8">
        <h2 class="font-display mb-6 text-2xl text-[var(--color-trove-ink)]">Customer reviews</h2>
        <div v-if="props.reviewData.summary.count > 0" class="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div class="space-y-2">
            <span class="text-4xl font-bold text-[var(--color-trove-ink)]">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
            <div class="flex">
              <Icon
                v-for="i in 5"
                :key="i"
                name="i-lucide-star"
                class="size-5"
                :class="i <= Math.round(props.reviewData.summary.average ?? 0) ? 'text-primary-500' : 'text-neutral-200'"
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
                    :class="i <= review.rating ? 'text-primary-500' : 'text-neutral-200'"
                  />
                </div>
                <span class="text-sm font-medium text-[var(--color-trove-ink)]">{{ review.customerName ?? 'Verified buyer' }}</span>
              </div>
              <p v-if="review.title" class="mt-2 font-medium text-[var(--color-trove-ink)]">{{ review.title }}</p>
              <p v-if="review.body" class="mt-1 text-sm leading-relaxed text-neutral-600">{{ review.body }}</p>
            </div>
          </div>
        </div>
        <p v-else class="text-neutral-500">No reviews yet — be the first after your order is delivered.</p>
      </div>
    </section>

    <!-- Related -->
    <section v-if="props.product.related?.length" class="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <h2 class="font-display mb-6 text-2xl text-[var(--color-trove-ink)]">You may also like</h2>
      <div class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <TemplateSection v-for="p in props.product.related" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
    </section>
  </div>
</template>
