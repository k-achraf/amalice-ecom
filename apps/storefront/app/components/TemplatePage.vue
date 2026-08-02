<script setup lang="ts">
// The template-PAGE resolver — a sibling to <TemplateSection> for whole pages.
// Each page file owns its LOGIC (fetch, cart, checkout, filters, timers)
// and renders <TemplatePage name="Catalog" :page-props="...">. This resolves
// the right PRESENTATIONAL component for the active template (e.g.
// PromifyCatalogPage), falling back to the bare CatalogPage (minimal).
//
// Why a separate resolver from TemplateSection: pages carry page-specific prop
// shapes (catalog gets products+pending+onSearchSubmit; cart gets cart+notice;
// checkout gets step+form+placeOrder+verifyCode). Keeping the map page-keyed
// (not section-keyed) makes the page→component wiring obvious and type-erased
// at the boundary (page-props is a bag forwarded as-is).
//
// Pages are added here as they get templated. An unmapped page name renders
// the fallback. An unmapped (page, template) pair also renders the fallback.
//
// PERFORMANCE: every override is a lazy `defineAsyncComponent` (dynamic
// import), not a static top-level import — a store only ever runs ONE
// active template, but a static import here would make Vite bundle all 14
// override templates' page components into the initial JS/CSS for EVERY
// visitor regardless of which one is actually active. That was a real,
// measured bug (PageSpeed showed ~190KB of unused JS on a single-template
// storefront) — lazy imports mean only the active template's chunk is ever
// fetched. FALLBACK stays a static import since it's the minimal template's
// own page and is a likely/default render path either way.
//
// The <Suspense> wrapper below is required, not decorative: Vue's SSR
// renderer only awaits an async component's resolution when it's inside a
// Suspense boundary. Without one, `renderToString` serializes full HTML for
// the resolved component (Node has it in the module cache already), but the
// CLIENT's hydration pass hits the same unresolved async wrapper, can't
// hydrate against it, and falls back to discarding + client-rendering that
// subtree from scratch — a real hydration mismatch (this was PageSpeed's
// "Hydration Mismatch" finding after this file's original defineAsyncComponent
// conversion, which shipped without Suspense).
import { defineAsyncComponent, type Component } from 'vue'

// ---- fallback (minimal) page components ----
import CatalogPage from './pages/CatalogPage.vue'
import ProductDetailPage from './pages/ProductDetailPage.vue'
import CartPage from './pages/CartPage.vue'
import CheckoutPage from './pages/CheckoutPage.vue'
import CollectionPage from './pages/CollectionPage.vue'
import DealsPage from './pages/DealsPage.vue'
import WishlistPage from './pages/WishlistPage.vue'
import NewArrivalsPage from './pages/NewArrivalsPage.vue'
import ConfirmationPage from './pages/ConfirmationPage.vue'

