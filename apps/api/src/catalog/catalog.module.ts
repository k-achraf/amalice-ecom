import { Module } from '@nestjs/common'
import { CatalogController } from './catalog.controller'
import { ProductsController } from './products.controller'
import { CategoriesController } from './categories.controller'
import { ReviewsController } from './reviews.controller'
import { CatalogSearchService } from './catalog-search.service'
import { ReviewsService } from './reviews.service'

@Module({
  controllers: [CatalogController, ProductsController, CategoriesController, ReviewsController],
  providers: [CatalogSearchService, ReviewsService],
  exports: [CatalogSearchService, ReviewsService]
})
export class CatalogModule {}
