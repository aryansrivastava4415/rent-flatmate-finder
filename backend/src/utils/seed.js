require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@flatmatefinder.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const hashed = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { password: hashed },
    create: { email: adminEmail, password: hashed, name: 'Platform Admin', role: 'ADMIN' },
  });
  console.log(`Admin account ready: ${adminEmail} (password synced from ADMIN_PASSWORD env var)`);
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
