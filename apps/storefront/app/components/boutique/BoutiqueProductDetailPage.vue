<script setup lang="ts">
import type { Product, ProductImage, ProductVariant, RatingSummary, Review, LeadFormField } from '@amalice/shared'

// Boutique PDP — a TALL single column (max-w-3xl), the editorial inverse of a
// split layout. One large aspect-[4/5] image anchors the page; everything else
// stacks beneath with py-32 breathing room. Variant pills are square, bordered,
// uppercase. Minimal text, maximum negative space — the gallery carries it.
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
  <main v-if="props.product" class="bg-default">
    <!-- Quiet breadcrumb -->
    <div class="mx-auto max-w-3xl px-6 pt-12">
      <nav class="text-xs uppercase tracking-[0.3em] text-muted">
        <NuxtLink to="/" class="transition-colors hover:text-highlighted">Home</NuxtLink>
        <span class="mx-2">/</span>
        <NuxtLink to="/catalog" class="transition-colors hover:text-highlighted">Shop</NuxtLink>
        <span class="mx-2">/</span>
        <span class="text-highlighted">{{ props.product.name }}</span>
      </nav>
    </div>

    <!-- Gallery — large, centered, aspect-[4/5] -->
    <section class="mx-auto max-w-3xl px-6 pt-12">
      <div class="aspect-[4/5] overflow-hidden bg-elevated">
        <NuxtImg
          v-if="props.galleryImages.length"
          :src="props.galleryImages[props.activeImageIndex]?.url"
          :alt="props.galleryImages[props.activeImageIndex]?.alt"
          class="size-full object-cover"
          width="800"
          height="1000"
          loading="eager"
          format="webp"
        />
      </div>
      <div v-if="props.galleryImages.length > 1" class="mt-5 flex justify-center gap-3">
        <button
          v-for="(img, i) in props.galleryImages"
          :key="i"
          class="size-20 overflow-hidden border-2 transition-colors"
          :class="i === props.activeImageIndex ? 'border-highlighted' : 'border-transparent hover:border-default'"
          @click="props.onSelectImage(i)"
        >
          <NuxtImg :src="img.url" :alt="img.alt" class="size-full object-cover" width="80" height="80" loading="lazy" />
        </button>
      </div>
    </section>

    <!-- Title block — centered, minimal -->
    <section class="mx-auto max-w-3xl px-6 pt-20 text-center sm:pt-24">
      <p v-if="props.product.category" class="text-xs uppercase tracking-[0.4em] text-muted">{{ props.product.category }}</p>
      <h1 class="mt-5 text-3xl font-light tracking-tight text-highlighted sm:text-4xl">{{ props.product.name }}</h1>

      <div v-if="props.reviewData?.summary && props.reviewData.summary.count > 0" class="mt-4 flex items-center justify-center gap-2 text-sm">
        <div class="flex">
          <Icon
            v-for="i in 5"
            :key="i"
            name="i-lucide-star"
            :class="i <= Math.round(props.reviewData.summary.average ?? 0) ? 'text-warning' : 'text-muted'"
            class="size-3.5"
          />
        </div>
        <span class="text-xs uppercase tracking-widest text-muted">{{ props.reviewData.summary.count }}</span>
      </div>

      <div class="mt-8 flex items-center justify-center gap-3">
        <PriceDisplay :amount-cents="props.effectivePriceCents" class="price-accent text-2xl font-light tracking-tight" />
        <BoutiqueBadge v-if="!props.inStock" color="error">Sold out</BoutiqueBadge>
      </div>
    </section>

    <!-- Description — narrow, generous lead -->
    <section v-if="props.product.description" class="mx-auto max-w-2xl px-6 pt-12">
      <p class="text-center text-base font-light leading-relaxed text-muted">{{ props.product.description }}</p>
    </section>

    <!-- Variants — centered pills, border-2 uppercase tracking-widest -->
    <section v-if="Object.keys(props.variantOptions).length" class="mx-auto max-w-3xl space-y-8 px-6 pt-16">
      <div v-for="(values, key) in props.variantOptions" :key="key" class="text-center">
        <p class="mb-4 text-xs uppercase tracking-[0.4em] text-muted">{{ key }}</p>
        <div class="flex flex-wrap justify-center gap-3">
          <button
            v-for="val in values"
            :key="val"
            class="border-2 px-6 py-3 text-xs font-medium uppercase tracking-[0.2em] transition-colors"
            :class="props.selectedVariant?.attributes[key] === val
              ? 'border-highlighted bg-highlighted text-inverted'
              : 'border-default text-highlighted hover:border-muted'"
            @click="props.onSelectVariantByKey(key, val)"
          >
            {{ val }}
          </button>
        </div>
      </div>
    </section>

    <!-- Cart mode — centered, refined -->
    <section v-if="props.displayCart !== false" class="mx-auto max-w-3xl px-6 pt-16">
      <div class="flex flex-col items-center gap-5">
        <div class="flex items-center gap-4">
          <BoutiqueQuantityStepper
            :model-value="props.quantity"
            :min="1"
            :max="props.effectiveStock"
            :disabled="!props.inStock"
            @update:model-value="props.onUpdateQuantity"
          />
        </div>
        <BoutiqueButton
          :disabled="!props.inStock"
          size="lg"
          color="neutral"
          variant="outline"
          class="w-full max-w-xs !border-2 !px-10"
          @click="props.onAddToCart"
        >
          {{ props.inStock ? 'Add to bag' : 'Sold out' }}
        </BoutiqueButton>
        <p v-if="props.added" class="text-xs uppercase tracking-[0.3em] text-success">Added to bag</p>
      </div>
    </section>

    <!-- Lead form mode — centered, refined -->
    <section v-if="props.displayCart === false && props.inStock" class="mx-auto max-w-3xl px-6 pt-16">
      <div class="flex flex-col items-center gap-5">
        <p class="text-xs uppercase tracking-[0.4em] text-muted">Order Now — Cash on Delivery</p>
        <div class="w-full max-w-md space-y-4">
          <BoutiqueLeadFormFields :fields="props.leadFields ?? []" :data="props.leadFormData ?? {}" />
          <div class="flex items-center gap-4">
            <BoutiqueQuantityStepper :model-value="props.quantity" :min="1" :max="props.effectiveStock" @update:model-value="props.onUpdateQuantity" />
            <BoutiqueButton block size="lg" variant="outline" class="!border-2 !px-10" :loading="props.leadPlacing" @click="props.onSubmitLead">Place order</BoutiqueButton>
          </div>
          <p v-if="props.leadError" class="text-xs text-error">{{ props.leadError }}</p>
        </div>
      </div>
    </section>

    <!-- Reviews — quiet column -->
    <section v-if="props.reviewData && props.reviewData.items.length" class="mx-auto max-w-2xl px-6 pt-32">
      <div class="text-center">
        <p class="text-xs uppercase tracking-[0.4em] text-muted">Notes</p>
        <div class="mx-auto mt-6 h-px w-12 bg-default" />
      </div>
      <div class="mt-12 space-y-12">
        <blockquote v-for="review in props.reviewData.items" :key="review.id" class="text-center">
          <p v-if="review.body" class="text-lg font-light italic leading-relaxed text-highlighted">“{{ review.body }}”</p>
          <footer class="mt-5 text-xs uppercase tracking-[0.3em] text-muted">— {{ review.customerName ?? 'Verified buyer' }}</footer>
        </blockquote>
      </div>
    </section>

    <!-- Related — narrow 3-col -->
    <section v-if="props.product.related?.length" class="mx-auto max-w-5xl px-6 pt-32 pb-24">
      <div class="text-center">
        <p class="text-xs uppercase tracking-[0.4em] text-muted">More to consider</p>
        <div class="mx-auto mt-6 h-px w-12 bg-default" />
      </div>
      <div class="mt-12 grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3">
        <TemplateSection v-for="p in props.product.related" :key="p.id" name="ProductCard" :section-props="{ product: p }" />
      </div>
    </section>
  </main>
</template>
