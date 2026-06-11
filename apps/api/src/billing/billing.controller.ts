import { Controller, Get, Post, Param, Req, Headers, Body, UseGuards, HttpCode } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PlatformAuthGuard } from '../admin/platform-auth.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller()
export class BillingController {
  constructor(private billing: BillingService) {}

  // ── Owner-facing (shop user token) ──────────────────────────────────────────
  // The shop's own billing status → powers the "X days left · Upgrade now" banner
  @UseGuards(JwtAuthGuard)
  @Get('billing/status')
  myStatus(@Req() req: any) {
    return this.billing.status(req.user.restaurantId);
  }

  // Owner upgrades trial → paid (optionally switching plan) → returns authorize URL
  @UseGuards(JwtAuthGuard)
  @Post('billing/subscribe')
  ownerSubscribe(@Req() req: any, @Body() body: { planId?: string }) {
    return this.billing.ownerSubscribe(req.user.restaurantId, body?.planId);
  }

  // ── Platform admin ──────────────────────────────────────────────────────────
  @UseGuards(PlatformAuthGuard)
  @Post('admin/tenants/:id/subscribe')
  subscribe(@Param('id') id: string) {
    return this.billing.subscribe(id);
  }

  // Cron/admin trigger: suspend expired trials (call daily)
  @UseGuards(PlatformAuthGuard)
  @Post('admin/billing/expire-trials')
  expireTrials() {
    return this.billing.expireTrials();
  }

  // ── Razorpay webhook (public, HMAC-verified over the raw body) ──────────────
  @Post('webhooks/razorpay')
  @HttpCode(200)
  webhook(@Req() req: any, @Headers('x-razorpay-signature') signature: string) {
    const raw = req.rawBody ?? JSON.stringify(req.body ?? {});
    return this.billing.handleWebhook(raw, signature);
  }
}
