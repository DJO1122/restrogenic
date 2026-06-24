import { Controller, Get, SetMetadata } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

const Public = () => SetMetadata('isPublic', true);

@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  // Liveness + DB check — used by uptime monitors / load balancers
  @Public()
  @Get('health')
  async health() {
    let db = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }
    return {
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      uptime: Math.round(process.uptime()),
      ts: new Date().toISOString(),
    };
  }
}
