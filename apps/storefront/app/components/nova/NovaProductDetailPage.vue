<script setup lang="ts">
import type { Product, ProductImage, ProductVariant, RatingSummary, Review, LeadFormField } from '@amalice/shared'

// Nova PDP — bordered gallery + bordered sticky order-summary card. Variants
// as bordered chips. Lead-form mode uses NovaLeadFormFields (cascading
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
</script>

<template>
  <div v-if="props.product" class="bg-white">
    <!-- Breadcrumb band -->
    <div class="border-b-2 border-black bg-white">
      <nav class="mx-auto flex max-w-7xl items-center gap-2 px-4 py-4 text-sm font-bold uppercase text-black/50 sm:px-6 lg:px-8">
        <NuxtLink to="/" class="hover:underline">Home</NuxtLink>
        <Icon name="i-lucide-chevron-right" class="size-3.5" />
        <NuxtLink to="/catalog" class="hover:underline">Shop</NuxtLink>
        <Icon name="i-lucide-chevron-right" class="size-3.5" />
        <span class="truncate text-black">{{ props.product.name }}</span>
      </nav>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <!-- Gallery -->
        <div class="space-y-4">
          <div class="aspect-square overflow-hidden border-2 border-black bg-white shadow-[var(--shadow-nova-md)]">
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
              class="size-20 overflow-hidden border-2 transition-all"
              :class="i === props.activeImageIndex ? 'border-black' : 'border-black/20 hover:border-black/60'"
              @click="props.onSelectImage(i)"
            >
              <NuxtImg :src="img.url" :alt="img.alt" class="size-full object-cover" width="80" height="80" loading="lazy" />
            </button>
          </div>
        </div>

        <!-- Detail + order summary -->
        <div class="space-y-6">
          <div>
            <p v-if="props.product.category" class="text-xs font-bold uppercase tracking-wide text-primary-700">{{ props.product.category }}</p>
            <h1 class="font-display mt-1 text-3xl uppercase sm:text-4xl">{{ props.product.name }}</h1>
          </div>

          <!-- Star rating -->
          <div v-if="props.reviewData?.summary && props.reviewData.summary.count > 0" class="flex items-center gap-2 text-sm">
            <div class="flex">
              <Icon
                v-for="i in 5"
                :key="i"
                name="i-lucide-star"
                class="size-4"
                :class="i <= Math.round(props.reviewData.summary.average ?? 0) ? 'text-primary-600' : 'text-black/20'"
              />
            </div>
            <span class="font-bold text-black">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
            <span class="text-black/40">({{ props.reviewData.summary.count }} reviews)</span>
          </div>

          <!-- Price + stock badges -->
          <div class="flex items-center gap-3">
            <PriceDisplay :amount-cents="props.effectivePriceCents" class="text-3xl font-bold text-black" />
            <span v-if="!props.inStock" class="sticker sticker-pop">Out of stock</span>
            <span v-else-if="props.effectiveStock <= props.product.lowStockThreshold" class="sticker">Only {{ props.effectiveStock }} left</span>
          </div>

          <p v-if="props.product.description" class="leading-relaxed text-black/60">{{ props.product.description }}</p>

          <!-- Variants as bordered chips -->
          <div v-for="(values, key) in props.variantOptions" :key="key" class="space-y-3">
            <p class="text-sm font-bold uppercase text-black">{{ key }}</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="val in values"
                :key="val"
                class="border-2 px-4 py-1.5 text-sm font-bold transition-all"
                :class="props.selectedVariant?.attributes[key] === val
                  ? 'border-black bg-primary-500 text-black'
                  : 'border-black/20 text-black/70 hover:border-black'"
                @click="props.onSelectVariantByKey(key, val)"
              >
                {{ val }}
              </button>
            </div>
          </div>

          <!-- Cart mode: COD order summary card — sticks while the gallery/description scroll -->
          <div v-if="props.displayCart !== false" class="border-2 border-black bg-white p-6 shadow-[var(--shadow-nova-md)] lg:sticky lg:top-24">
            <div class="mb-4 flex items-center gap-2">
              <Icon name="i-lucide-truck" class="size-5 text-primary-700" />
              <h2 class="font-display text-lg uppercase">Order summary</h2>
            </div>
            <div class="mb-4">
              <p class="mb-2 text-xs font-bold uppercase tracking-wide text-black/50">Quantity</p>
              <NovaQuantityStepper :model-value="props.quantity" :min="1" :max="props.effectiveStock" :disabled="!props.inStock" @update:model-value="props.onUpdateQuantity" />
            </div>
            <div class="space-y-2 border-t-2 border-black/10 pt-4 text-sm">
              <div class="flex items-center justify-between"><span class="text-black/50">Subtotal</span><PriceDisplay :amount-cents="props.effectivePriceCents * props.quantity" class="font-bold" /></div>
              <div class="flex items-center justify-between"><span class="text-black/50">Shipping</span><span class="font-bold text-primary-700">Free</span></div>
            </div>
            <div class="mt-4 flex items-center justify-between border-t-2 border-black pt-4">
              <span class="font-bold uppercase">Total</span>
              <PriceDisplay :amount-cents="props.effectivePriceCents * props.quantity" class="text-xl font-bold" />
            </div>
            <p class="mt-2 flex items-center gap-1.5 text-xs text-black/40"><Icon name="i-lucide-banknote" class="size-3.5" /> Cash on delivery</p>
            <NovaButton :disabled="!props.inStock" icon="i-lucide-shopping-bag" size="lg" block class="mt-5" @click="props.onAddToCart">{{ props.inStock ? 'Add to cart' : 'Out of stock' }}</NovaButton>
            <p v-if="props.added" class="mt-3 flex items-center gap-1.5 text-sm font-bold text-primary-700"><Icon name="i-lucide-check-circle" class="size-4" /> Added to cart.</p>
          </div>

          <!-- Lead form mode -->
          <div v-if="props.displayCart === false && props.inStock" class="space-y-4 border-2 border-black bg-white p-6 shadow-[var(--shadow-nova-md)] lg:sticky lg:top-24">
            <div class="flex items-center gap-2">
              <Icon name="i-lucide-banknote" class="size-5 text-primary-700" />
              <h2 class="font-display text-lg uppercase">Order now — cash on delivery</h2>
            </div>
            <NovaLeadFormFields :fields="props.leadFields ?? []" :data="props.leadFormData ?? {}" />
            <div class="flex items-center justify-between border-t-2 border-black pt-4">
              <span class="font-bold uppercase">Total</span>
              <PriceDisplay :amount-cents="props.effectivePriceCents * props.quantity" class="text-xl font-bold" />
            </div>
            <div class="flex items-center gap-3">
              <NovaQuantityStepper :model-value="props.quantity" :min="1" :max="props.effectiveStock" @update:model-value="props.onUpdateQuantity" />
              <NovaButton block size="lg" :loading="props.leadPlacing" @click="props.onSubmitLead">Place order</NovaButton>
            </div>
            <p v-if="props.leadError" class="text-sm font-bold text-[var(--color-nova-pop)]">{{ props.leadError }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Reviews -->
    <section v-if="props.reviewData" class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
      <div class="border-2 border-black bg-white p-8">
        <h2 class="font-display mb-6 text-2xl uppercase">Customer reviews</h2>
        <div v-if="props.reviewData.summary.count > 0" class="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div class="space-y-2">
            <span class="text-4xl font-bold text-black">{{ props.reviewData.summary.average?.toFixed(1) }}</span>
            <div class="flex">
              <Icon
                v-for="i in 5"
                :key="i"
                name="i-lucide-star"
                class="size-5"
                :class="i <= Math.round(props.reviewData.summary.average ?? 0) ? 'text-primary-600' : 'text-black/20'"
              />
            </div>
            <p class="text-sm text-black/50">{{ props.reviewData.summary.count }} review{{ props.reviewData.summary.count === 1 ? '' : 's' }}</p>
          </div>
          <div class="space-y-5 lg:col-span-2">
            <div v-for="review in props.reviewData.items" :key="review.id" class="border-b-2 border-black/10 pb-5 last:border-0">
              <div class="flex items-center gap-2">
                <div class="flex">
                  <Icon
                    v-for="i in 5"
                    :key="i"
                    name="i-lucide-star"
                    class="size-3.5"
                    :class="i <= review.rating ? 'text-primary-600' : 'text-black/20'"
                  />
                </div>
                <span class="text-sm font-bold text-black">{{ review.customerName ?? 'Verified buyer' }}</span>
              </div>
              <p v-if="review.title" class="mt-2 font-bold text-black">{{ review.title }}</p>
              <p v-if="review.body" class="mt-1 text-sm leading-relaxed text-black/60">{{ review.body }}</p>
            </div>
          </div>
        </div>
        <p v-else class="text-black/50">No reviews yet — be the first after your order is delivered.</p>
      </div>
    </section>

    <!-- Related -->
    <section v-if="props.product.related?.length" class="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <h2 class="font-display mb-6 text-2xl uppercase">You may also like</h2>
      <div class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        <TemplateSection v-for="p in props.product.related" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
    </section>
  </div>
</template>
