import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu.dto';

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService) {}

  async getCategories(restaurantId: string) {
    return this.prisma.menuCategory.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: { isAvailable: true },
          orderBy: { sortOrder: 'asc' },
          include: { variants: true, addons: true },
        },
      },
    });
  }

  async getAllItems(restaurantId: string, categoryId?: string, search?: string) {
    return this.prisma.menuItem.findMany({
      where: {
        category: { restaurantId },
        ...(categoryId && { categoryId }),
        ...(search && { name: { contains: search } }),
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      include: { variants: true, addons: true, category: { select: { name: true } } },
    });
  }

  async createCategory(restaurantId: string, dto: CreateCategoryDto) {
    return this.prisma.menuCategory.create({
      data: { restaurantId, ...dto },
    });
  }

  async updateCategory(restaurantId: string, id: string, dto: Partial<CreateCategoryDto>) {
    await this.assertCategoryOwned(restaurantId, id);
    return this.prisma.menuCategory.update({ where: { id }, data: dto });
  }

  async deleteCategory(restaurantId: string, id: string) {
    await this.assertCategoryOwned(restaurantId, id);
    return this.prisma.menuCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async createItem(restaurantId: string, dto: CreateMenuItemDto) {
    const { variants, addons, ...itemData } = dto;
    // the category the item is being added to must belong to this tenant
    await this.assertCategoryOwned(restaurantId, dto.categoryId);
    return this.prisma.menuItem.create({
      data: {
        ...itemData,
        ...(variants?.length && {
          variants: { createMany: { data: variants } },
        }),
        ...(addons?.length && {
          addons: { createMany: { data: addons } },
        }),
      },
      include: { variants: true, addons: true },
    });
  }

  async updateItem(restaurantId: string, id: string, dto: UpdateMenuItemDto) {
    await this.assertItemOwned(restaurantId, id);
    return this.prisma.menuItem.update({
      where: { id },
      data: dto,
      include: { variants: true, addons: true },
    });
  }

  async toggleAvailability(restaurantId: string, id: string) {
    const item = await this.prisma.menuItem.findFirst({ where: { id, category: { restaurantId } } });
    if (!item) throw new NotFoundException('Item not found');
    return this.prisma.menuItem.update({
      where: { id },
      data: { isAvailable: !item.isAvailable },
    });
  }

  async deleteItem(restaurantId: string, id: string) {
    await this.assertItemOwned(restaurantId, id);
    return this.prisma.menuItem.delete({ where: { id } });
  }

  async reorderCategories(restaurantId: string, orderedIds: string[]) {
    // updateMany scoped to the tenant — ids from another shop simply won't match
    await Promise.all(
      orderedIds.map((id, index) =>
        this.prisma.menuCategory.updateMany({
          where: { id, restaurantId },
          data: { sortOrder: index },
        }),
      ),
    );
    return { success: true };
  }

  // ── tenant-ownership guards ──
  private async assertCategoryOwned(restaurantId: string, categoryId: string) {
    const cat = await this.prisma.menuCategory.findFirst({ where: { id: categoryId, restaurantId }, select: { id: true } });
    if (!cat) throw new NotFoundException('Category not found');
  }

  private async assertItemOwned(restaurantId: string, itemId: string) {
    const item = await this.prisma.menuItem.findFirst({ where: { id: itemId, category: { restaurantId } }, select: { id: true } });
    if (!item) throw new NotFoundException('Item not found');
  }
}
