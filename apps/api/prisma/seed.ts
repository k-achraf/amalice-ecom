import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as bcrypt from 'bcrypt'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, AdminRoleName } from '../src/generated/prisma/client'

const dataDir = fileURLToPath(new URL('./data', import.meta.url))
function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(`${dataDir}/${file}`, 'utf-8')) as T
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// Dev-only fixture password, same for every seeded admin — never used
// outside a local dev database. Real admin provisioning (SEC-01-adjacent
// work) will need its own invite/reset flow, not a shared known password.
const DEV_PASSWORD = 'dev-password-123'

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10)

  const roles = await Promise.all(
    Object.values(AdminRoleName).map((name) => prisma.role.upsert({ where: { name }, update: {}, create: { name } }))
  )

  for (const role of roles) {
    const email = `${role.name.toLowerCase()}@amalice.dev`
    await prisma.adminUser.upsert({
      where: { email },
      // Dev fixture data — always reset to the known dev password on
      // reseed. (An earlier version of this script used `update: {}` here,
      // which meant re-running the seed silently never updated an
      // already-existing admin's password hash — caught when login kept
      // failing against a hash that predated bcrypt being wired up.)
      update: { passwordHash },
      create: { email, passwordHash, roleId: role.id }
    })
  }

  // SF-17 — categories as a real source for collection landing pages.
  // Slugs match the flat `category` tags on the seeded products below so the
  // back-compat path and the normalized FK agree.
  const categories = await Promise.all(
    [
      { name: 'Bags', slug: 'bags', description: 'Totes, wallets, and everyday carry.', sortOrder: 1, featured: true },
      { name: 'Home', slug: 'home', description: 'Goods for the kitchen and desk.', sortOrder: 2, featured: true },
      { name: 'Electronics', slug: 'electronics', description: 'Audio, power, and accessories.', sortOrder: 3, featured: false }
    ].map((c) =>
      prisma.category.upsert({
        where: { slug: c.slug },
        update: c,
        create: c
      })
    )
  )
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]))

  const products = await Promise.all(
    [
      {
        name: 'Everyday Tote Bag',
        slug: 'everyday-tote-bag',
        category: 'bags',
        description: 'A durable canvas tote for daily errands.',
        imageUrl: 'https://picsum.photos/seed/everyday-tote-bag/600/600',
        priceCents: 2500,
        stockQuantity: 40,
        featured: true,
        bestSeller: true
      },
      {
        name: 'Ceramic Mug',
        slug: 'ceramic-mug',
        category: 'home',
        description: 'Hand-glazed stoneware mug, holds 12oz.',
        imageUrl: 'https://picsum.photos/seed/ceramic-mug/600/600',
        priceCents: 1200,
        stockQuantity: 120,
        featured: false,
        bestSeller: true
      },
      {
        name: 'Wireless Earbuds',
        slug: 'wireless-earbuds',
        category: 'electronics',
        description: 'Bluetooth earbuds with 20-hour battery life.',
        imageUrl: 'https://picsum.photos/seed/wireless-earbuds/600/600',
        priceCents: 8900,
        stockQuantity: 15,
        featured: true,
        bestSeller: false
      },
      {
        name: 'Leather Wallet',
        slug: 'leather-wallet',
        category: 'bags',
        description: 'Slim bifold wallet, genuine leather.',
        imageUrl: 'https://picsum.photos/seed/leather-wallet/600/600',
        priceCents: 3400,
        stockQuantity: 60,
        featured: false,
        bestSeller: false
      },
      {
        name: 'Desk Lamp',
        slug: 'desk-lamp',
        category: 'home',
        description: 'Adjustable LED desk lamp with USB charging port.',
        imageUrl: 'https://picsum.photos/seed/desk-lamp/600/600',
        priceCents: 4200,
        stockQuantity: 3,
        featured: true,
        bestSeller: false
      }
    ].map((p) =>
      prisma.product.upsert({
        where: { slug: p.slug },
        update: { ...p, categoryId: categoryBySlug.get(p.category!)!.id },
        create: { ...p, categoryId: categoryBySlug.get(p.category!)!.id }
      })
    )
  )

  // SF-15 — gallery images for a couple of products (the rest keep using the
  // denormalized imageUrl fallback). Idempotent: only creates if the product
  // has no gallery rows yet.
  for (const slug of ['everyday-tote-bag', 'ceramic-mug', 'wireless-earbuds']) {
    const product = products.find((p) => p.slug === slug)!
    const existing = await prisma.productImage.findFirst({ where: { productId: product.id } })
    if (existing) continue
    await prisma.productImage.createMany({
      data: [
        { productId: product.id, url: product.imageUrl!, altText: product.name, sortOrder: 0 },
        { productId: product.id, url: `https://picsum.photos/seed/${slug}-2/600/600`, altText: `${product.name} alt view`, sortOrder: 1 },
        { productId: product.id, url: `https://picsum.photos/seed/${slug}-3/600/600`, altText: `${product.name} detail`, sortOrder: 2 }
      ]
    })
  }

  // Normalized attributes — store-wide definitions, reusable across products.
  const colorAttr = await prisma.attribute.upsert({
    where: { name: 'Color' },
    update: {},
    create: { name: 'Color', type: 'Color', sortOrder: 1 }
  })
  const sizeAttr = await prisma.attribute.upsert({
    where: { name: 'Size' },
    update: {},
    create: { name: 'Size', type: 'Text', sortOrder: 2 }
  })

  // Color options with swatches
  const colorOptions: Record<string, string> = {}
  for (const [value, hex] of [['Black', '#1a1a1a'], ['White', '#ffffff'], ['Red', '#dc2626'], ['Blue', '#0074c7']] as const) {
    const opt = await prisma.attributeOption.upsert({
      where: { attributeId_value: { attributeId: colorAttr.id, value } },
      update: {},
      create: { attributeId: colorAttr.id, value, colorHex: hex, sortOrder: Object.keys(colorOptions).length }
    })
    colorOptions[value] = opt.id
  }
  // Size options
  const sizeOptions: Record<string, string> = {}
  for (const value of ['S', 'M', 'L']) {
    const opt = await prisma.attributeOption.upsert({
      where: { attributeId_value: { attributeId: sizeAttr.id, value } },
      update: {},
      create: { attributeId: sizeAttr.id, value, sortOrder: Object.keys(sizeOptions).length }
    })
    sizeOptions[value] = opt.id
  }

  // SF-15 — variants for the earbuds, now using the normalized attribute system.
  // The product "uses" the Color attribute; each variant picks a Color option
  // via the VariantOption join table. Single-SKU products (the rest) have no
  // variants and behave exactly as before.
  const earbuds = products.find((p) => p.slug === 'wireless-earbuds')!
  // Apply the Color attribute to the earbuds product
  await prisma.productAttribute.upsert({
    where: { productId_attributeId: { productId: earbuds.id, attributeId: colorAttr.id } },
    update: {},
    create: { productId: earbuds.id, attributeId: colorAttr.id }
  })
  for (const [color, suffix] of [['Black', 'blk'], ['White', 'wht']] as const) {
    const variant = await prisma.productVariant.upsert({
      where: { sku: `EARBUDS-${suffix}` },
      update: {},
      create: {
        productId: earbuds.id,
        sku: `EARBUDS-${suffix}`,
        attributes: { color }, // legacy JSON kept for back-compat
        priceCents: earbuds.priceCents,
        stockQuantity: Math.ceil(earbuds.stockQuantity / 2)
      }
    })
    // Link the variant to its Color option (normalized source of truth)
    await prisma.variantOption.upsert({
      where: { variantId_optionId: { variantId: variant.id, optionId: colorOptions[color] } },
      update: {},
      create: { variantId: variant.id, optionId: colorOptions[color] }
    })
  }

  // COU — a courier for fulfillment/reconciliation fixtures.
  const courier = await prisma.courier.upsert({
    where: { slug: 'fastship' },
    update: {},
    create: { name: 'FastShip Express', slug: 'fastship' }
  })

  const customer = await prisma.customer.upsert({
    where: { phone: '+15555550100' },
    update: {},
    create: { phone: '+15555550100', name: 'Test Customer' }
  })

  const address = await prisma.address.findFirst({ where: { customerId: customer.id } })
  const resolvedAddress =
    address ??
    (await prisma.address.create({
      data: {
        customerId: customer.id,
        line1: '123 Market St',
        city: 'Springfield',
        region: 'IL',
        postalCode: '62701',
        country: 'US'
      }
    }))

  // PendingOTP fixture (existing) — the original SF-08 proof order.
  const existingOrder = await prisma.order.findFirst({ where: { customerId: customer.id } })
  if (!existingOrder) {
    const item = products[0]
    await prisma.order.create({
      data: {
        customerId: customer.id,
        addressId: resolvedAddress.id,
        totalCents: item.priceCents * 2,
        items: { create: [{ productId: item.id, quantity: 2, unitPriceCents: item.priceCents }] }
      }
    })
  }

  // Delivered fixture — needed so reviews (SF-16, delivery-history gated),
  // reconciliation (FIN), and the admin dashboards have realistic data to
  // render. One per product so every product is reviewable by this customer.
  const tote = products.find((p) => p.slug === 'everyday-tote-bag')!
  const deliveredOrder = await prisma.order.findFirst({ where: { customerId: customer.id, state: 'Delivered' } })
  if (!deliveredOrder) {
    const created = await prisma.order.create({
      data: {
        customerId: customer.id,
        addressId: resolvedAddress.id,
        state: 'Delivered',
        totalCents: tote.priceCents,
        items: { create: [{ productId: tote.id, quantity: 1, unitPriceCents: tote.priceCents }] },
        shipment: {
          create: {
            courierId: courier.id,
            trackingReference: 'FS-DEMO-1001',
            courierStatus: 'delivered'
          }
        },
        cashReconciliation: {
          create: { expectedCents: tote.priceCents, collectedCents: tote.priceCents, matched: true, reconciledAt: new Date() }
        }
      },
      include: { items: true }
    })
    // SF-16 — one approved review from the delivered-order customer.
    const existingReview = await prisma.review.findUnique({
      where: { productId_customerId: { productId: tote.id, customerId: customer.id } }
    })
    if (!existingReview) {
      await prisma.review.create({
        data: {
          productId: tote.id,
          customerId: customer.id,
          rating: 5,
          title: 'Holds up beautifully',
          body: 'Carried groceries, a laptop, and a water bottle without stretching. Worth it.',
          approved: true
        }
      })
    }
    void created
  }

  // Algeria wilayas/communes — vendored from github.com/Kenandarabeh/
  // algeria-wilayas-communes-2026 (see prisma/data/, and the model comments
  // in schema.prisma for why this is vendored rather than fetched live).
  // Static reference data with a stable natural key (the source dataset's
  // own id) — createMany + skipDuplicates is idempotent and, at ~1.7k
  // commune rows, far faster than an upsert-per-row loop. Wilayas must land
  // first (communes FK into them).
  const wilayasData = readJson<{ id: string; name: string }[]>('wilayas.json')
  const communesData = readJson<{ id: string; name: string; postCode: string; wilayaId: string }[]>('communes.json')
  await prisma.wilaya.createMany({ data: wilayasData, skipDuplicates: true })
  await prisma.commune.createMany({ data: communesData, skipDuplicates: true })

  // Store settings singleton — the default storefront template + copy.
  await prisma.storeSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      activeTemplate: 'minimal',
      storeName: 'Amalice',
      announcementText: 'Cash on delivery · No account required · Pay when it arrives'
    }
  })

  console.log(
    `Seeded: ${roles.length} roles, ${categories.length} categories, ${products.length} products, 1 courier, 1 customer, orders, 1 review, store settings, ${wilayasData.length} wilayas, ${communesData.length} communes.`
  )
  console.log(`Admin dev password (all seeded admins): ${DEV_PASSWORD}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
