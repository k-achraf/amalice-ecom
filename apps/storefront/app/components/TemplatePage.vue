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
import type { Component } from 'vue'

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

// ---- editorial overrides ----
import EditorialCatalogPage from './editorial/EditorialCatalogPage.vue'
import EditorialProductDetailPage from './editorial/EditorialProductDetailPage.vue'
import EditorialCartPage from './editorial/EditorialCartPage.vue'
import EditorialCheckoutPage from './editorial/EditorialCheckoutPage.vue'
import EditorialCollectionPage from './editorial/EditorialCollectionPage.vue'
import EditorialDealsPage from './editorial/EditorialDealsPage.vue'
import EditorialWishlistPage from './editorial/EditorialWishlistPage.vue'
import EditorialNewArrivalsPage from './editorial/EditorialNewArrivalsPage.vue'

// ---- boutique overrides ----
import BoutiqueCatalogPage from './boutique/BoutiqueCatalogPage.vue'
import BoutiqueProductDetailPage from './boutique/BoutiqueProductDetailPage.vue'
import BoutiqueCartPage from './boutique/BoutiqueCartPage.vue'
import BoutiqueCheckoutPage from './boutique/BoutiqueCheckoutPage.vue'
import BoutiqueCollectionPage from './boutique/BoutiqueCollectionPage.vue'
import BoutiqueDealsPage from './boutique/BoutiqueDealsPage.vue'
import BoutiqueWishlistPage from './boutique/BoutiqueWishlistPage.vue'
import BoutiqueNewArrivalsPage from './boutique/BoutiqueNewArrivalsPage.vue'

// ---- promify overrides ----
import PromifyCatalogPage from './promify/PromifyCatalogPage.vue'
import PromifyProductDetailPage from './promify/PromifyProductDetailPage.vue'
import PromifyCartPage from './promify/PromifyCartPage.vue'
import PromifyCheckoutPage from './promify/PromifyCheckoutPage.vue'
import PromifyCollectionPage from './promify/PromifyCollectionPage.vue'
import PromifyDealsPage from './promify/PromifyDealsPage.vue'
import PromifyWishlistPage from './promify/PromifyWishlistPage.vue'
import PromifyNewArrivalsPage from './promify/PromifyNewArrivalsPage.vue'

// ---- nova overrides ----
import NovaCatalogPage from './nova/NovaCatalogPage.vue'
import NovaProductDetailPage from './nova/NovaProductDetailPage.vue'
import NovaCartPage from './nova/NovaCartPage.vue'
import NovaCheckoutPage from './nova/NovaCheckoutPage.vue'
import NovaCollectionPage from './nova/NovaCollectionPage.vue'
import NovaDealsPage from './nova/NovaDealsPage.vue'
import NovaWishlistPage from './nova/NovaWishlistPage.vue'
import NovaNewArrivalsPage from './nova/NovaNewArrivalsPage.vue'

// ---- atelier overrides ----
import AtelierCatalogPage from './atelier/AtelierCatalogPage.vue'
import AtelierProductDetailPage from './atelier/AtelierProductDetailPage.vue'
import AtelierCartPage from './atelier/AtelierCartPage.vue'
import AtelierCheckoutPage from './atelier/AtelierCheckoutPage.vue'
import AtelierCollectionPage from './atelier/AtelierCollectionPage.vue'
import AtelierDealsPage from './atelier/AtelierDealsPage.vue'
import AtelierWishlistPage from './atelier/AtelierWishlistPage.vue'
import AtelierNewArrivalsPage from './atelier/AtelierNewArrivalsPage.vue'

// ---- drop overrides ----
import DropCatalogPage from './drop/DropCatalogPage.vue'
import DropProductDetailPage from './drop/DropProductDetailPage.vue'
import DropCartPage from './drop/DropCartPage.vue'
import DropCheckoutPage from './drop/DropCheckoutPage.vue'
import DropCollectionPage from './drop/DropCollectionPage.vue'
import DropDealsPage from './drop/DropDealsPage.vue'
import DropWishlistPage from './drop/DropWishlistPage.vue'
import DropNewArrivalsPage from './drop/DropNewArrivalsPage.vue'

// ---- bloom overrides ----
import BloomCatalogPage from './bloom/BloomCatalogPage.vue'
import BloomProductDetailPage from './bloom/BloomProductDetailPage.vue'
import BloomCartPage from './bloom/BloomCartPage.vue'
import BloomCheckoutPage from './bloom/BloomCheckoutPage.vue'
import BloomCollectionPage from './bloom/BloomCollectionPage.vue'
import BloomDealsPage from './bloom/BloomDealsPage.vue'
import BloomWishlistPage from './bloom/BloomWishlistPage.vue'
import BloomNewArrivalsPage from './bloom/BloomNewArrivalsPage.vue'

