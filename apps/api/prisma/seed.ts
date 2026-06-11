import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Check if already seeded
  const existing = await prisma.restaurant.findFirst();
  if (existing) {
    console.log('Database already seeded. Skipping.');
    return;
  }

  // Create restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'Demo Restaurant',
      gstin: '22AAAAA0000A1Z5',
      address: '123 MG Road, Bangalore',
      phone: '+91-9999999999',
      email: 'demo@restrogenic.com',
      currency: 'INR',
      taxMode: 'GST',
      serviceCharge: 5,
    },
  });

  // Create branch
  const branch = await prisma.branch.create({
    data: {
      restaurantId: restaurant.id,
      name: 'Main Branch',
      address: '123 MG Road, Bangalore',
      phone: '+91-9999999999',
    },
  });

  // Create owner
  await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      branchId: branch.id,
      name: 'Demo Owner',
      email: 'owner@demo.com',
      passwordHash: await bcrypt.hash('demo1234', 12),
      pin: await bcrypt.hash('1234', 12),
      role: 'OWNER',
    },
  });

  // Create cashier
  await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      branchId: branch.id,
      name: 'Cashier Staff',
      email: 'cashier@demo.com',
      passwordHash: await bcrypt.hash('demo1234', 12),
      pin: await bcrypt.hash('5678', 12),
      role: 'CASHIER',
    },
  });

  // Create categories
  const categories = await Promise.all([
    prisma.menuCategory.create({ data: { restaurantId: restaurant.id, name: 'Starters', sortOrder: 1 } }),
    prisma.menuCategory.create({ data: { restaurantId: restaurant.id, name: 'Main Course', sortOrder: 2 } }),
    prisma.menuCategory.create({ data: { restaurantId: restaurant.id, name: 'Beverages', sortOrder: 3 } }),
    prisma.menuCategory.create({ data: { restaurantId: restaurant.id, name: 'Desserts', sortOrder: 4 } }),
  ]);

  const [starters, mains, beverages, desserts] = categories;

  // Seed menu items
  await prisma.menuItem.createMany({
    data: [
      { categoryId: starters.id, name: 'Paneer Tikka', basePrice: 249, isVeg: true, taxCategory: 'GST_5', sortOrder: 1, preparationTime: 15 },
      { categoryId: starters.id, name: 'Chicken Tikka', basePrice: 299, isVeg: false, taxCategory: 'GST_5', sortOrder: 2, preparationTime: 20 },
      { categoryId: starters.id, name: 'Veg Spring Roll', basePrice: 179, isVeg: true, taxCategory: 'GST_5', sortOrder: 3, preparationTime: 10 },
      { categoryId: starters.id, name: 'Soup of the Day', basePrice: 129, isVeg: true, taxCategory: 'GST_5', sortOrder: 4, preparationTime: 8 },
      { categoryId: mains.id, name: 'Butter Chicken', basePrice: 349, isVeg: false, taxCategory: 'GST_5', sortOrder: 1, preparationTime: 25 },
      { categoryId: mains.id, name: 'Paneer Butter Masala', basePrice: 299, isVeg: true, taxCategory: 'GST_5', sortOrder: 2, preparationTime: 20 },
      { categoryId: mains.id, name: 'Chicken Biryani', basePrice: 329, isVeg: false, taxCategory: 'GST_5', sortOrder: 3, preparationTime: 30 },
      { categoryId: mains.id, name: 'Veg Biryani', basePrice: 279, isVeg: true, taxCategory: 'GST_5', sortOrder: 4, preparationTime: 25 },
      { categoryId: mains.id, name: 'Dal Makhani', basePrice: 229, isVeg: true, taxCategory: 'GST_5', sortOrder: 5, preparationTime: 15 },
      { categoryId: mains.id, name: 'Tandoori Roti', basePrice: 30, isVeg: true, taxCategory: 'GST_5', sortOrder: 6, preparationTime: 5 },
      { categoryId: mains.id, name: 'Butter Naan', basePrice: 45, isVeg: true, taxCategory: 'GST_5', sortOrder: 7, preparationTime: 5 },
      { categoryId: beverages.id, name: 'Fresh Lime Soda', basePrice: 79, isVeg: true, taxCategory: 'GST_5', sortOrder: 1, preparationTime: 3 },
      { categoryId: beverages.id, name: 'Mango Lassi', basePrice: 99, isVeg: true, taxCategory: 'GST_5', sortOrder: 2, preparationTime: 3 },
      { categoryId: beverages.id, name: 'Masala Chai', basePrice: 49, isVeg: true, taxCategory: 'GST_5', sortOrder: 3, preparationTime: 5 },
      { categoryId: beverages.id, name: 'Cold Coffee', basePrice: 129, isVeg: true, taxCategory: 'GST_18', sortOrder: 4, preparationTime: 5 },
      { categoryId: beverages.id, name: 'Soft Drink', basePrice: 59, isVeg: true, taxCategory: 'GST_18', sortOrder: 5, preparationTime: 1 },
      { categoryId: desserts.id, name: 'Gulab Jamun', basePrice: 99, isVeg: true, taxCategory: 'GST_5', sortOrder: 1, preparationTime: 2 },
      { categoryId: desserts.id, name: 'Ice Cream (2 scoops)', basePrice: 129, isVeg: true, taxCategory: 'GST_5', sortOrder: 2, preparationTime: 3 },
      { categoryId: desserts.id, name: 'Kheer', basePrice: 89, isVeg: true, taxCategory: 'GST_5', sortOrder: 3, preparationTime: 5 },
    ],
  });

  // Add variants to Butter Chicken (Half/Full)
  const butterChicken = await prisma.menuItem.findFirst({ where: { name: 'Butter Chicken' } });
  if (butterChicken) {
    await prisma.itemVariant.createMany({
      data: [
        { menuItemId: butterChicken.id, name: 'Half', price: 249, isDefault: false },
        { menuItemId: butterChicken.id, name: 'Full', price: 349, isDefault: true },
      ],
    });
  }

  // Create tables
  const tableData = [];
  for (let i = 1; i <= 12; i++) {
    tableData.push({
      branchId: branch.id,
      name: `T-${String(i).padStart(2, '0')}`,
      capacity: i <= 4 ? 2 : i <= 8 ? 4 : 6,
      section: i <= 6 ? 'Indoor' : i <= 10 ? 'Outdoor' : 'Bar',
      posX: ((i - 1) % 4) * 25 + 2,
      posY: Math.floor((i - 1) / 4) * 33 + 5,
    });
  }
  await prisma.table.createMany({ data: tableData });

  // Create expense categories
  await prisma.expenseCategory.createMany({
    data: [
      { name: 'Rent', type: 'FIXED' },
      { name: 'Staff Salary', type: 'FIXED' },
      { name: 'Raw Materials', type: 'VARIABLE' },
      { name: 'Utilities', type: 'VARIABLE' },
      { name: 'Packaging', type: 'VARIABLE' },
      { name: 'Marketing', type: 'VARIABLE' },
      { name: 'Maintenance', type: 'VARIABLE' },
    ],
  });

  console.log('✅ Seed complete!');
  console.log('   Owner login: owner@demo.com / demo1234');
  console.log('   PIN login: 1234 (owner) or 5678 (cashier)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
