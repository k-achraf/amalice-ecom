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
// NOT wrapped in <Suspense>: that was tried (to fix a "Hydration Mismatch"
// diagnostic) and reverted after it caused a measured, severe CLS regression
// (0.001 -> 1.000, the max possible score) in production — Suspense renders
// NOTHING for this whole subtree while the client-side chunk fetch is
// pending, so the entire page popped in at once, and gated the LCP element
// (which lives inside this subtree) from existing in the DOM until then.
//
// Reverting Suspense brought back the original hydration-mismatch warning
// though (Vue can't cleanly hydrate an unresolved async component without
// SOME strategy telling it how). The actual fix for both problems at once is
// Vue 3.5's lazy-hydration API: `hydrate: hydrateOnIdle()` tells Vue to keep
// the SSR-rendered DOM exactly as-is (visible, no blanking, no CLS) and only
// attach interactivity/reactivity once the browser is idle — instead of
// Suspense's "unmount and wait" behavior. See the `lazy()` helper below.
import { defineAsyncComponent, hydrateOnIdle, type Component } from 'vue'

function lazy(loader: () => Promise<{ default: Component }>) {
  return defineAsyncComponent({ loader, hydrate: hydrateOnIdle() })
}

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
    editorial: lazy(() => import('./editorial/EditorialCatalogPage.vue')),
    boutique: lazy(() => import('./boutique/BoutiqueCatalogPage.vue')),
    promify: lazy(() => import('./promify/PromifyCatalogPage.vue')),
    nova: lazy(() => import('./nova/NovaCatalogPage.vue')),
    atelier: lazy(() => import('./atelier/AtelierCatalogPage.vue')),
    drop: lazy(() => import('./drop/DropCatalogPage.vue')),
    bloom: lazy(() => import('./bloom/BloomCatalogPage.vue')),
    hearth: lazy(() => import('./hearth/HearthCatalogPage.vue')),
    volt: lazy(() => import('./volt/VoltCatalogPage.vue')),
    pulse: lazy(() => import('./pulse/PulseCatalogPage.vue')),
    lumiere: lazy(() => import('./lumiere/LumiereCatalogPage.vue')),
    trove: lazy(() => import('./trove/TroveCatalogPage.vue')),
    forge: lazy(() => import('./forge/ForgeCatalogPage.vue')),
    impulse: lazy(() => import('./impulse/ImpulseCatalogPage.vue'))
  },
  ProductDetail: {
    editorial: lazy(() => import('./editorial/EditorialProductDetailPage.vue')),
    boutique: lazy(() => import('./boutique/BoutiqueProductDetailPage.vue')),
    promify: lazy(() => import('./promify/PromifyProductDetailPage.vue')),
    nova: lazy(() => import('./nova/NovaProductDetailPage.vue')),
    atelier: lazy(() => import('./atelier/AtelierProductDetailPage.vue')),
    drop: lazy(() => import('./drop/DropProductDetailPage.vue')),
    bloom: lazy(() => import('./bloom/BloomProductDetailPage.vue')),
    hearth: lazy(() => import('./hearth/HearthProductDetailPage.vue')),
    volt: lazy(() => import('./volt/VoltProductDetailPage.vue')),
    pulse: lazy(() => import('./pulse/PulseProductDetailPage.vue')),
    lumiere: lazy(() => import('./lumiere/LumiereProductDetailPage.vue')),
    trove: lazy(() => import('./trove/TroveProductDetailPage.vue')),
    forge: lazy(() => import('./forge/ForgeProductDetailPage.vue')),
    impulse: lazy(() => import('./impulse/ImpulseProductDetailPage.vue'))
  },
  Cart: {
    editorial: lazy(() => import('./editorial/EditorialCartPage.vue')),
    boutique: lazy(() => import('./boutique/BoutiqueCartPage.vue')),
    promify: lazy(() => import('./promify/PromifyCartPage.vue')),
    nova: lazy(() => import('./nova/NovaCartPage.vue')),
    atelier: lazy(() => import('./atelier/AtelierCartPage.vue')),
    drop: lazy(() => import('./drop/DropCartPage.vue')),
    bloom: lazy(() => import('./bloom/BloomCartPage.vue')),
    hearth: lazy(() => import('./hearth/HearthCartPage.vue')),
    volt: lazy(() => import('./volt/VoltCartPage.vue')),
    pulse: lazy(() => import('./pulse/PulseCartPage.vue')),
    lumiere: lazy(() => import('./lumiere/LumiereCartPage.vue')),
    trove: lazy(() => import('./trove/TroveCartPage.vue')),
    forge: lazy(() => import('./forge/ForgeCartPage.vue')),
    impulse: lazy(() => import('./impulse/ImpulseCartPage.vue'))
  },
  Checkout: {
    editorial: lazy(() => import('./editorial/EditorialCheckoutPage.vue')),
    boutique: lazy(() => import('./boutique/BoutiqueCheckoutPage.vue')),
    promify: lazy(() => import('./promify/PromifyCheckoutPage.vue')),
    nova: lazy(() => import('./nova/NovaCheckoutPage.vue')),
    atelier: lazy(() => import('./atelier/AtelierCheckoutPage.vue')),
    drop: lazy(() => import('./drop/DropCheckoutPage.vue')),
    bloom: lazy(() => import('./bloom/BloomCheckoutPage.vue')),
    hearth: lazy(() => import('./hearth/HearthCheckoutPage.vue')),
    volt: lazy(() => import('./volt/VoltCheckoutPage.vue')),
    pulse: lazy(() => import('./pulse/PulseCheckoutPage.vue')),
    lumiere: lazy(() => import('./lumiere/LumiereCheckoutPage.vue')),
    trove: lazy(() => import('./trove/TroveCheckoutPage.vue')),
    forge: lazy(() => import('./forge/ForgeCheckoutPage.vue')),
    impulse: lazy(() => import('./impulse/ImpulseCheckoutPage.vue'))
  },
  Collection: {
    editorial: lazy(() => import('./editorial/EditorialCollectionPage.vue')),
    boutique: lazy(() => import('./boutique/BoutiqueCollectionPage.vue')),
    promify: lazy(() => import('./promify/PromifyCollectionPage.vue')),
    nova: lazy(() => import('./nova/NovaCollectionPage.vue')),
    atelier: lazy(() => import('./atelier/AtelierCollectionPage.vue')),
    drop: lazy(() => import('./drop/DropCollectionPage.vue')),
    bloom: lazy(() => import('./bloom/BloomCollectionPage.vue')),
    hearth: lazy(() => import('./hearth/HearthCollectionPage.vue')),
    volt: lazy(() => import('./volt/VoltCollectionPage.vue')),
    pulse: lazy(() => import('./pulse/PulseCollectionPage.vue')),
    lumiere: lazy(() => import('./lumiere/LumiereCollectionPage.vue')),
    trove: lazy(() => import('./trove/TroveCollectionPage.vue')),
    forge: lazy(() => import('./forge/ForgeCollectionPage.vue')),
    impulse: lazy(() => import('./impulse/ImpulseCollectionPage.vue'))
  },
  Deals: {
    editorial: lazy(() => import('./editorial/EditorialDealsPage.vue')),
    boutique: lazy(() => import('./boutique/BoutiqueDealsPage.vue')),
    promify: lazy(() => import('./promify/PromifyDealsPage.vue')),
    nova: lazy(() => import('./nova/NovaDealsPage.vue')),
    atelier: lazy(() => import('./atelier/AtelierDealsPage.vue')),
    drop: lazy(() => import('./drop/DropDealsPage.vue')),
    bloom: lazy(() => import('./bloom/BloomDealsPage.vue')),
    hearth: lazy(() => import('./hearth/HearthDealsPage.vue')),
    volt: lazy(() => import('./volt/VoltDealsPage.vue')),
    pulse: lazy(() => import('./pulse/PulseDealsPage.vue')),
    lumiere: lazy(() => import('./lumiere/LumiereDealsPage.vue')),
    trove: lazy(() => import('./trove/TroveDealsPage.vue')),
    forge: lazy(() => import('./forge/ForgeDealsPage.vue')),
    impulse: lazy(() => import('./impulse/ImpulseDealsPage.vue'))
  },
  Wishlist: {
    editorial: lazy(() => import('./editorial/EditorialWishlistPage.vue')),
    boutique: lazy(() => import('./boutique/BoutiqueWishlistPage.vue')),
    promify: lazy(() => import('./promify/PromifyWishlistPage.vue')),
    nova: lazy(() => import('./nova/NovaWishlistPage.vue')),
    atelier: lazy(() => import('./atelier/AtelierWishlistPage.vue')),
    drop: lazy(() => import('./drop/DropWishlistPage.vue')),
    bloom: lazy(() => import('./bloom/BloomWishlistPage.vue')),
    hearth: lazy(() => import('./hearth/HearthWishlistPage.vue')),
    volt: lazy(() => import('./volt/VoltWishlistPage.vue')),
    pulse: lazy(() => import('./pulse/PulseWishlistPage.vue')),
    lumiere: lazy(() => import('./lumiere/LumiereWishlistPage.vue')),
    trove: lazy(() => import('./trove/TroveWishlistPage.vue')),
    forge: lazy(() => import('./forge/ForgeWishlistPage.vue')),
    impulse: lazy(() => import('./impulse/ImpulseWishlistPage.vue'))
  },
  NewArrivals: {
    editorial: lazy(() => import('./editorial/EditorialNewArrivalsPage.vue')),
    boutique: lazy(() => import('./boutique/BoutiqueNewArrivalsPage.vue')),
    promify: lazy(() => import('./promify/PromifyNewArrivalsPage.vue')),
    nova: lazy(() => import('./nova/NovaNewArrivalsPage.vue')),
    atelier: lazy(() => import('./atelier/AtelierNewArrivalsPage.vue')),
    drop: lazy(() => import('./drop/DropNewArrivalsPage.vue')),
    bloom: lazy(() => import('./bloom/BloomNewArrivalsPage.vue')),
    hearth: lazy(() => import('./hearth/HearthNewArrivalsPage.vue')),
    volt: lazy(() => import('./volt/VoltNewArrivalsPage.vue')),
    pulse: lazy(() => import('./pulse/PulseNewArrivalsPage.vue')),
    lumiere: lazy(() => import('./lumiere/LumiereNewArrivalsPage.vue')),
    trove: lazy(() => import('./trove/TroveNewArrivalsPage.vue')),
    forge: lazy(() => import('./forge/ForgeNewArrivalsPage.vue')),
    impulse: lazy(() => import('./impulse/ImpulseNewArrivalsPage.vue'))
  },
  // Only impulse has its own confirmation presentation for now — every other
  // template falls through to the generic ConfirmationPage below (see this
  // component's own top-of-file comment: "an unmapped (page, template) pair
  // also renders the fallback").
  Confirmation: {
    impulse: lazy(() => import('./impulse/ImpulseConfirmationPage.vue'))
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
  <component :is="resolved" v-if="resolved" v-bind="pageProps ?? {}">
    <slot />
  </component>
</template>