// ---- hearth overrides ----
import HearthCatalogPage from './hearth/HearthCatalogPage.vue'
import HearthProductDetailPage from './hearth/HearthProductDetailPage.vue'
import HearthCartPage from './hearth/HearthCartPage.vue'
import HearthCheckoutPage from './hearth/HearthCheckoutPage.vue'
import HearthCollectionPage from './hearth/HearthCollectionPage.vue'
import HearthDealsPage from './hearth/HearthDealsPage.vue'
import HearthWishlistPage from './hearth/HearthWishlistPage.vue'
import HearthNewArrivalsPage from './hearth/HearthNewArrivalsPage.vue'

// ---- volt overrides ----
import VoltCatalogPage from './volt/VoltCatalogPage.vue'
import VoltProductDetailPage from './volt/VoltProductDetailPage.vue'
import VoltCartPage from './volt/VoltCartPage.vue'
import VoltCheckoutPage from './volt/VoltCheckoutPage.vue'
import VoltCollectionPage from './volt/VoltCollectionPage.vue'
import VoltDealsPage from './volt/VoltDealsPage.vue'
import VoltWishlistPage from './volt/VoltWishlistPage.vue'
import VoltNewArrivalsPage from './volt/VoltNewArrivalsPage.vue'

// ---- pulse overrides ----
import PulseCatalogPage from './pulse/PulseCatalogPage.vue'
import PulseProductDetailPage from './pulse/PulseProductDetailPage.vue'
import PulseCartPage from './pulse/PulseCartPage.vue'
import PulseCheckoutPage from './pulse/PulseCheckoutPage.vue'
import PulseCollectionPage from './pulse/PulseCollectionPage.vue'
import PulseDealsPage from './pulse/PulseDealsPage.vue'
import PulseWishlistPage from './pulse/PulseWishlistPage.vue'
import PulseNewArrivalsPage from './pulse/PulseNewArrivalsPage.vue'

// ---- lumiere overrides ----
import LumiereCatalogPage from './lumiere/LumiereCatalogPage.vue'
import LumiereProductDetailPage from './lumiere/LumiereProductDetailPage.vue'
import LumiereCartPage from './lumiere/LumiereCartPage.vue'
import LumiereCheckoutPage from './lumiere/LumiereCheckoutPage.vue'
import LumiereCollectionPage from './lumiere/LumiereCollectionPage.vue'
import LumiereDealsPage from './lumiere/LumiereDealsPage.vue'
import LumiereWishlistPage from './lumiere/LumiereWishlistPage.vue'
import LumiereNewArrivalsPage from './lumiere/LumiereNewArrivalsPage.vue'

// ---- trove overrides ----
import TroveCatalogPage from './trove/TroveCatalogPage.vue'
import TroveProductDetailPage from './trove/TroveProductDetailPage.vue'
import TroveCartPage from './trove/TroveCartPage.vue'
import TroveCheckoutPage from './trove/TroveCheckoutPage.vue'
import TroveCollectionPage from './trove/TroveCollectionPage.vue'
import TroveDealsPage from './trove/TroveDealsPage.vue'
import TroveWishlistPage from './trove/TroveWishlistPage.vue'
import TroveNewArrivalsPage from './trove/TroveNewArrivalsPage.vue'

// ---- forge overrides ----
import ForgeCatalogPage from './forge/ForgeCatalogPage.vue'
import ForgeProductDetailPage from './forge/ForgeProductDetailPage.vue'
import ForgeCartPage from './forge/ForgeCartPage.vue'
import ForgeCheckoutPage from './forge/ForgeCheckoutPage.vue'
import ForgeCollectionPage from './forge/ForgeCollectionPage.vue'
import ForgeDealsPage from './forge/ForgeDealsPage.vue'
import ForgeWishlistPage from './forge/ForgeWishlistPage.vue'
import ForgeNewArrivalsPage from './forge/ForgeNewArrivalsPage.vue'

// ---- impulse overrides ----
import ImpulseCatalogPage from './impulse/ImpulseCatalogPage.vue'
import ImpulseProductDetailPage from './impulse/ImpulseProductDetailPage.vue'
import ImpulseCartPage from './impulse/ImpulseCartPage.vue'
import ImpulseCheckoutPage from './impulse/ImpulseCheckoutPage.vue'
import ImpulseCollectionPage from './impulse/ImpulseCollectionPage.vue'
import ImpulseDealsPage from './impulse/ImpulseDealsPage.vue'
import ImpulseWishlistPage from './impulse/ImpulseWishlistPage.vue'
import ImpulseNewArrivalsPage from './impulse/ImpulseNewArrivalsPage.vue'
import ImpulseConfirmationPage from './impulse/ImpulseConfirmationPage.vue'

