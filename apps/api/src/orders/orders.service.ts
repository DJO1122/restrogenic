import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';


const TAX_RATES: Record<string, number> = {
  GST_5: 0.05,
  GST_12: 0.12,
  GST_18: 0.18,
  GST_28: 0.28,
  EXEMPT: 0,
};

function round2(n: number) { return Math.round(n * 100) / 100; }

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  private async generateOrderNumber(branchId: string): Promise<string> {
    const today = new Date();
    const prefix = `RG-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const count = await this.prisma.order.count({
      where: { branchId, createdAt: { gte: new Date(today.setHours(0, 0, 0, 0)) } },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  async calculateTotals(items: CreateOrderDto['items'], discountAmount = 0, discountPercent = 0, applyServiceCharge = false, serviceChargeRate = 0) {
    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;

    for (const item of items) {
      const itemTotal = item.unitPrice * item.quantity - (item.discountAmount || 0);
      subtotal += itemTotal;

      const menuItem = await this.prisma.menuItem.findUnique({
        where: { id: item.menuItemId },
        select: { taxCategory: true },
      });
      const taxRate = TAX_RATES[menuItem?.taxCategory || 'GST_5'];
      cgst += itemTotal * (taxRate / 2);
      sgst += itemTotal * (taxRate / 2);
    }

    const finalDiscount = discountPercent > 0 ? subtotal * (discountPercent / 100) : discountAmount;
    const taxableAmount = subtotal - finalDiscount;
    const serviceCharge = applyServiceCharge ? taxableAmount * (serviceChargeRate / 100) : 0;
    const total = taxableAmount + cgst + sgst + serviceCharge;

    return {
      subtotal: round2(subtotal),
      discountAmount: round2(finalDiscount),
      cgst: round2(cgst),
      sgst: round2(sgst),
      serviceCharge: round2(serviceCharge),
      total: round2(total),
    };
  }

  async create(branchId: string, userId: string, dto: CreateOrderDto) {
    const restaurant = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: { restaurant: { select: { serviceCharge: true } } },
    });

    const totals = await this.calculateTotals(
      dto.items,
      dto.discountAmount,
      dto.discountPercent,
      dto.applyServiceCharge,
      restaurant?.restaurant.serviceCharge || 0,
    );

    const orderNumber = await this.generateOrderNumber(branchId);

    const order = await this.prisma.order.create({
      data: {
        branchId,
        userId,
        orderNumber,
        orderType: dto.orderType,
        tableId: dto.tableId,
        customerId: dto.customerId,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        notes: dto.notes,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        discountPercent: dto.discountPercent,
        cgst: totals.cgst,
        sgst: totals.sgst,
        serviceCharge: totals.serviceCharge,
        total: totals.total,
        items: {
          createMany: {
            data: dto.items.map((item) => ({
              menuItemId: item.menuItemId,
              variantId: item.variantId,
              name: item.name,
              variantName: item.variantName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: round2(item.unitPrice * item.quantity),
              notes: item.notes,
              discountAmount: item.discountAmount || 0,
            })),
          },
        },
      },
      include: {
        items: true,
        table: { select: { name: true } },
        customer: { select: { name: true, phone: true } },
        payments: true,
      },
    });

    if (dto.tableId) {
      await this.prisma.table.update({
        where: { id: dto.tableId },
        data: { status: 'OCCUPIED', occupiedAt: new Date() },
      });
    }

    return order;
  }

  async findAll(branchId: string, query: { status?: string; date?: string; type?: string }) {
    const where: any = { branchId };
    if (query.status) where.status = query.status;
    if (query.type) where.orderType = query.type;
    if (query.date) {
      const date = new Date(query.date);
      where.createdAt = {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lte: new Date(date.setHours(23, 59, 59, 999)),
      };
    }

    return this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        items: true,
        table: { select: { name: true } },
        customer: { select: { name: true, phone: true } },
        payments: true,
      },
    });
  }

  async findOne(branchId: string, id: string) {
    // tenant-scoped: findFirst with branchId so one shop can't read another's order by id
    const order = await this.prisma.order.findFirst({
      where: { id, branchId },
      include: {
        items: { include: { menuItem: { select: { name: true, taxCategory: true } } } },
        table: { select: { name: true } },
        customer: true,
        payments: true,
        user: { select: { name: true } },
        branch: { include: { restaurant: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(branchId: string, id: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findFirst({ where: { id, branchId } });
    if (!order) throw new NotFoundException('Order not found');

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === 'COMPLETED' && { completedAt: new Date() }),
      },
    });

    if ((dto.status === 'COMPLETED' || dto.status === 'CANCELLED') && order.tableId) {
      const activeOrders = await this.prisma.order.count({
        where: {
          tableId: order.tableId,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          id: { not: id },
        },
      });
      if (activeOrders === 0) {
        await this.prisma.table.update({
          where: { id: order.tableId },
          data: { status: 'AVAILABLE', occupiedAt: null },
        });
      }
    }

    return updated;
  }

  async holdOrder(branchId: string, id: string) {
    const order = await this.prisma.order.findFirst({ where: { id, branchId } });
    if (!order) throw new NotFoundException('Order not found');
    return this.prisma.order.update({ where: { id }, data: { isHeld: true, status: 'HELD' } });
  }

  async addItems(branchId: string, orderId: string, items: any[]) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    await this.prisma.orderItem.createMany({
      data: items.map((item) => ({
        orderId,
        menuItemId: item.menuItemId,
        variantId: item.variantId,
        name: item.name,
        variantName: item.variantName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: round2(item.unitPrice * item.quantity),
        notes: item.notes,
      })),
    });

    const allItems = await this.prisma.orderItem.findMany({ where: { orderId } });
    const subtotal = allItems.reduce((sum, i) => sum + Number(i.totalPrice), 0);
    const total = subtotal + Number(order.cgst) + Number(order.sgst) + Number(order.serviceCharge) - Number(order.discountAmount);

    return this.prisma.order.update({
      where: { id: orderId },
      data: { subtotal: round2(subtotal), total: round2(total) },
      include: { items: true, payments: true },
    });
  }

  async cancelItem(branchId: string, orderId: string, itemId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, branchId }, select: { id: true } });
    if (!order) throw new NotFoundException('Order not found');
    const item = await this.prisma.orderItem.findUnique({ where: { id: itemId } });
    if (!item || item.orderId !== orderId) throw new NotFoundException('Item not found');
    return this.prisma.orderItem.delete({ where: { id: itemId } });
  }

  async getActiveOrdersForKitchen(branchId: string) {
    return this.prisma.order.findMany({
      where: {
        branchId,
        status: { in: ['CONFIRMED', 'PREPARING', 'PENDING'] },
        isHeld: false,
      },
      orderBy: { createdAt: 'asc' },
      include: {
        items: {
          where: { isReady: false },
          include: { menuItem: { select: { name: true, preparationTime: true } } },
        },
        table: { select: { name: true } },
      },
    });
  }

  async markItemReady(branchId: string, orderId: string, itemId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, branchId }, select: { id: true } });
    if (!order) throw new NotFoundException('Order not found');
    await this.prisma.orderItem.update({ where: { id: itemId }, data: { isReady: true } });

    const pending = await this.prisma.orderItem.count({
      where: { orderId, isReady: false },
    });
    if (pending === 0) {
      await this.prisma.order.update({ where: { id: orderId }, data: { status: 'READY' } });
    }
    return { success: true };
  }
}
