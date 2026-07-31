<script setup lang="ts">
import type { ZodTypeAny } from 'zod'
import type { CartItem } from '~/stores/cart'

// Drop checkout — flat bordered panels on the black surface, no shadow.
// No UForm/UStepper: address validation runs the passed Zod schema
// directly on submit, the step indicator is plain divs.
const props = defineProps<{
  cart: { items: CartItem[]; totalCents: number }
  step: string
  stepItems: { value: string; title: string; icon: string }[]
  form: {
    phone: string
    name: string
    wilayaId: string
    shippingType: string
    shippingPriceCents: number
    address: { line1: string; line2: string; city: string; region: string; postalCode: string; country: string }
  }
  addressSchema: ZodTypeAny
  addressError: string | null
  totalCents: number
  placing: boolean
  placeError: string | null
  onAddressSubmit: () => void
  onPlaceOrder: () => void
  onBack: () => void
}>()

const fieldErrors = ref<Record<string, string>>({})

function submitAddress() {
  const result = props.addressSchema.safeParse(props.form)
  if (!result.success) {
    const errors: Record<string, string> = {}
    for (const issue of result.error.issues) errors[issue.path.join('.')] = issue.message
    fieldErrors.value = errors
    return
  }
  fieldErrors.value = {}
  props.onAddressSubmit()
}
</script>

