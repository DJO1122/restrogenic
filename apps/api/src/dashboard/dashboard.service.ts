import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';


@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getTodaySummary(branchId: string) {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const yesterdayEnd = new Date(todayStart.getTime() - 1);

    const [todayOrders, yesterdayOrders, hourlyData, topItems, paymentBreakdown] = await Promise.all([
      this.prisma.order.findMany({
        where: { branchId, createdAt: { gte: todayStart, lte: todayEnd }, status: 'COMPLETED' },
        include: { payments: true },
      }),
      this.prisma.order.findMany({
        where: { branchId, createdAt: { gte: yesterdayStart, lte: yesterdayEnd }, status: 'COMPLETED' },
      }),
      this.getHourlySales(branchId, todayStart, todayEnd),
      this.getTopItems(branchId, todayStart, todayEnd, 10),
      this.getPaymentBreakdown(branchId, todayStart, todayEnd),
    ]);

    const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const yesterdayRevenue = yesterdayOrders.reduce((sum, o) => sum + Number(o.total), 0);

    const revenueChange = yesterdayRevenue > 0
      ? (((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1)
      : '0';

    return {
      today: {
        revenue: todayRevenue.toFixed(2),
        orders: todayOrders.length,
        averageOrderValue: todayOrders.length ? (todayRevenue / todayOrders.length).toFixed(2) : '0',
        covers: 0, // implement with table occupancy tracking
      },
      comparison: {
        revenueChange: Number(revenueChange),
        ordersChange: yesterdayOrders.length > 0
          ? (((todayOrders.length - yesterdayOrders.length) / yesterdayOrders.length) * 100).toFixed(1)
          : '0',
      },
      hourlyData,
      topItems,
      paymentBreakdown,
    };
  }

  private async getHourlySales(branchId: string, from: Date, to: Date) {
    const orders = await this.prisma.order.findMany({
      where: { branchId, createdAt: { gte: from, lte: to }, status: 'COMPLETED' },
      select: { createdAt: true, total: true },
    });

    const hourly: Record<number, { hour: number; revenue: number; orders: number }> = {};
    for (let h = 0; h < 24; h++) {
      hourly[h] = { hour: h, revenue: 0, orders: 0 };
    }

    for (const order of orders) {
      const hour = order.createdAt.getHours();
      hourly[hour].revenue += Number(order.total);
      hourly[hour].orders += 1;
    }

    return Object.values(hourly).filter((h) => h.hour >= 6 && h.hour <= 23);
  }

  private async getTopItems(branchId: string, from: Date, to: Date, limit: number) {
    const items = await this.prisma.orderItem.groupBy({
      by: ['name'],
      where: { order: { branchId, createdAt: { gte: from, lte: to }, status: 'COMPLETED' } },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: limit,
    });

    return items.map((i) => ({
      name: i.name,
      quantity: i._sum.quantity || 0,
      revenue: Number(i._sum.totalPrice || 0).toFixed(2),
    }));
  }

  private async getPaymentBreakdown(branchId: string, from: Date, to: Date) {
    const payments = await this.prisma.payment.groupBy({
      by: ['method'],
      where: { order: { branchId, createdAt: { gte: from, lte: to } }, amount: { gt: 0 } },
      _sum: { amount: true },
    });

    return payments.map((p) => ({
      method: p.method,
      amount: Number(p._sum.amount || 0).toFixed(2),
    }));
  }

  async getSalesReport(branchId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const orders = await this.prisma.order.findMany({
      where: { branchId, createdAt: { gte: fromDate, lte: toDate }, status: 'COMPLETED' },
      include: { items: true, payments: true },
    });

    const summary = orders.reduce(
      (acc, order) => ({
        totalRevenue: acc.totalRevenue + Number(order.total),
        totalOrders: acc.totalOrders + 1,
        totalDiscount: acc.totalDiscount + Number(order.discountAmount),
        totalTax: acc.totalTax + Number(order.cgst) + Number(order.sgst),
        totalItems: acc.totalItems + order.items.reduce((s, i) => s + i.quantity, 0),
      }),
      { totalRevenue: 0, totalOrders: 0, totalDiscount: 0, totalTax: 0, totalItems: 0 },
    );

    return { summary, orders };
  }

  async getLast30DaysTrend(branchId: string) {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      days.push(date);
    }

    const results = await Promise.all(
      days.map(async (day) => {
        const nextDay = new Date(day.getTime() + 86400000);
        const orders = await this.prisma.order.aggregate({
          where: { branchId, createdAt: { gte: day, lt: nextDay }, status: 'COMPLETED' },
          _sum: { total: true },
          _count: true,
        });
        return {
          date: day.toISOString().split('T')[0],
          revenue: Number(orders._sum.total || 0),
          orders: orders._count,
        };
      }),
    );

    return results;
  }
}