// (pageName, template) → component. Missing entry → fallback below.
const OVERRIDES: Record<string, Record<string, Component>> = {
  Catalog: {
    editorial: defineAsyncComponent(() => import('./editorial/EditorialCatalogPage.vue')),
    boutique: defineAsyncComponent(() => import('./boutique/BoutiqueCatalogPage.vue')),
    promify: defineAsyncComponent(() => import('./promify/PromifyCatalogPage.vue')),
    nova: defineAsyncComponent(() => import('./nova/NovaCatalogPage.vue')),
    atelier: defineAsyncComponent(() => import('./atelier/AtelierCatalogPage.vue')),
    drop: defineAsyncComponent(() => import('./drop/DropCatalogPage.vue')),
    bloom: defineAsyncComponent(() => import('./bloom/BloomCatalogPage.vue')),
    hearth: defineAsyncComponent(() => import('./hearth/HearthCatalogPage.vue')),
    volt: defineAsyncComponent(() => import('./volt/VoltCatalogPage.vue')),
    pulse: defineAsyncComponent(() => import('./pulse/PulseCatalogPage.vue')),
    lumiere: defineAsyncComponent(() => import('./lumiere/LumiereCatalogPage.vue')),
    trove: defineAsyncComponent(() => import('./trove/TroveCatalogPage.vue')),
    forge: defineAsyncComponent(() => import('./forge/ForgeCatalogPage.vue')),
    impulse: defineAsyncComponent(() => import('./impulse/ImpulseCatalogPage.vue'))
  },
  ProductDetail: {
    editorial: defineAsyncComponent(() => import('./editorial/EditorialProductDetailPage.vue')),
    boutique: defineAsyncComponent(() => import('./boutique/BoutiqueProductDetailPage.vue')),
    promify: defineAsyncComponent(() => import('./promify/PromifyProductDetailPage.vue')),
    nova: defineAsyncComponent(() => import('./nova/NovaProductDetailPage.vue')),
    atelier: defineAsyncComponent(() => import('./atelier/AtelierProductDetailPage.vue')),
    drop: defineAsyncComponent(() => import('./drop/DropProductDetailPage.vue')),
    bloom: defineAsyncComponent(() => import('./bloom/BloomProductDetailPage.vue')),
    hearth: defineAsyncComponent(() => import('./hearth/HearthProductDetailPage.vue')),
    volt: defineAsyncComponent(() => import('./volt/VoltProductDetailPage.vue')),
    pulse: defineAsyncComponent(() => import('./pulse/PulseProductDetailPage.vue')),
    lumiere: defineAsyncComponent(() => import('./lumiere/LumiereProductDetailPage.vue')),
    trove: defineAsyncComponent(() => import('./trove/TroveProductDetailPage.vue')),
    forge: defineAsyncComponent(() => import('./forge/ForgeProductDetailPage.vue')),
    impulse: defineAsyncComponent(() => import('./impulse/ImpulseProductDetailPage.vue'))
  },
  Cart: {
    editorial: defineAsyncComponent(() => import('./editorial/EditorialCartPage.vue')),
    boutique: defineAsyncComponent(() => import('./boutique/BoutiqueCartPage.vue')),
    promify: defineAsyncComponent(() => import('./promify/PromifyCartPage.vue')),
    nova: defineAsyncComponent(() => import('./nova/NovaCartPage.vue')),
    atelier: defineAsyncComponent(() => import('./atelier/AtelierCartPage.vue')),
    drop: defineAsyncComponent(() => import('./drop/DropCartPage.vue')),
    bloom: defineAsyncComponent(() => import('./bloom/BloomCartPage.vue')),
    hearth: defineAsyncComponent(() => import('./hearth/HearthCartPage.vue')),
    volt: defineAsyncComponent(() => import('./volt/VoltCartPage.vue')),
    pulse: defineAsyncComponent(() => import('./pulse/PulseCartPage.vue')),
    lumiere: defineAsyncComponent(() => import('./lumiere/LumiereCartPage.vue')),
    trove: defineAsyncComponent(() => import('./trove/TroveCartPage.vue')),
    forge: defineAsyncComponent(() => import('./forge/ForgeCartPage.vue')),
    impulse: defineAsyncComponent(() => import('./impulse/ImpulseCartPage.vue'))
  },
  Checkout: {
    editorial: defineAsyncComponent(() => import('./editorial/EditorialCheckoutPage.vue')),
    boutique: defineAsyncComponent(() => import('./boutique/BoutiqueCheckoutPage.vue')),
    promify: defineAsyncComponent(() => import('./promify/PromifyCheckoutPage.vue')),
    nova: defineAsyncComponent(() => import('./nova/NovaCheckoutPage.vue')),
    atelier: defineAsyncComponent(() => import('./atelier/AtelierCheckoutPage.vue')),
    drop: defineAsyncComponent(() => import('./drop/DropCheckoutPage.vue')),
    bloom: defineAsyncComponent(() => import('./bloom/BloomCheckoutPage.vue')),
    hearth: defineAsyncComponent(() => import('./hearth/HearthCheckoutPage.vue')),
    volt: defineAsyncComponent(() => import('./volt/VoltCheckoutPage.vue')),
    pulse: defineAsyncComponent(() => import('./pulse/PulseCheckoutPage.vue')),
    lumiere: defineAsyncComponent(() => import('./lumiere/LumiereCheckoutPage.vue')),
    trove: defineAsyncComponent(() => import('./trove/TroveCheckoutPage.vue')),
    forge: defineAsyncComponent(() => import('./forge/ForgeCheckoutPage.vue')),
    impulse: defineAsyncComponent(() => import('./impulse/ImpulseCheckoutPage.vue'))
  },
  Collection: {
    editorial: defineAsyncComponent(() => import('./editorial/EditorialCollectionPage.vue')),
    boutique: defineAsyncComponent(() => import('./boutique/BoutiqueCollectionPage.vue')),
    promify: defineAsyncComponent(() => import('./promify/PromifyCollectionPage.vue')),
    nova: defineAsyncComponent(() => import('./nova/NovaCollectionPage.vue')),
    atelier: defineAsyncComponent(() => import('./atelier/AtelierCollectionPage.vue')),
    drop: defineAsyncComponent(() => import('./drop/DropCollectionPage.vue')),
    bloom: defineAsyncComponent(() => import('./bloom/BloomCollectionPage.vue')),
    hearth: defineAsyncComponent(() => import('./hearth/HearthCollectionPage.vue')),
    volt: defineAsyncComponent(() => import('./volt/VoltCollectionPage.vue')),
    pulse: defineAsyncComponent(() => import('./pulse/PulseCollectionPage.vue')),
    lumiere: defineAsyncComponent(() => import('./lumiere/LumiereCollectionPage.vue')),
    trove: defineAsyncComponent(() => import('./trove/TroveCollectionPage.vue')),
    forge: defineAsyncComponent(() => import('./forge/ForgeCollectionPage.vue')),
    impulse: defineAsyncComponent(() => import('./impulse/ImpulseCollectionPage.vue'))
  },
  Deals: {
    editorial: defineAsyncComponent(() => import('./editorial/EditorialDealsPage.vue')),
    boutique: defineAsyncComponent(() => import('./boutique/BoutiqueDealsPage.vue')),
    promify: defineAsyncComponent(() => import('./promify/PromifyDealsPage.vue')),
    nova: defineAsyncComponent(() => import('./nova/NovaDealsPage.vue')),
    atelier: defineAsyncComponent(() => import('./atelier/AtelierDealsPage.vue')),
    drop: defineAsyncComponent(() => import('./drop/DropDealsPage.vue')),
    bloom: defineAsyncComponent(() => import('./bloom/BloomDealsPage.vue')),
    hearth: defineAsyncComponent(() => import('./hearth/HearthDealsPage.vue')),
    volt: defineAsyncComponent(() => import('./volt/VoltDealsPage.vue')),
    pulse: defineAsyncComponent(() => import('./pulse/PulseDealsPage.vue')),
    lumiere: defineAsyncComponent(() => import('./lumiere/LumiereDealsPage.vue')),
    trove: defineAsyncComponent(() => import('./trove/TroveDealsPage.vue')),
    forge: defineAsyncComponent(() => import('./forge/ForgeDealsPage.vue')),
    impulse: defineAsyncComponent(() => import('./impulse/ImpulseDealsPage.vue'))
  },
  Wishlist: {
    editorial: defineAsyncComponent(() => import('./editorial/EditorialWishlistPage.vue')),
    boutique: defineAsyncComponent(() => import('./boutique/BoutiqueWishlistPage.vue')),
    promify: defineAsyncComponent(() => import('./promify/PromifyWishlistPage.vue')),
    nova: defineAsyncComponent(() => import('./nova/NovaWishlistPage.vue')),
    atelier: defineAsyncComponent(() => import('./atelier/AtelierWishlistPage.vue')),
    drop: defineAsyncComponent(() => import('./drop/DropWishlistPage.vue')),
    bloom: defineAsyncComponent(() => import('./bloom/BloomWishlistPage.vue')),
    hearth: defineAsyncComponent(() => import('./hearth/HearthWishlistPage.vue')),
    volt: defineAsyncComponent(() => import('./volt/VoltWishlistPage.vue')),
    pulse: defineAsyncComponent(() => import('./pulse/PulseWishlistPage.vue')),
    lumiere: defineAsyncComponent(() => import('./lumiere/LumiereWishlistPage.vue')),
    trove: defineAsyncComponent(() => import('./trove/TroveWishlistPage.vue')),
    forge: defineAsyncComponent(() => import('./forge/ForgeWishlistPage.vue')),
    impulse: defineAsyncComponent(() => import('./impulse/ImpulseWishlistPage.vue'))
  },
  NewArrivals: {
    editorial: defineAsyncComponent(() => import('./editorial/EditorialNewArrivalsPage.vue')),
    boutique: defineAsyncComponent(() => import('./boutique/BoutiqueNewArrivalsPage.vue')),
    promify: defineAsyncComponent(() => import('./promify/PromifyNewArrivalsPage.vue')),
    nova: defineAsyncComponent(() => import('./nova/NovaNewArrivalsPage.vue')),
    atelier: defineAsyncComponent(() => import('./atelier/AtelierNewArrivalsPage.vue')),
    drop: defineAsyncComponent(() => import('./drop/DropNewArrivalsPage.vue')),
    bloom: defineAsyncComponent(() => import('./bloom/BloomNewArrivalsPage.vue')),
    hearth: defineAsyncComponent(() => import('./hearth/HearthNewArrivalsPage.vue')),
    volt: defineAsyncComponent(() => import('./volt/VoltNewArrivalsPage.vue')),
    pulse: defineAsyncComponent(() => import('./pulse/PulseNewArrivalsPage.vue')),
    lumiere: defineAsyncComponent(() => import('./lumiere/LumiereNewArrivalsPage.vue')),
    trove: defineAsyncComponent(() => import('./trove/TroveNewArrivalsPage.vue')),
    forge: defineAsyncComponent(() => import('./forge/ForgeNewArrivalsPage.vue')),
    impulse: defineAsyncComponent(() => import('./impulse/ImpulseNewArrivalsPage.vue'))
  },
  // Only impulse has its own confirmation presentation for now — every other
  // template falls through to the generic ConfirmationPage below (see this
  // component's own top-of-file comment: "an unmapped (page, template) pair
  // also renders the fallback").
  Confirmation: {
    impulse: defineAsyncComponent(() => import('./impulse/ImpulseConfirmationPage.vue'))
  }
}

// Fallback (minimal) — used for the minimal template AND when a template
// doesn't override a page. Keeps the minimal path as the source of truth.
const FALLBACK: Record<string, Component> = {
  Catalog: CatalogPage,
  ProductDetail: ProductDetailPage,
  Cart: CartPage,
  Checkout: CheckoutPage,
  Collection: CollectionPage,
  Deals: DealsPage,
  Wishlist: WishlistPage,
  NewArrivals: NewArrivalsPage,
  Confirmation: ConfirmationPage
}

const props = defineProps<{
  name: string
  pageProps?: Record<string, unknown>
}>()

const settings = useStoreSettings()

const resolved = computed<Component | null>(() => {
  const template = settings.value.activeTemplate
  return OVERRIDES[props.name]?.[template] ?? FALLBACK[props.name] ?? null
})
</script>

<template>
  <Suspense v-if="resolved">
    <component :is="resolved" v-bind="pageProps ?? {}">
      <slot />
    </component>
  </Suspense>
</template>
