import 'dotenv/config';

import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().regex(/^\d+[smhd]$/).default('15m'),
  JWT_ISSUER: z.string().min(1).default('society-management-api'),
  JWT_AUDIENCE: z.string().min(1).default('society-management-web'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  FRONTEND_ORIGINS: z.string().default('http://localhost:3000'),
  COOKIE_SECURE: z.string().default('false'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_DOMAIN: z.string().optional().default(''),
  TRUST_PROXY: z.string().default('0'),
  SUPER_ADMIN_NAME: z.string().default('Society Developer'),
  SUPER_ADMIN_EMAIL: z.string().email().default('admin@example.com'),
  SUPER_ADMIN_PASSWORD: z.string().min(6)
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid backend environment: ${z.prettifyError(parsed.error)}`);
}

const values = parsed.data;
if (
  values.JWT_ACCESS_SECRET.startsWith('replace-') ||
  values.JWT_ACCESS_SECRET.startsWith('generate-') ||
  values.DATABASE_URL.includes('replace-this-password') ||
  values.SUPER_ADMIN_PASSWORD.startsWith('replace-') ||
  values.SUPER_ADMIN_PASSWORD.startsWith('change-me')
) {
  throw new Error('Replace placeholder values in backend/.env before starting the API.');
}

if (values.COOKIE_SAME_SITE === 'none' && values.COOKIE_SECURE !== 'true') {
  throw new Error('COOKIE_SECURE=true is required when COOKIE_SAME_SITE=none.');
}

export const config = Object.freeze({
  nodeEnv: values.NODE_ENV,
  port: values.PORT,
  databaseUrl: values.DATABASE_URL,
  jwtAccessSecret: values.JWT_ACCESS_SECRET,
  jwtAccessTtl: values.JWT_ACCESS_TTL,
  jwtIssuer: values.JWT_ISSUER,
  jwtAudience: values.JWT_AUDIENCE,
  refreshTokenDays: values.REFRESH_TOKEN_DAYS,
  frontendOrigins: values.FRONTEND_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  cookieSecure: values.COOKIE_SECURE === 'true',
  cookieSameSite: values.COOKIE_SAME_SITE,
  cookieDomain: values.COOKIE_DOMAIN || undefined,
  trustProxy: values.TRUST_PROXY === 'true' ? true : Number(values.TRUST_PROXY) || false,
  superAdminName: values.SUPER_ADMIN_NAME.trim(),
  superAdminEmail: values.SUPER_ADMIN_EMAIL.trim().toLowerCase(),
  superAdminPassword: values.SUPER_ADMIN_PASSWORD
});
