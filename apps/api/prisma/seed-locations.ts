import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'

// Standalone Wilaya/Commune seeder — split out of prisma/seed.ts so it can
// run safely in production. Unlike the full seed.ts (which also creates
// dev-password-123 admin accounts and test products — never run there, see
// DEPLOYMENT.md), this only writes static Algeria reference data with no
// secrets and no fake customer-facing content. Required for the shipping
// system's wilaya/commune pickers to have anything to show.
const dataDir = fileURLToPath(new URL('./data', import.meta.url))
function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(`${dataDir}/${file}`, 'utf-8')) as T
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Vendored from github.com/Kenandarabeh/algeria-wilayas-communes-2026 (see
  // prisma/data/ and Wilaya/Commune's Prisma comments). Static reference
  // data with a stable natural key (the source dataset's own id) —
  // createMany + skipDuplicates is idempotent, safe to rerun. Wilayas must
  // land first (communes FK into them).
  const wilayasData = readJson<{ id: string; name: string }[]>('wilayas.json')
  const communesData = readJson<{ id: string; name: string; postCode: string; wilayaId: string }[]>('communes.json')
  const wilayas = await prisma.wilaya.createMany({ data: wilayasData, skipDuplicates: true })
  const communes = await prisma.commune.createMany({ data: communesData, skipDuplicates: true })
  console.log(`Seeded ${wilayas.count} wilayas and ${communes.count} communes (${wilayasData.length}/${communesData.length} in source data — the rest already existed).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
