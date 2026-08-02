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
//
// PERFORMANCE: every override is `defineAsyncComponent` (dynamic import), not
// a static top-level import — see TemplatePage.vue's identical comment for
// why, including why the <Suspense> wrapper below is required (not
// decorative) to avoid a client hydration mismatch against the SSR-rendered
// async subtree.
import { defineAsyncComponent, type Component } from 'vue'
import HomeHero from './home/HomeHero.vue'
import HomeFeaturedCategories from './home/HomeFeaturedCategories.vue'
import HomeProductGrid from './home/HomeProductGrid.vue'
import HomeUsps from './home/HomeUsps.vue'
import ProductCard from './ProductCard.vue'

// (section, template) → component. Missing entry = fallback to the minimal
// (bare) component in the FALLBACK map. This is the one place the template-
// override registry lives — add a new section or template here.
const OVERRIDES: Record<string, Record<string, Component>> = {
  HomeHero: {
    editorial: defineAsyncComponent(() => import('./editorial/EditorialHomeHero.vue')),
    boutique: defineAsyncComponent(() => import('./boutique/BoutiqueHomeHero.vue')),
    promify: defineAsyncComponent(() => import('./promify/PromifyHomeHero.vue')),
    nova: defineAsyncComponent(() => import('./nova/NovaHomeHero.vue')),
    atelier: defineAsyncComponent(() => import('./atelier/AtelierHomeHero.vue')),
    drop: defineAsyncComponent(() => import('./drop/DropHomeHero.vue')),
    bloom: defineAsyncComponent(() => import('./bloom/BloomHomeHero.vue')),
    hearth: defineAsyncComponent(() => import('./hearth/HearthHomeHero.vue')),
    volt: defineAsyncComponent(() => import('./volt/VoltHomeHero.vue')),
    pulse: defineAsyncComponent(() => import('./pulse/PulseHomeHero.vue')),
    lumiere: defineAsyncComponent(() => import('./lumiere/LumiereHomeHero.vue')),
    trove: defineAsyncComponent(() => import('./trove/TroveHomeHero.vue')),
    forge: defineAsyncComponent(() => import('./forge/ForgeHomeHero.vue')),
    impulse: defineAsyncComponent(() => import('./impulse/ImpulseHomeHero.vue'))
  },
  HomeUsps: {
    editorial: defineAsyncComponent(() => import('./editorial/EditorialHomeUsps.vue')),
    boutique: defineAsyncComponent(() => import('./boutique/BoutiqueHomeUsps.vue')),
    promify: defineAsyncComponent(() => import('./promify/PromifyHomeUsps.vue')),
    nova: defineAsyncComponent(() => import('./nova/NovaHomeUsps.vue')),
    atelier: defineAsyncComponent(() => import('./atelier/AtelierHomeUsps.vue')),
    drop: defineAsyncComponent(() => import('./drop/DropHomeUsps.vue')),
    bloom: defineAsyncComponent(() => import('./bloom/BloomHomeUsps.vue')),
    hearth: defineAsyncComponent(() => import('./hearth/HearthHomeUsps.vue')),
    volt: defineAsyncComponent(() => import('./volt/VoltHomeUsps.vue')),
    pulse: defineAsyncComponent(() => import('./pulse/PulseHomeUsps.vue')),
    lumiere: defineAsyncComponent(() => import('./lumiere/LumiereHomeUsps.vue')),
    trove: defineAsyncComponent(() => import('./trove/TroveHomeUsps.vue')),
    forge: defineAsyncComponent(() => import('./forge/ForgeHomeUsps.vue')),
    impulse: defineAsyncComponent(() => import('./impulse/ImpulseHomeUsps.vue'))
  },
  ProductCard: {
    editorial: defineAsyncComponent(() => import('./editorial/EditorialProductCard.vue')),
    boutique: defineAsyncComponent(() => import('./boutique/BoutiqueProductCard.vue')),
    promify: defineAsyncComponent(() => import('./promify/PromifyProductCard.vue')),
    nova: defineAsyncComponent(() => import('./nova/NovaProductCard.vue')),
    atelier: defineAsyncComponent(() => import('./atelier/AtelierProductCard.vue')),
    drop: defineAsyncComponent(() => import('./drop/DropProductCard.vue')),
    bloom: defineAsyncComponent(() => import('./bloom/BloomProductCard.vue')),
    hearth: defineAsyncComponent(() => import('./hearth/HearthProductCard.vue')),
    volt: defineAsyncComponent(() => import('./volt/VoltProductCard.vue')),
    pulse: defineAsyncComponent(() => import('./pulse/PulseProductCard.vue')),
    lumiere: defineAsyncComponent(() => import('./lumiere/LumiereProductCard.vue')),
    trove: defineAsyncComponent(() => import('./trove/TroveProductCard.vue')),
    forge: defineAsyncComponent(() => import('./forge/ForgeProductCard.vue')),
    impulse: defineAsyncComponent(() => import('./impulse/ImpulseProductCard.vue'))
  }
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
  <Suspense v-if="resolved">
    <component :is="resolved" v-bind="sectionProps ?? {}">
      <slot />
    </component>
  </Suspense>
</template>
