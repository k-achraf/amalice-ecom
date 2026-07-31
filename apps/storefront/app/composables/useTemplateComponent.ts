import { resolveComponent } from 'vue'
import type { StoreTemplate } from '@amalice/shared'

// The template-section resolver. Pages stay single-sourced for LOGIC (data
// fetching, cart mutations, order placement, structured data) but delegate PRESENTATION
// to section components. A template overrides a section by providing a
// component named `${CapitalizedTemplate}${Section}`; otherwise the fallback
// `${Section}` renders.
//
// Naming convention (auto-imported by Nuxt with components: pathPrefix:false):
//   section "ProductCard"  → fallback <ProductCard>
//   editorial override     → <EditorialProductCard>
//   boutique override      → <BoutiqueProductCard>
//
// The actual rendering goes through the <TemplateSection> component
// (components/TemplateSection.vue), which is auto-imported. This composable is
// kept for any non-template (programmatic) resolution needs.
const TEMPLATE_PREFIX: Record<StoreTemplate, string> = {
  minimal: '',
  editorial: 'Editorial',
  boutique: 'Boutique',
  promify: 'Promify',
  nova: 'Nova',
  atelier: 'Atelier',
  drop: 'Drop',
  bloom: 'Bloom',
  hearth: 'Hearth',
  volt: 'Volt',
  pulse: 'Pulse',
  lumiere: 'Lumiere',
  trove: 'Trove',
  forge: 'Forge',
  impulse: 'Impulse'
}

export function useTemplateComponent() {
  const settings = useStoreSettings()
  return (section: string) => {
    const template = settings.value.activeTemplate
    const prefix = TEMPLATE_PREFIX[template]
    const name = prefix ? `${prefix}${section}` : section
    return resolveComponent(name)
  }
}
