import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Guards the /admin control-plane routes. Platform admins use a SEPARATE token
 * (claim platform:true) verified with PLATFORM_JWT_SECRET — completely distinct
 * from shop-user tokens, so a shop owner can never reach the control plane.
 */
@Injectable()
export class PlatformAuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Missing platform token');

    try {
      const payload: any = this.jwt.verify(token, {
        secret: process.env.PLATFORM_JWT_SECRET || process.env.JWT_SECRET || 'platform-dev-secret',
      });
      if (!payload?.platform) throw new Error('not a platform token');
      const admin = await this.prisma.platformAdmin.findUnique({ where: { id: payload.sub } });
      if (!admin || !admin.isActive) throw new Error('admin inactive');
      req.platformAdmin = { id: admin.id, email: admin.email, role: admin.role, name: admin.name };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired platform token');
    }
  }
}
