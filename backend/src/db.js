import { PrismaClient } from '@prisma/client';
import { config } from './config.js';

const databaseUrl = new URL(config.databaseUrl);
databaseUrl.searchParams.set('connection_limit', String(config.prismaConnectionLimit));

export const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl.toString() } },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
});