<template>
  <div class="bg-black">
    <div class="border-b border-white/10 bg-[#171717]">
      <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <nav class="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-white/40">
          <NuxtLink to="/" class="hover:text-white">Home</NuxtLink>
          <Icon name="i-lucide-chevron-right" class="size-3.5" />
          <span class="text-white">Checkout</span>
        </nav>
        <h1 class="font-display text-3xl text-white sm:text-4xl">Checkout</h1>
      </div>
    </div>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <ClientOnly>
        <EmptyState v-if="props.cart.items.length === 0" icon="i-lucide-shopping-cart" title="Your cart is empty" description="Add something to your cart before checking out.">
          <DropButton to="/catalog" class="mt-4">Continue shopping</DropButton>
        </EmptyState>

        <template v-else>
          <!-- Step indicator -->
          <div class="mb-10 flex items-center justify-center gap-3">
            <template v-for="(s, i) in props.stepItems" :key="s.value">
              <div class="flex items-center gap-2">
                <div
                  class="flex size-8 items-center justify-center border text-sm font-bold"
                  :class="s.value === props.step ? 'border-primary-500 bg-primary-500 text-black' : 'border-white/15 bg-transparent text-white/40'"
                >{{ i + 1 }}</div>
                <span class="hidden text-sm font-bold uppercase sm:inline" :class="s.value === props.step ? 'text-white' : 'text-white/40'">{{ s.title }}</span>
              </div>
              <div v-if="i < props.stepItems.length - 1" class="h-px w-8 bg-white/15" />
            </template>
          </div>

          <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div class="lg:col-span-2">
              <div class="border border-white/10 bg-[#171717] p-6 sm:p-8">
                <!-- Step 1: address -->
                <div v-if="props.step === 'address'">
                  <h2 class="font-display mb-1 text-xl text-white">Delivery details</h2>
                  <p class="mb-6 text-sm text-white/50">Where should we drop it off?</p>
                  <form class="space-y-5" @submit.prevent="submitAddress">
                    <div>
                      <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/60">Phone</label>
                      <DropInput v-model="props.form.phone" type="tel" placeholder="+15551234567" icon="i-lucide-phone" />
                      <p v-if="fieldErrors['phone']" class="mt-1 text-xs font-bold text-primary-400">{{ fieldErrors['phone'] }}</p>
                    </div>
                    <div>
                      <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/60">Name (optional)</label>
                      <DropInput v-model="props.form.name" icon="i-lucide-user" />
                    </div>
                    <div>
                      <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/60">Address line 1</label>
                      <DropInput v-model="props.form.address.line1" icon="i-lucide-map-pin" />
                      <p v-if="fieldErrors['address.line1']" class="mt-1 text-xs font-bold text-primary-400">{{ fieldErrors['address.line1'] }}</p>
                    </div>
                    <div>
                      <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-white/60">Address line 2 (optional)</label>
                      <DropInput v-model="props.form.address.line2" />
                    </div>
                    <DropCheckoutShippingFields :form="props.form" />
                    <p v-if="props.addressError" class="mt-1 text-xs font-bold text-primary-400">{{ props.addressError }}</p>
                    <DropButton type="submit" block size="lg" trailing-icon="i-lucide-arrow-right">Continue to review</DropButton>
                  </form>
                </div>

                <!-- Step 2: review -->
                <div v-else-if="props.step === 'review'">
                  <h2 class="font-display mb-1 text-xl text-white">Review your order</h2>
                  <p class="mb-6 text-sm text-white/50">Everything look right?</p>

                  <div class="space-y-3 border border-white/10 p-4">
                    <h3 class="text-sm font-bold uppercase text-white">Items</h3>
                    <ul class="divide-y divide-white/10">
                      <li v-for="item in props.cart.items" :key="item.productId" class="flex justify-between py-2 text-sm">
                        <span class="text-white/60">{{ item.name }} × {{ item.quantity }}</span>
                        <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="font-bold text-white" />
                      </li>
                    </ul>
                  </div>

                  <div class="mt-4 space-y-1 border border-white/10 p-4 text-sm">
                    <h3 class="mb-2 font-bold uppercase text-white">Deliver to</h3>
                    <p class="font-bold text-white">{{ props.form.name || props.form.phone }}</p>
                    <p class="text-white/60">{{ props.form.address.line1 }}<template v-if="props.form.address.line2">, {{ props.form.address.line2 }}</template></p>
                    <p class="text-white/60">{{ props.form.address.city }}, {{ props.form.address.region }}</p>
                    <p class="text-white/60">{{ props.form.phone }}</p>
                  </div>

                  <div class="mt-4 flex items-center justify-between border border-white/10 p-4 text-sm">
                    <span class="text-white/50">Shipping ({{ props.form.shippingType === 'Home' ? 'Home delivery' : 'Desk delivery' }})</span>
                    <PriceDisplay :amount-cents="props.form.shippingPriceCents" class="font-bold text-white" />
                  </div>

                  <div class="mt-4 flex items-center justify-between border border-primary-500 bg-primary-500/10 p-4">
                    <span class="font-bold uppercase text-white">Cash due on delivery</span>
                    <PriceDisplay :amount-cents="props.totalCents" class="text-lg font-bold text-primary-400" />
                  </div>

                  <DropAlert v-if="props.placeError" color="error" :description="props.placeError" class="mt-4" />

                  <div class="mt-6 flex gap-3">
                    <DropButton variant="outline" icon="i-lucide-arrow-left" @click="props.onBack">Back</DropButton>
                    <DropButton block size="lg" :loading="props.placing" @click="props.onPlaceOrder">Place order</DropButton>
                  </div>
                </div>
              </div>
            </div>

            <div class="lg:col-span-1">
              <div class="sticky top-24 border border-white/10 bg-[#171717] p-6">
                <h2 class="font-display mb-4 text-lg text-white">Order summary</h2>
                <ul class="mb-4 max-h-64 space-y-3 overflow-y-auto pr-1">
                  <li v-for="item in props.cart.items" :key="item.productId" class="flex items-center gap-3">
                    <div class="size-12 shrink-0 overflow-hidden border border-white/10 bg-neutral-900">
                      <NuxtImg v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" class="size-full object-cover" width="48" height="48" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="line-clamp-1 text-sm font-bold text-white">{{ item.name }}</p>
                      <p class="text-xs text-white/40">Qty {{ item.quantity }}</p>
                    </div>
                    <PriceDisplay :amount-cents="item.priceCents * item.quantity" class="text-sm font-bold text-white" />
                  </li>
                </ul>
                <div class="space-y-2 border-t border-white/10 pt-4 text-sm">
                  <div class="flex items-center justify-between"><span class="text-white/50">Subtotal</span><PriceDisplay :amount-cents="props.cart.totalCents" class="font-bold text-white" /></div>
                  <div class="flex items-center justify-between"><span class="text-white/50">Shipping</span><span v-if="!props.form.shippingType" class="font-bold text-primary-400">Free</span><PriceDisplay v-else :amount-cents="props.form.shippingPriceCents" class="font-bold text-white" /></div>
                </div>
                <div class="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                  <span class="font-bold uppercase text-white">Total</span>
                  <PriceDisplay :amount-cents="props.totalCents" class="text-2xl font-bold text-white" />
                </div>
                <p class="mt-2 flex items-center gap-1.5 text-xs text-white/40"><Icon name="i-lucide-banknote" class="size-3.5" /> Cash on delivery</p>
              </div>
            </div>
          </div>
        </template>

        <template #fallback>
          <div class="flex items-center justify-center py-24 text-white/40">
            <Icon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" /> Loading…
          </div>
        </template>
      </ClientOnly>
    </section>
  </div>
</template>