// (pageName, template) → component. Missing entry → fallback below.
const OVERRIDES: Record<string, Record<string, Component>> = {
  Catalog: {
    editorial: EditorialCatalogPage,
    boutique: BoutiqueCatalogPage,
    promify: PromifyCatalogPage,
    nova: NovaCatalogPage,
    atelier: AtelierCatalogPage,
    drop: DropCatalogPage,
    bloom: BloomCatalogPage,
    hearth: HearthCatalogPage,
    volt: VoltCatalogPage,
    pulse: PulseCatalogPage,
    lumiere: LumiereCatalogPage,
    trove: TroveCatalogPage,
    forge: ForgeCatalogPage,
    impulse: ImpulseCatalogPage
  },
  ProductDetail: {
    editorial: EditorialProductDetailPage,
    boutique: BoutiqueProductDetailPage,
    promify: PromifyProductDetailPage,
    nova: NovaProductDetailPage,
    atelier: AtelierProductDetailPage,
    drop: DropProductDetailPage,
    bloom: BloomProductDetailPage,
    hearth: HearthProductDetailPage,
    volt: VoltProductDetailPage,
    pulse: PulseProductDetailPage,
    lumiere: LumiereProductDetailPage,
    trove: TroveProductDetailPage,
    forge: ForgeProductDetailPage,
    impulse: ImpulseProductDetailPage
  },
  Cart: {
    editorial: EditorialCartPage,
    boutique: BoutiqueCartPage,
    promify: PromifyCartPage,
    nova: NovaCartPage,
    atelier: AtelierCartPage,
    drop: DropCartPage,
    bloom: BloomCartPage,
    hearth: HearthCartPage,
    volt: VoltCartPage,
    pulse: PulseCartPage,
    lumiere: LumiereCartPage,
    trove: TroveCartPage,
    forge: ForgeCartPage,
    impulse: ImpulseCartPage
  },
  Checkout: {
    editorial: EditorialCheckoutPage,
    boutique: BoutiqueCheckoutPage,
    promify: PromifyCheckoutPage,
    nova: NovaCheckoutPage,
    atelier: AtelierCheckoutPage,
    drop: DropCheckoutPage,
    bloom: BloomCheckoutPage,
    hearth: HearthCheckoutPage,
    volt: VoltCheckoutPage,
    pulse: PulseCheckoutPage,
    lumiere: LumiereCheckoutPage,
    trove: TroveCheckoutPage,
    forge: ForgeCheckoutPage,
    impulse: ImpulseCheckoutPage
  },
  Collection: {
    editorial: EditorialCollectionPage,
    boutique: BoutiqueCollectionPage,
    promify: PromifyCollectionPage,
    nova: NovaCollectionPage,
    atelier: AtelierCollectionPage,
    drop: DropCollectionPage,
    bloom: BloomCollectionPage,
    hearth: HearthCollectionPage,
    volt: VoltCollectionPage,
    pulse: PulseCollectionPage,
    lumiere: LumiereCollectionPage,
    trove: TroveCollectionPage,
    forge: ForgeCollectionPage,
    impulse: ImpulseCollectionPage
  },
  Deals: {
    editorial: EditorialDealsPage,
    boutique: BoutiqueDealsPage,
    promify: PromifyDealsPage,
    nova: NovaDealsPage,
    atelier: AtelierDealsPage,
    drop: DropDealsPage,
    bloom: BloomDealsPage,
    hearth: HearthDealsPage,
    volt: VoltDealsPage,
    pulse: PulseDealsPage,
    lumiere: LumiereDealsPage,
    trove: TroveDealsPage,
    forge: ForgeDealsPage,
    impulse: ImpulseDealsPage
  },
  Wishlist: {
    editorial: EditorialWishlistPage,
    boutique: BoutiqueWishlistPage,
    promify: PromifyWishlistPage,
    nova: NovaWishlistPage,
    atelier: AtelierWishlistPage,
    drop: DropWishlistPage,
    bloom: BloomWishlistPage,
    hearth: HearthWishlistPage,
    volt: VoltWishlistPage,
    pulse: PulseWishlistPage,
    lumiere: LumiereWishlistPage,
    trove: TroveWishlistPage,
    forge: ForgeWishlistPage,
    impulse: ImpulseWishlistPage
  },
  NewArrivals: {
    editorial: EditorialNewArrivalsPage,
    boutique: BoutiqueNewArrivalsPage,
    promify: PromifyNewArrivalsPage,
    nova: NovaNewArrivalsPage,
    atelier: AtelierNewArrivalsPage,
    drop: DropNewArrivalsPage,
    bloom: BloomNewArrivalsPage,
    hearth: HearthNewArrivalsPage,
    volt: VoltNewArrivalsPage,
    pulse: PulseNewArrivalsPage,
    lumiere: LumiereNewArrivalsPage,
    trove: TroveNewArrivalsPage,
    forge: ForgeNewArrivalsPage,
    impulse: ImpulseNewArrivalsPage
  },
  // Only impulse has its own confirmation presentation for now — every other
  // template falls through to the generic ConfirmationPage below (see this
  // component's own top-of-file comment: "an unmapped (page, template) pair
  // also renders the fallback").
  Confirmation: {
    impulse: ImpulseConfirmationPage
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
