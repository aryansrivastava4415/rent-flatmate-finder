require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@flatmatefinder.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const hashed = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: { email: adminEmail, password: hashed, name: 'Platform Admin', role: 'ADMIN' },
    });
    console.log(`Seeded admin account: ${adminEmail}`);
  } else {
    console.log('Admin account already exists, skipping.');
  }
}

// Allow running directly via `npm run seed`
if (require.main === module) {
  seedAdmin()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { seedAdmin };
