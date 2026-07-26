import { Injectable } from '@nestjs/common'
import type { Prisma } from '../generated/prisma/client'

// SF-12: Postgres ILIKE now, swappable for Meilisearch (RSK-03/RSK-04)
// later — that swap should only touch this file. A Meilisearch-backed
// implementation would run its own query and return a filter scoped to the
// matching IDs (`{ id: { in: [...] } }`) instead of building ILIKE
// conditions directly, keeping the same method signature so
// ProductsController never has to change.
@Injectable()
export class CatalogSearchService {
  async buildSearchFilter(query?: string): Promise<Prisma.ProductWhereInput> {
    if (!query) return {}
    return {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } }
      ]
    }
  }
}
