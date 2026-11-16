import 'dotenv/config';

import bcrypt from 'bcryptjs';

import { prisma } from '../src/db.js';
import { accounts, password, societyName } from './amardeep-seed-data.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('The Amardeep demo seeder cannot be run in production.');
}

if (accounts.filter(({ role }) => role === 'RESIDENT').length !== 28) {
  throw new Error('Expected exactly 28 Amardeep residents.');
}

try {
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const matchingSocieties = await tx.society.findMany({
      where: { name: societyName },
      select: { id: true },
      take: 2
    });

    if (matchingSocieties.length > 1) {
      throw new Error(`Multiple societies named "${societyName}" already exist.`);
    }

    const society =
      matchingSocieties[0] ??
      (await tx.society.create({ data: { name: societyName }, select: { id: true } }));

    const legacyA11Account = await tx.user.findFirst({
      where: { email: { equals: 'a1@amardeep.com', mode: 'insensitive' } },
      select: { id: true, role: true, societyId: true, apartment: true }
    });

    if (legacyA11Account) {
      if (
        legacyA11Account.role !== 'RESIDENT' ||
        legacyA11Account.societyId !== society.id ||
        legacyA11Account.apartment !== 'A-11'
      ) {
        throw new Error('Cannot rename a1@amardeep.com: it does not match the seeded A-11 resident.');
      }

      const correctedEmailAccount = await tx.user.findFirst({
        where: { email: { equals: 'a11@amardeep.com', mode: 'insensitive' } },
        select: { id: true }
      });

      if (correctedEmailAccount) {
        throw new Error('Cannot rename a1@amardeep.com: a11@amardeep.com is already in use.');
      }

      await tx.user.update({
        where: { id: legacyA11Account.id },
        data: { email: 'a11@amardeep.com' }
      });
    }

    const existingUsers = await tx.user.findMany({
      where: { email: { in: accounts.map(({ email }) => email) } },
      select: { email: true, role: true, societyId: true }
    });

    for (const user of existingUsers) {
      const expectedAccount = accounts.find(({ email }) => email === user.email);
      if (user.role !== expectedAccount.role || user.societyId !== society.id) {
        throw new Error(`Cannot seed ${user.email}: that email belongs to another account.`);
      }
    }

    const existingEmails = new Set(existingUsers.map(({ email }) => email));
    const accountsToCreate = accounts
      .filter(({ email }) => !existingEmails.has(email))
      .map((account) => ({
        societyId: society.id,
        name: account.name,
        email: account.email,
        passwordHash,
        role: account.role,
        title: account.title,
        apartment: account.apartment
      }));

    if (accountsToCreate.length > 0) {
      await tx.user.createMany({ data: accountsToCreate });
    }
  });

  console.log(`Seeded 28 residents and 3 administrators in ${societyName}.`);
} finally {
  await prisma.$disconnect();
}
