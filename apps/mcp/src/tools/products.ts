import { z } from 'zod'
import { StockAdjustmentReasonSchema } from '@amalice/shared'
import { type ToolContext, safe } from './util.js'

// The API downloads whatever URL it is given, so refuse anything that points at
// the VPS itself or a private network before it gets there (SSRF guard).
function assertPublicUrl(raw: string) {
  const u = new URL(raw)
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http(s) image URLs are allowed')
  const h = u.hostname.toLowerCase()
  const privateHost =
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h === '[::1]' ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)
  if (privateHost) throw new Error('Image URL must be on the public internet')
}

function generatedSlug(name: string) {
  const base = name
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${base || 'product'}-${Math.random().toString(36).slice(2, 7)}`
}

export function registerProductTools({ server, api }: ToolContext) {
  server.registerTool(
    'list_products',
    {
      title: 'List products',
      description: 'Catalog products (including hidden ones) with stock. Prices are in cents.',
      inputSchema: {
        q: z.string().optional().describe('Search by name'),
        category: z.string().optional(),
        page: z.number().int().positive().default(1),
        pageSize: z.number().int().min(1).max(50).default(20)
      },
      annotations: { readOnlyHint: true }
    },
    safe((q) => api.get('/admin/products', q))
  )

  server.registerTool(
    'get_product',
    {
      title: 'Get product',
      description: 'One product with variants, images, offers, attributes and stock.',
      inputSchema: { productId: z.string() },
      annotations: { readOnlyHint: true }
    },
    safe(({ productId }) => api.get(`/admin/products/${productId}`))
  )

  server.registerTool(
    'list_low_stock',
    {
      title: 'Low-stock products',
      description: 'Products and variants that are at or below their low-stock threshold.',
      inputSchema: {},
      annotations: { readOnlyHint: true }
    },
    safe(async () => ({
      products: await api.get('/admin/products/low-stock'),
      variants: await api.get('/admin/inventory/low-stock-variants')
    }))
  )

  server.registerTool(
    'get_stock_history',
    {
      title: 'Stock history',
      description: 'Stock movements of a product (who changed it, why, by how much).',
      inputSchema: { productId: z.string() },
      annotations: { readOnlyHint: true }
    },
    safe(({ productId }) => api.get(`/admin/products/${productId}/stock-history`))
  )

  server.registerTool(
    'list_attributes',
    {
      title: 'List attributes',
      description:
        'Store-wide product attributes (e.g. Size, Color) with their options and ids. Variants are built from these option ids; to use one on a product, call apply_product_attribute first.',
      inputSchema: {},
      annotations: { readOnlyHint: true }
    },
    safe(() => api.get('/admin/attributes'))
  )

  server.registerTool(
    'list_product_upsells',
    {
      title: 'Product upsells',
      description: 'Products suggested after this product is bought.',
      inputSchema: { productId: z.string() },
      annotations: { readOnlyHint: true }
    },
    safe(({ productId }) => api.get(`/admin/products/${productId}/upsells`))
  )

  server.registerTool(
    'create_product',
    {
      title: 'Create product',
      description:
        'Create a new product. It is ALWAYS created hidden (visible=false): the owner reviews and publishes it from the admin panel. Prices are in cents (1 DA = 100). Typical flow: create_product -> add_product_images -> (apply_product_attribute -> create_product_variant) -> create_product_offer / add_product_upsell. Write description as HTML (rich text). Provide an ASCII hyphen-separated slug (e.g. "men-leather-wallet"); one is generated if omitted.',
      inputSchema: {
        name: z.string().min(1).max(200),
        slug: z
          .string()
          .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase letters/digits separated by hyphens')
          .max(200)
          .optional(),
        description: z.string().max(20000).optional().describe('HTML'),
        category: z.string().max(100).optional().describe('Category name tag'),
        categoryId: z.string().uuid().optional(),
        priceCents: z.number().int().nonnegative(),
        costCents: z.number().int().nonnegative().optional().describe('Unit cost, for profit reports'),
        stockQuantity: z.number().nonnegative(),
        lowStockThreshold: z.number().int().nonnegative().default(5),
        featured: z.boolean().default(false),
        bestSeller: z.boolean().default(false),
        requireOfferSelection: z.boolean().default(false).describe('Only sold in fixed lots: customer must pick one of the offers'),
        keyBenefits: z.array(z.string().min(1).max(120)).max(8).default([]),
        faqs: z.array(z.object({ question: z.string().min(1).max(300), answer: z.string().min(1).max(2000) })).max(20).default([]),
        specifications: z.array(z.object({ label: z.string().min(1).max(100), value: z.string().min(1).max(300) })).max(30).default([])
      }
    },
    safe(({ slug, ...rest }) =>
      api.post('/admin/products', { ...rest, slug: slug ?? generatedSlug(rest.name), visible: false })
    )
  )

  server.registerTool(
    'add_product_images',
    {
      title: 'Add product images from URLs',
      description:
        'Download images from public http(s) URLs onto the store\'s server and attach them to the product, in the given order. The FIRST image of a product becomes its main image. Returns a result per image; failures do not stop the others.',
      inputSchema: {
        productId: z.string(),
        images: z
          .array(z.object({ url: z.string().url(), altText: z.string().max(200).optional() }))
          .min(1)
          .max(10)
      }
    },
    safe(async ({ productId, images }) => {
      const detail = await api.get<{ images?: unknown[] }>(`/admin/products/${productId}`)
      let order = detail.images?.length ?? 0
      const results: unknown[] = []
      for (const img of images) {
        try {
          assertPublicUrl(img.url)
          const stored = await api.post<{ url: string }>('/admin/upload-from-url', { url: img.url })
          const added = await api.post('/admin/products/' + productId + '/images', {
            url: stored.url,
            altText: img.altText,
            sortOrder: order
          })
          order++
          results.push({ source: img.url, ok: true, image: added })
        } catch (e) {
          results.push({ source: img.url, ok: false, error: e instanceof Error ? e.message : String(e) })
        }
      }
      return results
    })
  )

  server.registerTool(
    'reorder_product_images',
    {
      title: 'Reorder product images',
      description: 'Set the gallery order by image ids (from get_product). The first one becomes the main image.',
      inputSchema: { productId: z.string(), orderedIds: z.array(z.string()).min(1) }
    },
    safe(({ productId, orderedIds }) => api.post(`/admin/products/${productId}/reorder-images`, { orderedIds }))
  )

  server.registerTool(
    'delete_product_image',
    {
      title: 'Remove product image',
      description: 'Detach an image from the product gallery.',
      inputSchema: { productId: z.string(), imageId: z.string() }
    },
    safe(({ productId, imageId }) => api.request('DELETE', `/admin/products/${productId}/images/${imageId}`))
  )

  server.registerTool(
    'apply_product_attribute',
    {
      title: 'Use attribute on product',
      description: 'Declare that a product varies on an attribute (e.g. Size). Required before creating variants that use its options.',
      inputSchema: { productId: z.string(), attributeId: z.string() },
      annotations: { idempotentHint: true }
    },
    safe(({ productId, attributeId }) => api.post(`/admin/products/${productId}/attributes/${attributeId}`))
  )

  server.registerTool(
    'create_product_variant',
    {
      title: 'Create variant',
      description:
        'Add a variant (e.g. Red / XL) with its own SKU, price (cents) and stock. optionIds are attribute option ids from list_attributes, one per attribute; each attribute must first be applied to the product.',
      inputSchema: {
        productId: z.string(),
        sku: z.string().min(1),
        priceCents: z.number().int().nonnegative(),
        stockQuantity: z.number().nonnegative(),
        optionIds: z.array(z.string()).min(1)
      }
    },
    safe(({ productId, ...body }) => api.post(`/admin/products/${productId}/variants`, body))
  )

  server.registerTool(
    'update_product_variant',
    {
      title: 'Update variant',
      description: 'Change a variant (sku, priceCents, ...). Only send the fields to change. For stock use adjust_stock with variantId.',
      inputSchema: { productId: z.string(), variantId: z.string(), fields: z.record(z.string(), z.unknown()) }
    },
    safe(({ productId, variantId, fields }) => api.patch(`/admin/products/${productId}/variants/${variantId}`, fields))
  )

  server.registerTool(
    'create_product_offer',
    {
      title: 'Create quantity offer',
      description:
        'Add a pickable quantity offer on the product page. FixedBundlePrice: requiredQuantity units for bundlePriceCents total. BuyXGetYFree: buy requiredQuantity, get freeQuantity free. FreeShipping: free shipping at requiredQuantity. Quantities are multiples of 0.5.',
      inputSchema: {
        productId: z.string(),
        type: z.enum(['FixedBundlePrice', 'BuyXGetYFree', 'FreeShipping']),
        requiredQuantity: z.number().min(0.5),
        freeQuantity: z.number().nonnegative().default(0),
        bundlePriceCents: z.number().int().nonnegative().optional().describe('FixedBundlePrice only')
      }
    },
    safe(({ productId, ...body }) => api.post(`/admin/products/${productId}/offers`, body))
  )

  server.registerTool(
    'delete_product_offer',
    {
      title: 'Delete offer',
      description: 'Remove a quantity offer from a product.',
      inputSchema: { productId: z.string(), offerId: z.string() }
    },
    safe(({ productId, offerId }) => api.request('DELETE', `/admin/products/${productId}/offers/${offerId}`))
  )

  server.registerTool(
    'add_product_upsell',
    {
      title: 'Add upsell',
      description: 'Suggest another product after this one is bought, optionally at a special price (cents).',
      inputSchema: {
        productId: z.string(),
        upsellProductId: z.string(),
        priceCentsOverride: z.number().int().nonnegative().optional()
      }
    },
    safe(({ productId, ...body }) => api.post(`/admin/products/${productId}/upsells`, body))
  )

  server.registerTool(
    'delete_product_upsell',
    {
      title: 'Remove upsell',
      description: 'Remove an upsell suggestion from a product.',
      inputSchema: { productId: z.string(), upsellId: z.string() }
    },
    safe(({ productId, upsellId }) => api.request('DELETE', `/admin/products/${productId}/upsells/${upsellId}`))
  )

  server.registerTool(
    'adjust_stock',
    {
      title: 'Adjust stock',
      description:
        'Add or remove stock with a signed delta (positive = in, negative = out) and a reason. Pass variantId to adjust one variant instead of the product. Every adjustment is logged.',
      inputSchema: {
        productId: z.string(),
        delta: z.number().refine((n) => n !== 0, 'delta must be non-zero'),
        reason: StockAdjustmentReasonSchema,
        note: z.string().max(500).optional(),
        variantId: z.string().optional()
      }
    },
    safe(({ productId, ...body }) => api.post(`/admin/products/${productId}/stock`, body))
  )

  server.registerTool(
    'update_product',
    {
      title: 'Update product',
      description:
        'Change fields of a product. Only send the fields to change. Prices are in cents. Call get_product first to see the current field names and values.',
      inputSchema: {
        productId: z.string(),
        fields: z
          .record(z.string(), z.unknown())
          .describe('Partial product fields, e.g. { "name": "...", "priceCents": 450000, "visible": false }')
      }
    },
    safe(({ productId, fields }) => api.patch(`/admin/products/${productId}`, fields))
  )

  server.registerTool(
    'archive_product',
    {
      title: 'Archive product',
      description: 'Archive (soft-remove) a product from the catalog. Does not delete data.',
      inputSchema: { productId: z.string() }
    },
    safe(({ productId }) => api.post(`/admin/products/${productId}/archive`))
  )
}
