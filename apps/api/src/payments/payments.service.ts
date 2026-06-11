import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';


interface PaymentEntry {
  method: string;
  amount: number;
  reference?: string;
  cashTendered?: number;
}

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async processPayment(branchId: string, orderId: string, payments: PaymentEntry[]) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, branchId },
      include: { payments: true },
    });
    if (!order) throw new BadRequestException('Order not found');

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const orderTotal = Number(order.total);
    const alreadyPaid = order.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const outstanding = orderTotal - alreadyPaid;

    if (totalPaid < outstanding - 0.01) {
      throw new BadRequestException(`Insufficient payment. Outstanding: ${outstanding.toFixed(2)}`);
    }

    await this.prisma.payment.createMany({
      data: payments.map((p) => ({
        orderId,
        method: p.method,
        amount: p.amount,
        reference: p.reference,
        cashTendered: p.cashTendered,
        changeGiven: p.cashTendered ? Math.max(0, p.cashTendered - p.amount) : undefined,
      })),
    });

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'COMPLETED', status: 'COMPLETED', completedAt: new Date() },
      include: {
        items: true,
        payments: true,
        table: { select: { name: true } },
        branch: { include: { restaurant: true } },
      },
    });

    if (order.tableId) {
      await this.prisma.table.update({
        where: { id: order.tableId },
        data: { status: 'AVAILABLE', occupiedAt: null },
      });
    }

    if (order.customerId) {
      const pointsEarned = Math.floor(orderTotal / 10);
      await this.prisma.customer.update({
        where: { id: order.customerId },
        data: {
          loyaltyPoints: { increment: pointsEarned },
          totalOrders: { increment: 1 },
          totalSpent: { increment: orderTotal },
          lastVisit: new Date(),
        },
      });
    }

    return updatedOrder;
  }

  async refund(branchId: string, orderId: string, reason: string, amount?: number) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, branchId }, include: { payments: true } });
    if (!order) throw new BadRequestException('Order not found');

    const refundAmount = amount || Number(order.total);
    await this.prisma.payment.create({
      data: {
        orderId,
        method: 'CASH',
        amount: -refundAmount,
        reference: `REFUND: ${reason}`,
      },
    });

    return this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'REFUNDED' },
    });
  }
}
