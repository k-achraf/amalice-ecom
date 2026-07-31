<script setup lang="ts">
// The template-section resolver component. Pages render
// <TemplateSection name="HomeHero" :section-props="..."> and this resolves the
// right component for the active storefront template (e.g. EditorialHomeHero
// when editorial is active), falling back to the bare name (HomeHero).
//
// Why explicit imports + a static map (not resolveComponent): resolveComponent
// relies on the component being resolvable at call time via Nuxt's runtime
// context, which doesn't reliably work for auto-imported components during SSR
// render of <component :is> (they render as unknown custom elements instead).
// Explicit imports make resolution deterministic and SSR-safe. The set of
// sections is finite, so a static map is appropriate.
import type { Component } from 'vue'
import HomeHero from './home/HomeHero.vue'
import HomeFeaturedCategories from './home/HomeFeaturedCategories.vue'
import HomeProductGrid from './home/HomeProductGrid.vue'
import HomeUsps from './home/HomeUsps.vue'
import ProductCard from './ProductCard.vue'
import EditorialHomeHero from './editorial/EditorialHomeHero.vue'
import EditorialHomeUsps from './editorial/EditorialHomeUsps.vue'
import EditorialProductCard from './editorial/EditorialProductCard.vue'
import BoutiqueHomeHero from './boutique/BoutiqueHomeHero.vue'
import BoutiqueHomeUsps from './boutique/BoutiqueHomeUsps.vue'
import BoutiqueProductCard from './boutique/BoutiqueProductCard.vue'
import PromifyHomeHero from './promify/PromifyHomeHero.vue'
import PromifyHomeUsps from './promify/PromifyHomeUsps.vue'
import PromifyProductCard from './promify/PromifyProductCard.vue'
import NovaHomeHero from './nova/NovaHomeHero.vue'
import NovaHomeUsps from './nova/NovaHomeUsps.vue'
import NovaProductCard from './nova/NovaProductCard.vue'
import AtelierHomeHero from './atelier/AtelierHomeHero.vue'
import AtelierHomeUsps from './atelier/AtelierHomeUsps.vue'
import AtelierProductCard from './atelier/AtelierProductCard.vue'
import DropHomeHero from './drop/DropHomeHero.vue'
import DropHomeUsps from './drop/DropHomeUsps.vue'
import DropProductCard from './drop/DropProductCard.vue'
import BloomHomeHero from './bloom/BloomHomeHero.vue'
import BloomHomeUsps from './bloom/BloomHomeUsps.vue'
import BloomProductCard from './bloom/BloomProductCard.vue'
import HearthHomeHero from './hearth/HearthHomeHero.vue'
import HearthHomeUsps from './hearth/HearthHomeUsps.vue'
import HearthProductCard from './hearth/HearthProductCard.vue'
import VoltHomeHero from './volt/VoltHomeHero.vue'
import VoltHomeUsps from './volt/VoltHomeUsps.vue'
import VoltProductCard from './volt/VoltProductCard.vue'
import PulseHomeHero from './pulse/PulseHomeHero.vue'
import PulseHomeUsps from './pulse/PulseHomeUsps.vue'
import PulseProductCard from './pulse/PulseProductCard.vue'
import LumiereHomeHero from './lumiere/LumiereHomeHero.vue'
import LumiereHomeUsps from './lumiere/LumiereHomeUsps.vue'
import LumiereProductCard from './lumiere/LumiereProductCard.vue'
import TroveHomeHero from './trove/TroveHomeHero.vue'
import TroveHomeUsps from './trove/TroveHomeUsps.vue'
import TroveProductCard from './trove/TroveProductCard.vue'
import ForgeHomeHero from './forge/ForgeHomeHero.vue'
import ForgeHomeUsps from './forge/ForgeHomeUsps.vue'
import ForgeProductCard from './forge/ForgeProductCard.vue'
import ImpulseHomeHero from './impulse/ImpulseHomeHero.vue'
import ImpulseHomeUsps from './impulse/ImpulseHomeUsps.vue'
import ImpulseProductCard from './impulse/ImpulseProductCard.vue'

// (section, template) → component. Missing entry = fallback to the minimal
// (bare) component in the FALLBACK map. This is the one place the template-
// override registry lives — add a new section or template here.
const OVERRIDES: Record<string, Record<string, Component>> = {
  HomeHero: { editorial: EditorialHomeHero, boutique: BoutiqueHomeHero, promify: PromifyHomeHero, nova: NovaHomeHero, atelier: AtelierHomeHero, drop: DropHomeHero, bloom: BloomHomeHero, hearth: HearthHomeHero, volt: VoltHomeHero, pulse: PulseHomeHero, lumiere: LumiereHomeHero, trove: TroveHomeHero, forge: ForgeHomeHero, impulse: ImpulseHomeHero },
  HomeUsps: { editorial: EditorialHomeUsps, boutique: BoutiqueHomeUsps, promify: PromifyHomeUsps, nova: NovaHomeUsps, atelier: AtelierHomeUsps, drop: DropHomeUsps, bloom: BloomHomeUsps, hearth: HearthHomeUsps, volt: VoltHomeUsps, pulse: PulseHomeUsps, lumiere: LumiereHomeUsps, trove: TroveHomeUsps, forge: ForgeHomeUsps, impulse: ImpulseHomeUsps },
  ProductCard: { editorial: EditorialProductCard, boutique: BoutiqueProductCard, promify: PromifyProductCard, nova: NovaProductCard, atelier: AtelierProductCard, drop: DropProductCard, bloom: BloomProductCard, hearth: HearthProductCard, volt: VoltProductCard, pulse: PulseProductCard, lumiere: LumiereProductCard, trove: TroveProductCard, forge: ForgeProductCard, impulse: ImpulseProductCard }
}

// Sections without per-template variants — rendered directly by name.
const FALLBACK: Record<string, Component> = {
  HomeHero,
  HomeFeaturedCategories,
  HomeProductGrid,
  HomeUsps,
  ProductCard
}

const props = defineProps<{
  name: string
  sectionProps?: Record<string, unknown>
}>()

const settings = useStoreSettings()

const resolved = computed<Component | null>(() => {
  const template = settings.value.activeTemplate
  const override = OVERRIDES[props.name]?.[template]
  if (override) return override
  return FALLBACK[props.name] ?? null
})
</script>

<template>
  <component :is="resolved" v-if="resolved" v-bind="sectionProps ?? {}">
    <slot />
  </component>
</template>
