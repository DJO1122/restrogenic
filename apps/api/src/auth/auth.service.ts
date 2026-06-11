import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, PinLoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.generateTokens(user);
  }

  async pinLogin(dto: PinLoginDto) {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        pin: { not: null },
        ...(dto.restaurantId && { restaurantId: dto.restaurantId }),
      },
    });

    for (const user of users) {
      if (user.pin && await bcrypt.compare(dto.pin, user.pin)) {
        return this.generateTokens(user);
      }
    }
    throw new UnauthorizedException('Invalid PIN');
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, role: true,
        restaurantId: true, branchId: true,
        restaurant: { select: { name: true, currency: true, taxMode: true, gstin: true } },
      },
    });
  }

  async setupInitialRestaurant(data: {
    restaurantName: string;
    ownerName: string;
    email: string;
    password: string;
    phone?: string;
  }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already registered');

    const restaurant = await this.prisma.restaurant.create({
      data: { name: data.restaurantName, phone: data.phone },
    });

    const branch = await this.prisma.branch.create({
      data: { restaurantId: restaurant.id, name: 'Main Branch' },
    });

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await this.prisma.user.create({
      data: {
        restaurantId: restaurant.id,
        branchId: branch.id,
        name: data.ownerName,
        email: data.email,
        passwordHash,
        role: 'OWNER',
      },
    });

    // Seed default menu categories
    await this.prisma.menuCategory.createMany({
      data: [
        { restaurantId: restaurant.id, name: 'Starters', sortOrder: 1 },
        { restaurantId: restaurant.id, name: 'Main Course', sortOrder: 2 },
        { restaurantId: restaurant.id, name: 'Beverages', sortOrder: 3 },
        { restaurantId: restaurant.id, name: 'Desserts', sortOrder: 4 },
      ],
    });

    // Seed default tables
    const tableData = [];
    for (let i = 1; i <= 10; i++) {
      tableData.push({
        branchId: branch.id,
        name: `T-${String(i).padStart(2, '0')}`,
        capacity: i <= 2 ? 2 : i <= 6 ? 4 : 6,
        section: i <= 6 ? 'Indoor' : 'Outdoor',
        posX: ((i - 1) % 3) * 33 + 5,
        posY: Math.floor((i - 1) / 3) * 25 + 5,
      });
    }
    await this.prisma.table.createMany({ data: tableData });

    return { ...this.generateTokens(user), restaurantId: restaurant.id, branchId: branch.id };
  }

  // ── Public self-serve signup (creates a 14-day Trial tenant) ─────────────────
  async signup(data: {
    shopName: string;
    shopType?: string;
    ownerName: string;
    ownerEmail: string;
    password: string;
    phone?: string;
    city?: string;
    planId?: string;
  }) {
    if (!data.shopName || !data.ownerEmail || !data.password) {
      throw new ConflictException('Shop name, email and password are required');
    }
    const existing = await this.prisma.user.findUnique({ where: { email: data.ownerEmail } });
    if (existing) throw new ConflictException('Email already registered — please log in');

    // pick the plan (default to Free Trial / cheapest if none chosen)
    let planId = data.planId;
    if (!planId) {
      const free = await this.prisma.plan.findFirst({ where: { price: 0 } });
      planId = free?.id;
    }

    const shopType = data.shopType || 'restaurant';
    const baseSub = data.shopName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'shop';
    // ensure unique subdomain
    let subdomain = baseSub;
    if (await this.prisma.restaurant.findUnique({ where: { subdomain } })) {
      subdomain = `${baseSub}${Math.floor(Math.random() * 9000 + 1000)}`;
    }

    const restaurant = await this.prisma.restaurant.create({
      data: {
        name: data.shopName,
        shopType,
        ownerName: data.ownerName,
        ownerEmail: data.ownerEmail,
        phone: data.phone,
        city: data.city,
        planId,
        status: 'Trial',
        subdomain,
        trialEndsAt: new Date(Date.now() + 14 * 86400000),
      },
    });

    const branch = await this.prisma.branch.create({
      data: { restaurantId: restaurant.id, name: 'Main Branch' },
    });

    const user = await this.prisma.user.create({
      data: {
        restaurantId: restaurant.id,
        branchId: branch.id,
        name: data.ownerName || data.shopName,
        email: data.ownerEmail,
        passwordHash: await bcrypt.hash(data.password, 12),
        role: 'OWNER',
      },
    });

    // Restaurants get starter categories + tables; other verticals start empty
    if (shopType === 'restaurant') {
      await this.prisma.menuCategory.createMany({
        data: [
          { restaurantId: restaurant.id, name: 'Starters', sortOrder: 1 },
          { restaurantId: restaurant.id, name: 'Main Course', sortOrder: 2 },
          { restaurantId: restaurant.id, name: 'Beverages', sortOrder: 3 },
          { restaurantId: restaurant.id, name: 'Desserts', sortOrder: 4 },
        ],
      });
      const tableData = [];
      for (let i = 1; i <= 8; i++) {
        tableData.push({ branchId: branch.id, name: `T-${String(i).padStart(2, '0')}`, capacity: 4 });
      }
      await this.prisma.table.createMany({ data: tableData });
    }

    return {
      ...this.generateTokens(user),
      restaurantId: restaurant.id,
      branchId: branch.id,
      subdomain,
      shopType,
      trialEndsAt: restaurant.trialEndsAt,
    };
  }

  // ── Public plans (for the pricing/signup page; no auth) ──────────────────────
  async listPublicPlans() {
    const plans = await this.prisma.plan.findMany({ where: { isActive: true }, orderBy: { price: 'asc' } });
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      maxBranches: p.maxBranches,
      maxUsers: p.maxUsers,
      maxItems: p.maxItems,
      featured: p.featured,
      modules: (() => { try { return JSON.parse(p.modules || '[]'); } catch { return []; } })(),
    }));
  }

  private generateTokens(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurantId,
        branchId: user.branchId,
      },
    };
  }
}
