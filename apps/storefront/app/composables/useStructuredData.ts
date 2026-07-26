// SF-19 — one consistent structured-data (JSON-LD) helper. Pages call the
// relevant function and the composable injects the script via useHead. Avoids
// per-page ad-hoc useHead script blocks drifting out of sync.
import type { Product, Category } from '@amalice/shared'

interface RatingSummaryLike {
  average: number | null
  count: number
}

export function useStructuredData() {
  const config = useRuntimeConfig()
  const siteUrl = config.public.siteUrl as string

  // Product (PDP). Includes offers; aggregateRating + image gallery when present.
  function product(p: Product, opts?: { rating?: RatingSummaryLike; images?: string[] }) {
    const data: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      description: p.description ?? undefined,
      image: opts?.images?.length ? opts.images : p.imageUrl ? [p.imageUrl] : undefined,
      sku: p.id,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'USD',
        price: (p.priceCents / 100).toFixed(2),
        availability: p.stockQuantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
      }
    }
    if (opts?.rating && opts.rating.count > 0 && opts.rating.average !== null) {
      data.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: opts.rating.average.toFixed(1),
        reviewCount: opts.rating.count
      }
    }
    useHead({ script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(data) }] })
  }

  // ItemList (catalog/collections page).
  function itemList(items: Product[], name: string) {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name,
      numberOfItems: items.length,
      itemListElement: items.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${siteUrl}/products/${p.slug}`,
        name: p.name
      }))
    }
    useHead({ script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(data) }] })
  }

  // BreadcrumbList (collections, PDP).
  function breadcrumbs(crumbs: { name: string; path: string }[]) {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        item: `${siteUrl}${c.path}`
      }))
    }
    useHead({ script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(data) }] })
  }

  // Organization + WebSite (home page).
  function organization() {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Amalice',
      url: siteUrl,
      description: 'Cash on delivery shopping, no account required.'
    }
    useHead({ script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(data) }] })
  }

  function website() {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Amalice',
      url: siteUrl
    }
    useHead({ script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(data) }] })
  }

  function collection(c: Category) {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: c.name,
      description: c.description ?? undefined,
      url: `${siteUrl}/collections/${c.slug}`
    }
    useHead({ script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(data) }] })
  }

  return { product, itemList, breadcrumbs, organization, website, collection }
}
