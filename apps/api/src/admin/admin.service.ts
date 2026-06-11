import { Injectable, UnauthorizedException, NotFoundException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const PLATFORM_SECRET = () => process.env.PLATFORM_JWT_SECRET || process.env.JWT_SECRET || 'platform-dev-secret';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // ── Auth ──────────────────────────────────────────────────────────────────
  async login(email: string, password: string) {
    const admin = await this.prisma.platformAdmin.findUnique({ where: { email } });
    if (!admin || !admin.isActive) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const token = this.jwt.sign(
      { sub: admin.id, email: admin.email, platform: true, role: admin.role },
      { secret: PLATFORM_SECRET(), expiresIn: '12h' },
    );
    return { accessToken: token, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } };
  }

  // ── Metrics (cross-tenant) ──────────────────────────────────────────────────
  async metrics() {
    const [tenants, plans] = await Promise.all([
      this.prisma.restaurant.findMany({ select: { status: true, shopType: true, planId: true } }),
      this.prisma.plan.findMany(),
    ]);
    const priceOf = (planId?: string | null) => plans.find((p) => p.id === planId)?.price || 0;
    const active = tenants.filter((t) => t.status === 'Active');
    const mrr = active.reduce((s, t) => s + priceOf(t.planId), 0);
    const byVertical: Record<string, number> = {};
    tenants.forEach((t) => (byVertical[t.shopType] = (byVertical[t.shopType] || 0) + 1));
    return {
      totalShops: tenants.length,
      active: active.length,
      trial: tenants.filter((t) => t.status === 'Trial').length,
      suspended: tenants.filter((t) => t.status === 'Suspended').length,
      mrr,
      arr: mrr * 12,
      byVertical,
    };
  }

  // ── Tenants ─────────────────────────────────────────────────────────────────
  async listTenants(query: { status?: string; shopType?: string; search?: string }) {
    const where: any = {};
    if (query.status && query.status !== 'All') where.status = query.status;
    if (query.shopType && query.shopType !== 'All') where.shopType = query.shopType;
    if (query.search)
      where.OR = [
        { name: { contains: query.search } },
        { ownerEmail: { contains: query.search } },
        { city: { contains: query.search } },
      ];

    const tenants = await this.prisma.restaurant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { plan: true, _count: { select: { branches: true, users: true } } },
    });
    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      shopType: t.shopType,
      status: t.status,
      subdomain: t.subdomain,
      ownerName: t.ownerName,
      ownerEmail: t.ownerEmail,
      city: t.city,
      plan: t.plan ? { id: t.plan.id, name: t.plan.name, price: t.plan.price } : null,
      branches: t._count.branches,
      users: t._count.users,
      trialEndsAt: t.trialEndsAt,
      createdAt: t.createdAt,
    }));
  }

  async getTenant(id: string) {
    const t = await this.prisma.restaurant.findUnique({
      where: { id },
      include: { plan: true, invoices: { orderBy: { createdAt: 'desc' }, take: 10 }, _count: { select: { branches: true, users: true } } },
    });
    if (!t) throw new NotFoundException('Shop not found');
    return t;
  }

  async createTenant(dto: {
    name: string;
    shopType?: string;
    ownerName?: string;
    ownerEmail: string;
    phone?: string;
    city?: string;
    planId?: string;
    status?: string;
    trialDays?: number;
    password?: string;
  }) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.ownerEmail } });
    if (existing) throw new ConflictException('Owner email already in use');

    const trialDays = dto.trialDays ?? 14;
    const status = dto.status || 'Trial';
    const subdomain = dto.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'shop' + Date.now();

    const restaurant = await this.prisma.restaurant.create({
      data: {
        name: dto.name,
        shopType: dto.shopType || 'restaurant',
        ownerName: dto.ownerName,
        ownerEmail: dto.ownerEmail,
        phone: dto.phone,
        city: dto.city,
        planId: dto.planId,
        status,
        subdomain,
        trialEndsAt: new Date(Date.now() + trialDays * 86400000),
      },
    });

    const branch = await this.prisma.branch.create({
      data: { restaurantId: restaurant.id, name: 'Main Branch' },
    });

    const tempPw = dto.password || Math.random().toString(36).slice(2, 10);
    await this.prisma.user.create({
      data: {
        restaurantId: restaurant.id,
        branchId: branch.id,
        name: dto.ownerName || dto.name,
        email: dto.ownerEmail,
        passwordHash: await bcrypt.hash(tempPw, 12),
        role: 'OWNER',
      },
    });

    // Seed starter data per vertical (restaurants get categories + tables)
    if ((dto.shopType || 'restaurant') === 'restaurant') {
      await this.prisma.menuCategory.createMany({
        data: [
          { restaurantId: restaurant.id, name: 'Starters', sortOrder: 1 },
          { restaurantId: restaurant.id, name: 'Main Course', sortOrder: 2 },
          { restaurantId: restaurant.id, name: 'Beverages', sortOrder: 3 },
          { restaurantId: restaurant.id, name: 'Desserts', sortOrder: 4 },
        ],
      });
      const tables = [];
      for (let i = 1; i <= 8; i++) tables.push({ branchId: branch.id, name: `T-${String(i).padStart(2, '0')}`, capacity: 4 });
      await this.prisma.table.createMany({ data: tables });
    }

    return { id: restaurant.id, subdomain, ownerEmail: dto.ownerEmail, tempPassword: tempPw, status };
  }

  async setStatus(id: string, status: 'Active' | 'Suspended' | 'Cancelled' | 'Trial') {
    await this.ensureTenant(id);
    return this.prisma.restaurant.update({ where: { id }, data: { status } });
  }

  async changePlan(id: string, planId: string) {
    await this.ensureTenant(id);
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    return this.prisma.restaurant.update({
      where: { id },
      data: { planId, status: 'Active' },
    });
  }

  async deleteTenant(id: string) {
    await this.ensureTenant(id);
    // soft-cancel keeps data; hard delete would cascade — we soft-cancel for safety
    return this.prisma.restaurant.update({ where: { id }, data: { status: 'Cancelled' } });
  }

  private async ensureTenant(id: string) {
    const t = await this.prisma.restaurant.findUnique({ where: { id }, select: { id: true } });
    if (!t) throw new NotFoundException('Shop not found');
  }

  // ── Plans ─────────────────────────────────────────────────────────────────
  async listPlans() {
    const plans = await this.prisma.plan.findMany({ orderBy: { price: 'asc' } });
    const tenants = await this.prisma.restaurant.findMany({ where: { status: 'Active' }, select: { planId: true } });
    return plans.map((p) => ({
      ...p,
      modules: safeJson(p.modules),
      activeSubscribers: tenants.filter((t) => t.planId === p.id).length,
    }));
  }

  async upsertPlan(dto: any) {
    const data = {
      name: dto.name,
      price: Number(dto.price) || 0,
      maxBranches: Number(dto.maxBranches ?? 1),
      maxUsers: Number(dto.maxUsers ?? 3),
      maxItems: Number(dto.maxItems ?? 200),
      featured: !!dto.featured,
      modules: JSON.stringify(dto.modules || []),
    };
    if (dto.id) return this.prisma.plan.update({ where: { id: dto.id }, data });
    return this.prisma.plan.create({ data });
  }

  // ── Invoices ────────────────────────────────────────────────────────────────
  async listInvoices() {
    const invoices = await this.prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { restaurant: { select: { name: true } } },
    });
    return invoices.map((i) => ({ ...i, shopName: i.restaurant?.name }));
  }
}

function safeJson(s: string): any[] {
  try {
    const v = JSON.parse(s || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
