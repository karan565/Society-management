import bcrypt from 'bcryptjs';

import { config } from '../src/config.js';
import { prisma } from '../src/db.js';

try {
  const existing = await prisma.user.findUnique({ where: { email: config.superAdminEmail } });
  if (existing) {
    if (existing.role !== 'SUPER_ADMIN') throw new Error('Configured bootstrap email is already used by a non-Super Admin account.');
    console.log(`Super Admin ${config.superAdminEmail} already exists; no changes made.`);
  } else {
    const passwordHash = await bcrypt.hash(config.superAdminPassword, 12);
    await prisma.user.create({
      data: {
        name: config.superAdminName,
        email: config.superAdminEmail,
        passwordHash,
        role: 'SUPER_ADMIN',
        title: 'Developer'
      }
    });
    console.log(`Created initial Super Admin ${config.superAdminEmail}.`);
  }
} finally {
  await prisma.$disconnect();
}
