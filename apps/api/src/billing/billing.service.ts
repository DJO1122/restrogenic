import { Injectable, BadRequestException, NotFoundException, UnauthorizedException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Razorpay subscription billing.
 * - Works in MOCK mode when RAZORPAY_KEY_ID is unset (local dev / tests): no real
 *   API calls, returns fake ids so the whole flow is exercisable.
 * - In production, set RAZORPAY_KEY_ID / KEY_SECRET / WEBHOOK_SECRET and a
 *   RAZORPAY_PLAN_<PLANID> -> razorpay_plan_id mapping.
 */
@Injectable()
export class BillingService {
  private readonly log = new Logger('Billing');

  constructor(private prisma: PrismaService) {}

  private get keyId() { return process.env.RAZORPAY_KEY_ID || ''; }
  private get keySecret() { return process.env.RAZORPAY_KEY_SECRET || ''; }
  private get webhookSecret() { return process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_dev'; }
  private get isLive() { return !!this.keyId && !!this.keySecret; }

  // ── Create a subscription for a shop ────────────────────────────────────────
  async subscribe(restaurantId: string) {
    const tenant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { plan: true, subscription: true },
    });
    if (!tenant) throw new NotFoundException('Shop not found');
    if (!tenant.planId || !tenant.plan) throw new BadRequestException('Assign a plan before subscribing');
    if (tenant.plan.price === 0) throw new BadRequestException('Free plan needs no subscription');

    let razorpaySubId: string;
    let shortUrl: string | undefined;

    if (this.isLive) {
      // Map our plan -> a Razorpay plan id you created in the Razorpay dashboard
      const rzpPlanId = process.env[`RAZORPAY_PLAN_${tenant.planId.toUpperCase()}`];
      if (!rzpPlanId) throw new BadRequestException(`No Razorpay plan mapped for ${tenant.planId}`);
      const res = await this.rzp('POST', '/v1/subscriptions', {
        plan_id: rzpPlanId,
        total_count: 120, // up to 10 years of monthly cycles
        customer_notify: 1,
        notes: { restaurantId, shop: tenant.name },
      });
      razorpaySubId = res.id;
      shortUrl = res.short_url; // send this to the owner to authorize UPI-autopay/card
    } else {
      // MOCK mode
      razorpaySubId = 'sub_mock_' + crypto.randomBytes(6).toString('hex');
      shortUrl = `https://rzp.test/authorize/${razorpaySubId}`;
      this.log.warn(`MOCK subscription created (${razorpaySubId}) — set RAZORPAY_* for live billing`);
    }

    await this.prisma.subscription.upsert({
      where: { restaurantId },
      update: { razorpaySubId, status: 'created' },
      create: { restaurantId, razorpaySubId, status: 'created' },
    });

    return { razorpaySubId, authorizeUrl: shortUrl, mode: this.isLive ? 'live' : 'mock' };
  }

  // ── Owner-facing: upgrade trial → paid (optionally switch plan first) ────────
  async ownerSubscribe(restaurantId: string, planId?: string) {
    if (planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
      if (!plan || !plan.isActive) throw new BadRequestException('Invalid plan');
      if (plan.price === 0) throw new BadRequestException('Pick a paid plan to subscribe');
      await this.prisma.restaurant.update({ where: { id: restaurantId }, data: { planId } });
    }
    return this.subscribe(restaurantId);
  }

  // ── Owner-facing: billing status (drives the "X days left · Upgrade" banner) ─
  async status(restaurantId: string) {
    const t = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { plan: true, subscription: true },
    });
    if (!t) throw new NotFoundException('Shop not found');
    const trialDaysLeft = t.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(t.trialEndsAt).getTime() - Date.now()) / 86400000))
      : null;
    return {
      status: t.status, // Trial | Active | Suspended | Cancelled
      plan: t.plan ? { id: t.plan.id, name: t.plan.name, price: t.plan.price } : null,
      trialEndsAt: t.trialEndsAt,
      trialDaysLeft,
      isTrialExpired: t.status === 'Trial' && trialDaysLeft === 0,
      subscription: t.subscription ? { status: t.subscription.status, currentPeriodEnd: t.subscription.currentPeriodEnd } : null,
      needsUpgrade: t.status === 'Trial' || t.status === 'Suspended',
    };
  }

  // ── Cron job: suspend trials that expired without a paid subscription ─────────
  async expireTrials() {
    const now = new Date();
    const expired = await this.prisma.restaurant.findMany({
      where: { status: 'Trial', trialEndsAt: { lt: now } },
      include: { subscription: true },
    });
    let suspended = 0;
    for (const t of expired) {
      if (t.subscription && t.subscription.status === 'active') continue; // already paying
      await this.prisma.restaurant.update({ where: { id: t.id }, data: { status: 'Suspended' } });
      suspended++;
      this.log.warn(`Trial expired → Suspended: ${t.name}`);
    }
    return { checked: expired.length, suspended };
  }

  // ── Webhook handler ─────────────────────────────────────────────────────────
  async handleWebhook(rawBody: Buffer | string, signature?: string) {
    const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(body).digest('hex');
    // timing-safe compare
    const sigOk =
      !!signature &&
      signature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!sigOk) throw new UnauthorizedException('Invalid webhook signature');

    let event: any;
    try { event = JSON.parse(body); } catch { throw new BadRequestException('Bad JSON'); }

    const type: string = event.event;
    const sub = event?.payload?.subscription?.entity;
    const pay = event?.payload?.payment?.entity;
    const razorpaySubId = sub?.id || pay?.subscription_id;

    this.log.log(`Webhook: ${type} (sub ${razorpaySubId || 'n/a'})`);

    switch (type) {
      case 'subscription.activated':
      case 'subscription.charged': {
        await this.markActiveAndInvoice(razorpaySubId, pay);
        break;
      }
      case 'subscription.halted':
      case 'subscription.cancelled':
      case 'subscription.paused': {
        await this.suspendForSub(razorpaySubId, type);
        break;
      }
      case 'payment.failed': {
        // record a failed invoice; grace handled by halted later
        await this.recordFailedPayment(razorpaySubId, pay);
        break;
      }
      default:
        this.log.log(`Unhandled event ${type} (ignored)`);
    }
    return { received: true, event: type };
  }

  private async findTenantBySub(razorpaySubId?: string) {
    if (!razorpaySubId) return null;
    const subscription = await this.prisma.subscription.findFirst({ where: { razorpaySubId } });
    if (!subscription) return null;
    return this.prisma.restaurant.findUnique({ where: { id: subscription.restaurantId }, include: { plan: true } });
  }

  private async markActiveAndInvoice(razorpaySubId?: string, pay?: any) {
    const tenant = await this.findTenantBySub(razorpaySubId);
    if (!tenant) { this.log.warn(`No tenant for sub ${razorpaySubId}`); return; }

    await this.prisma.subscription.update({
      where: { restaurantId: tenant.id },
      data: { status: 'active', currentPeriodEnd: new Date(Date.now() + 30 * 86400000) },
    });
    await this.prisma.restaurant.update({ where: { id: tenant.id }, data: { status: 'Active' } });

    // amount comes in paise from Razorpay; fall back to plan price (₹)
    const amount = pay?.amount ? Math.round(pay.amount / 100) : tenant.plan?.price || 0;
    const count = await this.prisma.invoice.count();
    await this.prisma.invoice.create({
      data: {
        restaurantId: tenant.id,
        number: 'INV-' + String(1001 + count),
        amount,
        status: 'Paid',
        planName: tenant.plan?.name,
        periodFrom: new Date(),
        periodTo: new Date(Date.now() + 30 * 86400000),
        paidAt: new Date(),
      },
    });
    this.log.log(`Tenant ${tenant.name} → Active, invoice ₹${amount} created`);
  }

  private async suspendForSub(razorpaySubId?: string, reason?: string) {
    const tenant = await this.findTenantBySub(razorpaySubId);
    if (!tenant) return;
    await this.prisma.subscription.update({
      where: { restaurantId: tenant.id },
      data: { status: reason?.includes('cancelled') ? 'cancelled' : 'past_due' },
    });
    await this.prisma.restaurant.update({ where: { id: tenant.id }, data: { status: 'Suspended' } });
    this.log.warn(`Tenant ${tenant.name} → Suspended (${reason})`);
  }

  private async recordFailedPayment(razorpaySubId?: string, pay?: any) {
    const tenant = await this.findTenantBySub(razorpaySubId);
    if (!tenant) return;
    const count = await this.prisma.invoice.count();
    await this.prisma.invoice.create({
      data: {
        restaurantId: tenant.id,
        number: 'INV-' + String(1001 + count),
        amount: pay?.amount ? Math.round(pay.amount / 100) : tenant.plan?.price || 0,
        status: 'Failed',
        planName: tenant.plan?.name,
      },
    });
  }

  // ── tiny Razorpay REST helper (no SDK dependency) ───────────────────────────
  private async rzp(method: string, path: string, body?: any): Promise<any> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com' + path, {
      method,
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok) throw new BadRequestException(`Razorpay: ${json?.error?.description || res.statusText}`);
    return json;
  }
}
