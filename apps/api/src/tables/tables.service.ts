import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TablesService {
  constructor(private prisma: PrismaService) {}

  private async assertOwned(branchId: string, id: string) {
    const t = await this.prisma.table.findFirst({ where: { id, branchId }, select: { id: true } });
    if (!t) throw new NotFoundException('Table not found');
  }

  async findAll(branchId: string) {
    return this.prisma.table.findMany({
      where: { branchId },
      orderBy: { name: 'asc' },
      include: {
        orders: {
          where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
          include: { items: true, payments: true },
          take: 1,
        },
      },
    });
  }

  async create(branchId: string, data: any) {
    return this.prisma.table.create({ data: { branchId, ...data } });
  }

  async update(branchId: string, id: string, data: any) {
    await this.assertOwned(branchId, id);
    return this.prisma.table.update({ where: { id }, data });
  }

  async delete(branchId: string, id: string) {
    await this.assertOwned(branchId, id);
    return this.prisma.table.delete({ where: { id } });
  }

  async updateLayout(branchId: string, tables: Array<{ id: string; posX: number; posY: number }>) {
    // scoped updateMany — table ids from another branch won't match
    await Promise.all(
      tables.map((t) => this.prisma.table.updateMany({ where: { id: t.id, branchId }, data: { posX: t.posX, posY: t.posY } })),
    );
    return { success: true };
  }

  async mergeTables(tableIds: string[], primaryTableId: string) {
    // Mark all secondary tables as occupied and link to primary
    await Promise.all(
      tableIds
        .filter((id) => id !== primaryTableId)
        .map((id) => this.prisma.table.update({ where: { id }, data: { status: 'OCCUPIED' } })),
    );
    return { success: true };
  }
}
