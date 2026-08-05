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
// why, INCLUDING why it's not wrapped in <Suspense> (tried, reverted — CLS=1.0
// regression) and instead uses Vue 3.5's `hydrate: hydrateOnIdle()` lazy-
// hydration strategy via the `lazy()` helper, which avoids both that
// regression AND the hydration-mismatch warning a bare unresolved async
// component triggers without it.
import { defineAsyncComponent, hydrateOnIdle, type Component } from 'vue'

function lazy(loader: () => Promise<{ default: Component }>) {
  return defineAsyncComponent({ loader, hydrate: hydrateOnIdle() })
}
import HomeHero from './home/HomeHero.vue'
import HomeFeaturedCategories from './home/HomeFeaturedCategories.vue'
import HomeProductGrid from './home/HomeProductGrid.vue'
import HomeUsps from './home/HomeUsps.vue'
import ProductCard from './ProductCard.vue'
import LeadFormFields from './LeadFormFields.vue'
import BaseButton from './ui/Button.vue'
import BaseLandingPageLeadCard from './LandingPageLeadCard.vue'

// (section, template) → component. Missing entry = fallback to the minimal
// (bare) component in the FALLBACK map. This is the one place the template-
// override registry lives — add a new section or template here.
const OVERRIDES: Record<string, Record<string, Component>> = {
  HomeHero: {
    editorial: lazy(() => import('./editorial/EditorialHomeHero.vue')),
    boutique: lazy(() => import('./boutique/BoutiqueHomeHero.vue')),
    promify: lazy(() => import('./promify/PromifyHomeHero.vue')),
    nova: lazy(() => import('./nova/NovaHomeHero.vue')),
    atelier: lazy(() => import('./atelier/AtelierHomeHero.vue')),
    drop: lazy(() => import('./drop/DropHomeHero.vue')),
    bloom: lazy(() => import('./bloom/BloomHomeHero.vue')),
    hearth: lazy(() => import('./hearth/HearthHomeHero.vue')),
    volt: lazy(() => import('./volt/VoltHomeHero.vue')),
    pulse: lazy(() => import('./pulse/PulseHomeHero.vue')),
    lumiere: lazy(() => import('./lumiere/LumiereHomeHero.vue')),
    trove: lazy(() => import('./trove/TroveHomeHero.vue')),
    forge: lazy(() => import('./forge/ForgeHomeHero.vue')),
    impulse: lazy(() => import('./impulse/ImpulseHomeHero.vue'))
  },
  HomeUsps: {
    editorial: lazy(() => import('./editorial/EditorialHomeUsps.vue')),
    boutique: lazy(() => import('./boutique/BoutiqueHomeUsps.vue')),
    promify: lazy(() => import('./promify/PromifyHomeUsps.vue')),
    nova: lazy(() => import('./nova/NovaHomeUsps.vue')),
    atelier: lazy(() => import('./atelier/AtelierHomeUsps.vue')),
    drop: lazy(() => import('./drop/DropHomeUsps.vue')),
    bloom: lazy(() => import('./bloom/BloomHomeUsps.vue')),
    hearth: lazy(() => import('./hearth/HearthHomeUsps.vue')),
    volt: lazy(() => import('./volt/VoltHomeUsps.vue')),
    pulse: lazy(() => import('./pulse/PulseHomeUsps.vue')),
    lumiere: lazy(() => import('./lumiere/LumiereHomeUsps.vue')),
    trove: lazy(() => import('./trove/TroveHomeUsps.vue')),
    forge: lazy(() => import('./forge/ForgeHomeUsps.vue')),
    impulse: lazy(() => import('./impulse/ImpulseHomeUsps.vue'))
  },
  ProductCard: {
    editorial: lazy(() => import('./editorial/EditorialProductCard.vue')),
    boutique: lazy(() => import('./boutique/BoutiqueProductCard.vue')),
    promify: lazy(() => import('./promify/PromifyProductCard.vue')),
    nova: lazy(() => import('./nova/NovaProductCard.vue')),
    atelier: lazy(() => import('./atelier/AtelierProductCard.vue')),
    drop: lazy(() => import('./drop/DropProductCard.vue')),
    bloom: lazy(() => import('./bloom/BloomProductCard.vue')),
    hearth: lazy(() => import('./hearth/HearthProductCard.vue')),
    volt: lazy(() => import('./volt/VoltProductCard.vue')),
    pulse: lazy(() => import('./pulse/PulseProductCard.vue')),
    lumiere: lazy(() => import('./lumiere/LumiereProductCard.vue')),
    trove: lazy(() => import('./trove/TroveProductCard.vue')),
    forge: lazy(() => import('./forge/ForgeProductCard.vue')),
    impulse: lazy(() => import('./impulse/ImpulseProductCard.vue'))
  },
  // Used by the PDP lead form of every template AND the standalone AI
  // landing-page funnel (app/pages/lp/[productSlug]/[number].vue) — the
  // latter deliberately reuses this instead of the plain base
  // LeadFormFields.vue so a visitor sees the exact same form UI as the
  // active template's normal product page, not a generic one.
  LeadFormFields: {
    editorial: lazy(() => import('./editorial/EditorialLeadFormFields.vue')),
    boutique: lazy(() => import('./boutique/BoutiqueLeadFormFields.vue')),
    promify: lazy(() => import('./promify/PromifyLeadFormFields.vue')),
    nova: lazy(() => import('./nova/NovaLeadFormFields.vue')),
    atelier: lazy(() => import('./atelier/AtelierLeadFormFields.vue')),
    drop: lazy(() => import('./drop/DropLeadFormFields.vue')),
    bloom: lazy(() => import('./bloom/BloomLeadFormFields.vue')),
    hearth: lazy(() => import('./hearth/HearthLeadFormFields.vue')),
    volt: lazy(() => import('./volt/VoltLeadFormFields.vue')),
    pulse: lazy(() => import('./pulse/PulseLeadFormFields.vue')),
    lumiere: lazy(() => import('./lumiere/LumiereLeadFormFields.vue')),
    trove: lazy(() => import('./trove/TroveLeadFormFields.vue')),
    forge: lazy(() => import('./forge/ForgeLeadFormFields.vue')),
    impulse: lazy(() => import('./impulse/ImpulseLeadFormFields.vue'))
  },
  // Every template's own submit/CTA button — used by the AI landing-page
  // funnel's "Order now" action so it's not just the form fields that match
  // the active template, but the button next to them too (each template's
  // real PDP pairs its LeadFormFields with its own Button, never the base
  // one — e.g. Impulse's lead form always submits via ImpulseButton).
  // Common prop surface across all of them: to/type/variant/size('sm'|'md'|
  // 'lg')/block/disabled/loading/icon/trailingIcon — callers should stick to
  // that intersection rather than a template-specific prop (e.g. 'xl' size
  // or a 'dark' variant aren't universal).
  Button: {
    editorial: lazy(() => import('./editorial/ui/EditorialButton.vue')),
    boutique: lazy(() => import('./boutique/ui/BoutiqueButton.vue')),
    promify: lazy(() => import('./promify/ui/PromifyButton.vue')),
    nova: lazy(() => import('./nova/ui/NovaButton.vue')),
    atelier: lazy(() => import('./atelier/ui/AtelierButton.vue')),
    drop: lazy(() => import('./drop/ui/DropButton.vue')),
    bloom: lazy(() => import('./bloom/ui/BloomButton.vue')),
    hearth: lazy(() => import('./hearth/ui/HearthButton.vue')),
    volt: lazy(() => import('./volt/ui/VoltButton.vue')),
    pulse: lazy(() => import('./pulse/ui/PulseButton.vue')),
    lumiere: lazy(() => import('./lumiere/ui/LumiereButton.vue')),
    trove: lazy(() => import('./trove/ui/TroveButton.vue')),
    forge: lazy(() => import('./forge/ui/ForgeButton.vue')),
    impulse: lazy(() => import('./impulse/ui/ImpulseButton.vue'))
  },
  // The AI landing-page funnel's entire lead-capture block (price + form +
  // CTA), for templates that need more than "swap the form fields and
  // button" to actually look like their own PDP — e.g. Impulse's PDP wraps
  // its lead form in `funnel-card` panels with an urgency countdown, a
  // free-delivery badge, a pulsing CTA, and a trust row; none of that comes
  // for free just by swapping LeadFormFields/Button. Templates without an
  // entry here fall back to LandingPageLeadCard.vue (FALLBACK below), which
  // is still template-correct for its LeadFormFields/Button, just in a
  // plain generic shell rather than a bespoke recreation of that template's
  // PDP layout.
  LandingPageLeadCard: {
    impulse: lazy(() => import('./impulse/ImpulseLandingPageLeadCard.vue'))
  }
}

// Sections without per-template variants — rendered directly by name.
const FALLBACK: Record<string, Component> = {
  HomeHero,
  HomeFeaturedCategories,
  HomeProductGrid,
  HomeUsps,
  ProductCard,
  LeadFormFields,
  Button: BaseButton,
  LandingPageLeadCard: BaseLandingPageLeadCard
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
