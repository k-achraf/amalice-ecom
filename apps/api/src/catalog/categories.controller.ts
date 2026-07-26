import { Controller, Get, NotFoundException, Param } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Category } from '@amalice/shared'
import { PrismaService } from '../prisma/prisma.service'

@ApiTags('catalog')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  // SF-17 — the real category source behind collection landing pages and the
  // storefront header mega-menu. `featured` filters to the curated set shown
  // on the marketing home; unfiltered returns all (for the admin catalog).
  @Get()
  async list(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' } })
  }

  @Get('featured')
  async featured(): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { featured: true },
      orderBy: { sortOrder: 'asc' }
    })
  }

  @Get(':slug')
  async findOne(@Param('slug') slug: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { slug } })
    if (!category) throw new NotFoundException('Category not found')
    return category
  }
}
