import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async findByPhone(phone: string, restaurantId: string) {
    return this.prisma.customer.findFirst({
      where: { phone, restaurantId },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, orderNumber: true, total: true, createdAt: true },
        },
      },
    });
  }

  async findOrCreate(data: { phone: string; name?: string; restaurantId: string }) {
    return this.prisma.customer.upsert({
      where: { phone: data.phone },
      update: { ...(data.name && { name: data.name }) },
      create: { phone: data.phone, name: data.name || data.phone, restaurantId: data.restaurantId },
    });
  }

  async findAll(restaurantId: string, search?: string) {
    return this.prisma.customer.findMany({
      where: {
        restaurantId,
        ...(search && {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
          ],
        }),
      },
      orderBy: { lastVisit: 'desc' },
      take: 50,
    });
  }

  async redeemPoints(customerId: string, points: number) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.loyaltyPoints < points) {
      throw new Error('Insufficient loyalty points');
    }
    return this.prisma.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { decrement: points } },
    });
  }
}
