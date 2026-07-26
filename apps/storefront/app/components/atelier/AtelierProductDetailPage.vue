<script setup lang="ts">
import type { Product, ProductImage, ProductVariant, RatingSummary, Review, LeadFormField } from '@amalice/shared'

// Atelier PDP — velvet-mat gallery + sticky glow-card order summary.
// Variants as rounded pill chips. Lead-form mode uses AtelierLeadFormFields
// (cascading wilaya/commune). No @nuxt/ui anywhere.
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
  <div v-if="props.product" class="bg-[var(--color-atelier-cream)]">
    <!-- Breadcrumb -->
    <div class="border-b border-neutral-100 bg-[var(--color-atelier-cream)]">
      <nav class="mx-auto flex max-w-7xl items-center gap-2 px-4 py-4 text-xs font-medium uppercase tracking-wide text-neutral-400 sm:px-6 lg:px-8">
        <NuxtLink to="/" class="hover:text-primary-600">Home</NuxtLink>
        <Icon name="i-lucide-chevron-right" class="size-3" />
        <NuxtLink to="/catalog" class="hover:text-primary-600">Shop</NuxtLink>
        <Icon name="i-lucide-chevron-right" class="size-3" />
        <span class="truncate text-neutral-600">{{ props.product.name }}</span>
      </nav>
    </div>

    <section class="mx-auto max-w-7xl">
      <div class="grid grid-cols-1 lg:grid-cols-2">
        <!-- Gallery sits on a full velvet panel — echoes the hero's split -->
        <div class="velvet-panel space-y-4 px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
          <div class="mx-auto aspect-square max-w-lg overflow-hidden rounded-3xl bg-[var(--color-atelier-velvet-deep)] shadow-[var(--shadow-atelier-md)]">
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
          <div v-if="props.galleryImages.length > 1" class="mx-auto flex max-w-lg gap-3">
            <button
              v-for="(img, i) in props.galleryImages"
              :key="i"
              class="size-20 overflow-hidden rounded-2xl bg-[var(--color-atelier-velvet-deep)] ring-2 transition-all"
              :class="i === props.activeImageIndex ? 'ring-primary-500' : 'ring-transparent hover:ring-primary-300'"
              @click="props.onSelectImage(i)"
            >
              <NuxtImg :src="img.url" :alt="img.alt" class="size-full object-cover" width="80" height="80" loading="lazy" />
            </button>
          </div>
        </div>

        <!-- Detail + order summary — the cream half -->
        <div class="space-y-6 bg-[var(--color-atelier-cream)] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
          <div>
            <p v-if="props.product.category" class="text-xs font-semibold uppercase tracking-[0.15em] text-primary-600">{{ props.product.category }}</p>
            <h1 class="font-display mt-1 text-4xl text-[var(--color-atelier-ink)] sm:text-5xl">{{ props.product.name }}</h1>
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
            <span class="font-medium text-[var(--color-atelier-ink)]">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
            <span class="text-neutral-400">({{ props.reviewData.summary.count }} reviews)</span>
          </div>

          <!-- Price + stock badges -->
          <div class="flex items-center gap-3">
            <PriceDisplay :amount-cents="props.effectivePriceCents" class="text-3xl font-semibold text-primary-600" />
            <span v-if="!props.inStock" class="ring-badge !border-primary-500 !bg-primary-50 !text-primary-700">Out of stock</span>
            <span v-else-if="props.effectiveStock <= props.product.lowStockThreshold" class="ring-badge">Only {{ props.effectiveStock }} left</span>
          </div>

          <p v-if="props.product.description" class="leading-relaxed text-neutral-600">{{ props.product.description }}</p>

          <!-- Variants as rounded pill chips -->
          <div v-for="(values, key) in props.variantOptions" :key="key" class="space-y-3">
            <p class="text-sm font-medium capitalize text-[var(--color-atelier-ink)]">{{ key }}</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="val in values"
                :key="val"
                class="rounded-full border px-4 py-1.5 text-sm font-medium transition-all"
                :class="props.selectedVariant?.attributes[key] === val
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-neutral-200 text-neutral-600 hover:border-primary-300'"
                @click="props.onSelectVariantByKey(key, val)"
              >
                {{ val }}
              </button>
            </div>
          </div>

          <!-- Cart mode: COD order summary card -->
          <div v-if="props.displayCart !== false" class="glow-card p-6">
            <div class="mb-4 flex items-center gap-2">
              <Icon name="i-lucide-truck" class="size-5 text-primary-600" />
              <h2 class="font-display text-xl text-[var(--color-atelier-ink)]">Order summary</h2>
            </div>
            <div class="mb-4">
              <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Quantity</p>
              <AtelierQuantityStepper :model-value="props.quantity" :min="1" :max="props.effectiveStock" :disabled="!props.inStock" @update:model-value="props.onUpdateQuantity" />
            </div>
            <div class="space-y-2 border-t border-neutral-100 pt-4 text-sm">
              <div class="flex items-center justify-between"><span class="text-neutral-500">Subtotal</span><PriceDisplay :amount-cents="props.effectivePriceCents * props.quantity" class="font-medium" /></div>
              <div class="flex items-center justify-between"><span class="text-neutral-500">Shipping</span><span class="font-medium text-primary-600">Free</span></div>
            </div>
            <div class="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4">
              <span class="font-medium text-[var(--color-atelier-ink)]">Total</span>
              <PriceDisplay :amount-cents="props.effectivePriceCents * props.quantity" class="text-xl font-semibold text-primary-600" />
            </div>
            <p class="mt-2 flex items-center gap-1.5 text-xs text-neutral-400"><Icon name="i-lucide-banknote" class="size-3.5" /> Cash on delivery</p>
            <AtelierButton :disabled="!props.inStock" icon="i-lucide-shopping-bag" size="lg" block class="mt-5" @click="props.onAddToCart">{{ props.inStock ? 'Add to bag' : 'Out of stock' }}</AtelierButton>
            <p v-if="props.added" class="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary-600"><Icon name="i-lucide-check-circle" class="size-4" /> Added to bag.</p>
          </div>

          <!-- Lead form mode -->
          <div v-if="props.displayCart === false && props.inStock" class="glow-card space-y-4 p-6">
            <div class="flex items-center gap-2">
              <Icon name="i-lucide-banknote" class="size-5 text-primary-600" />
              <h2 class="font-display text-xl text-[var(--color-atelier-ink)]">Order now — cash on delivery</h2>
            </div>
            <AtelierLeadFormFields :fields="props.leadFields ?? []" :data="props.leadFormData ?? {}" />
            <div class="flex items-center justify-between border-t border-neutral-100 pt-4">
              <span class="font-medium text-[var(--color-atelier-ink)]">Total</span>
              <PriceDisplay :amount-cents="props.effectivePriceCents * props.quantity" class="text-xl font-semibold text-primary-600" />
            </div>
            <div class="flex items-center gap-3">
              <AtelierQuantityStepper :model-value="props.quantity" :min="1" :max="props.effectiveStock" @update:model-value="props.onUpdateQuantity" />
              <AtelierButton block size="lg" :loading="props.leadPlacing" @click="props.onSubmitLead">Place order</AtelierButton>
            </div>
            <p v-if="props.leadError" class="text-sm font-medium text-primary-700">{{ props.leadError }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Reviews -->
    <section v-if="props.reviewData" class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div class="glow-card p-8">
        <h2 class="font-display mb-6 text-3xl text-[var(--color-atelier-ink)]">Customer reviews</h2>
        <div v-if="props.reviewData.summary.count > 0" class="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div class="space-y-2">
            <span class="text-4xl font-semibold text-[var(--color-atelier-ink)]">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
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
                <span class="text-sm font-medium text-[var(--color-atelier-ink)]">{{ review.customerName ?? 'Verified buyer' }}</span>
              </div>
              <p v-if="review.title" class="mt-2 font-medium text-[var(--color-atelier-ink)]">{{ review.title }}</p>
              <p v-if="review.body" class="mt-1 text-sm leading-relaxed text-neutral-600">{{ review.body }}</p>
            </div>
          </div>
        </div>
        <p v-else class="text-neutral-500">No reviews yet — be the first after your order is delivered.</p>
      </div>
    </section>

    <!-- Related -->
    <section v-if="props.product.related?.length" class="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <h2 class="font-display mb-6 text-3xl text-[var(--color-atelier-ink)]">You may also like</h2>
      <div class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <TemplateSection v-for="p in props.product.related" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
    </section>
  </div>
</template>
