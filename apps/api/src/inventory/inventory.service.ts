import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  private async assertStockOwned(branchId: string, stockItemId: string) {
    const s = await this.prisma.stockItem.findFirst({ where: { id: stockItemId, branchId }, select: { id: true } });
    if (!s) throw new NotFoundException('Stock item not found');
  }

  async getStock(branchId: string) {
    const items = await this.prisma.stockItem.findMany({
      where: { branchId, isActive: true },
      include: { supplier: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });

    return items.map((item) => ({
      ...item,
      isLow: Number(item.currentQty) <= Number(item.reorderLevel),
    }));
  }

  async getLowStockItems(branchId: string) {
    const items = await this.prisma.stockItem.findMany({
      where: { branchId, isActive: true },
    });
    return items.filter((i) => Number(i.currentQty) <= Number(i.reorderLevel));
  }

  async addStock(branchId: string, data: any) {
    const item = await this.prisma.stockItem.create({
      data: { branchId, ...data },
    });
    return item;
  }

  async updateStock(branchId: string, id: string, data: any) {
    await this.assertStockOwned(branchId, id);
    return this.prisma.stockItem.update({ where: { id }, data });
  }

  // public, tenant-scoped entry point for the controller
  async addStockTransaction(branchId: string, stockItemId: string, body: any) {
    await this.assertStockOwned(branchId, stockItemId);
    return this.recordTransaction({ stockItemId, ...body });
  }

  async recordTransaction(data: {
    stockItemId: string;
    type: 'PURCHASE' | 'CONSUMPTION' | 'WASTE' | 'ADJUSTMENT';
    quantity: number;
    costPerUnit?: number;
    notes?: string;
    orderId?: string;
  }) {
    const { quantity, type } = data;
    const delta = type === 'PURCHASE' ? quantity : -Math.abs(quantity);

    await this.prisma.stockItem.update({
      where: { id: data.stockItemId },
      data: { currentQty: { increment: delta } },
    });

    return this.prisma.stockTransaction.create({ data });
  }

  async createPurchaseOrder(branchId: string, data: any) {
    return this.prisma.purchaseOrder.create({
      data: {
        supplierId: data.supplierId,
        branchId,
        totalAmount: data.items.reduce((sum: number, i: any) => sum + i.totalCost, 0),
        notes: data.notes,
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : undefined,
        items: {
          createMany: { data: data.items },
        },
      },
      include: { items: true, supplier: true },
    });
  }

  async receivePurchaseOrder(branchId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, branchId },
      include: { items: true },
    });
    if (!po) throw new NotFoundException('Purchase order not found');

    // Update stock for each item
    for (const item of po.items) {
      const stock = await this.prisma.stockItem.findFirst({
        where: { name: item.stockItemName, branchId: po.branchId },
      });
      if (stock) {
        await this.recordTransaction({
          stockItemId: stock.id,
          type: 'PURCHASE',
          quantity: Number(item.quantity),
          costPerUnit: Number(item.costPerUnit),
        });
      }
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'RECEIVED', receivedAt: new Date() },
    });
  }

  async getSuppliers(restaurantId: string) {
    return this.prisma.supplier.findMany({ where: { restaurantId, isActive: true } });
  }

  async addSupplier(restaurantId: string, data: any) {
    return this.prisma.supplier.create({ data: { restaurantId, ...data } });
  }
}
