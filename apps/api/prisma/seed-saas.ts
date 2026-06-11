import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding SaaS control plane...');

  // ── Platform super-admin (YOU) ──
  // Credentials come from env. If PLATFORM_ADMIN_PASSWORD is unset we generate a
  // strong random one and print it ONCE in the boot logs — never a public default.
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL || 'admin@restrogenic.cloud';
  const existing = await prisma.platformAdmin.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const adminPw = process.env.PLATFORM_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
    await prisma.platformAdmin.create({
      data: {
        name: 'Platform Owner',
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPw, 12),
        role: 'admin',
      },
    });
    console.log('  ✓ Platform admin created:');
    console.log(`      email:    ${adminEmail}`);
    console.log(`      password: ${adminPw}`);
    if (!process.env.PLATFORM_ADMIN_PASSWORD) {
      console.log('      ^ randomly generated — SAVE IT (set PLATFORM_ADMIN_PASSWORD to choose your own).');
    }
  } else {
    console.log('  • Platform admin already exists (password unchanged)');
  }

  // ── Subscription plans ──
  const plans = [
    { id: 'pl_free', name: 'Free Trial', price: 0, maxBranches: 1, maxUsers: 2, maxItems: 50, featured: false, modules: ['Billing', 'Menu', 'Daily sales'] },
    { id: 'pl_starter', name: 'Starter', price: 499, maxBranches: 1, maxUsers: 3, maxItems: 200, featured: false, modules: ['Billing & GST', 'Menu', 'Reports', 'Receipt printing'] },
    { id: 'pl_pro', name: 'Pro', price: 999, maxBranches: 1, maxUsers: 8, maxItems: -1, featured: true, modules: ['Inventory & recipes', 'Online orders', 'KOT / KDS', 'Multi-user roles'] },
    { id: 'pl_prem', name: 'Premium', price: 1999, maxBranches: -1, maxUsers: -1, maxItems: -1, featured: false, modules: ['Multi-branch', 'All shop types', 'API access', 'Priority support'] },
  ];
  for (const p of plans) {
    await prisma.plan.upsert({
      where: { id: p.id },
      update: { name: p.name, price: p.price, maxBranches: p.maxBranches, maxUsers: p.maxUsers, maxItems: p.maxItems, featured: p.featured, modules: JSON.stringify(p.modules) },
      create: { ...p, modules: JSON.stringify(p.modules) },
    });
  }
  console.log(`  ✓ ${plans.length} plans seeded`);

  console.log('✅ SaaS seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
