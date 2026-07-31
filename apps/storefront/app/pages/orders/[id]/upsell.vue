<script setup lang="ts">
// Upsells system's storefront post-checkout page — one-click "add this?"
// shown right after an order is placed, before the confirmation page.
// Phone is read from sessionStorage (stashed by checkout.vue/products/
// [slug].vue right before navigating here) rather than a URL query param,
// matching order tracking's phone-as-shared-secret model without putting
// the phone in browser history. No phone stashed (e.g. this URL was opened
// directly) or no upsell configured both just skip straight to confirmation
// — this page is only ever a detour, never a required step.
useSeoMeta({ title: 'قبل أن تغادر' })

const route = useRoute()
const orderId = route.params.id as string

interface UpsellOffer {
  upsellId: string
  product: { id: string; name: string; slug: string; imageUrl: string | null; priceCents: number }
  priceCents: number
}

const loading = ref(true)
const offer = ref<UpsellOffer | null>(null)
const adding = ref(false)
const phone = ref('')

function goToConfirmation() {
  navigateTo(`/orders/${orderId}/confirmation`, { replace: true })
}

onMounted(async () => {
  phone.value = sessionStorage.getItem(`amalice.order.${orderId}.phone`) ?? ''
  if (!phone.value) {
    goToConfirmation()
    return
  }
  try {
    const apiClient = useApiClient()
    offer.value = await apiClient<UpsellOffer | null>(`/orders/${orderId}/upsell`, { query: { phone: phone.value } })
  } catch {
    offer.value = null
  }
  loading.value = false
  if (!offer.value) goToConfirmation()
})

async function acceptOffer() {
  if (!offer.value) return
  adding.value = true
  try {
    const apiClient = useApiClient()
    await apiClient(`/orders/${orderId}/upsell/accept`, {
      method: 'POST',
      body: { phone: phone.value, upsellId: offer.value.upsellId, quantity: 1 }
    })
    // Merge the accepted upsell into the stashed confirmation payload rather
    // than deleting it — confirmation.vue's Purchase pixel event depends on
    // this sessionStorage key existing (see its onMounted). Deleting it here
    // used to make confirmation.vue hit its "not found" branch and skip
    // firing Purchase entirely for every order where the customer accepted
    // the upsell — a real bug, not just a stale-total display quibble.
    const rawOrder = sessionStorage.getItem(`amalice.order.${orderId}`)
    if (rawOrder) {
      try {
        const cached = JSON.parse(rawOrder)
        cached.items.push({
          productId: offer.value.product.id,
          name: offer.value.product.name,
          quantity: 1,
          unitPriceCents: offer.value.priceCents,
          lineTotalCents: offer.value.priceCents
        })
        cached.totalCents += offer.value.priceCents
        sessionStorage.setItem(`amalice.order.${orderId}`, JSON.stringify(cached))
      } catch {
        // Malformed cached payload — leave it as-is rather than lose the
        // Purchase event by deleting it; confirmation.vue's own try/catch
        // around JSON.parse handles this the same way it already does.
      }
    }
  } catch {
    // Best-effort — if accepting fails, just move on to confirmation rather
    // than trap the customer on this page.
  } finally {
    adding.value = false
    goToConfirmation()
  }
}
</script>

<template>
  <ClientOnly>
    <main class="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <div v-if="loading" class="text-sm text-neutral-500">جارٍ التحميل...</div>
      <template v-else-if="offer">
        <div class="space-y-1">
          <p class="text-xs font-medium uppercase tracking-wide text-primary">قبل أن تغادر</p>
          <h1 class="text-xl font-semibold">هل تريد إضافة هذا إلى طلبك؟</h1>
        </div>

        <NuxtImg
          v-if="offer.product.imageUrl"
          :src="resolveImageUrl(offer.product.imageUrl)"
          :alt="offer.product.name"
          class="h-40 w-40 rounded-md object-cover"
        />

        <div class="space-y-1">
          <p class="font-medium text-highlighted">{{ offer.product.name }}</p>
          <PriceDisplay :amount-cents="offer.priceCents" class="text-lg font-semibold" />
          <p v-if="offer.priceCents < offer.product.priceCents" class="text-xs text-neutral-500">
            السعر الأصلي <PriceDisplay :amount-cents="offer.product.priceCents" />
          </p>
        </div>

        <div class="flex w-full flex-col gap-2">
          <UButton :loading="adding" block size="lg" @click="acceptOffer">نعم، أضفها — الدفع عند الاستلام</UButton>
          <UButton variant="ghost" color="neutral" block :disabled="adding" @click="goToConfirmation">لا شكراً</UButton>
        </div>
      </template>
    </main>
  </ClientOnly>
</template>
