import bcrypt from 'bcryptjs';

import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { REFRESH_COOKIE, hashToken, newRefreshToken, refreshCookieOptions, signAccessToken } from '../../middleware/auth.js';
import { userSelect } from '../../lib/constants.js';
import { AppError } from '../../lib/http.js';
import { serializeUser } from '../../lib/serializers.js';

const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

function assertRefreshOrigin(req) {
  const origin = req.get('origin');
  if (origin && !config.frontendOrigins.includes(origin))
    throw new AppError(403, 'This origin is not allowed to use the API.', 'ORIGIN_NOT_ALLOWED');
}

async function createSession(user, req, res) {
  const refreshToken = newRefreshToken();
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshHash: hashToken(refreshToken),
      expiresAt: daysFromNow(config.refreshTokenDays),
      userAgent: req.get('user-agent')?.slice(0, 500),
      ipAddress: req.ip?.slice(0, 64)
    }
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...refreshCookieOptions(),
    maxAge: config.refreshTokenDays * 24 * 60 * 60 * 1000
  });
  return { session, accessToken: signAccessToken(user, session.id) };
}

export async function login(req, res) {
  const user = await prisma.user.findUnique({ where: { email: req.body.email } });
  const passwordMatches = user ? await bcrypt.compare(req.body.password, user.passwordHash) : false;
  if (!user || !passwordMatches) throw new AppError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS');
  if (!user.isActive) throw new AppError(403, 'This account is inactive. Contact your society administrator.', 'ACCOUNT_INACTIVE');
  if (user.role !== 'SUPER_ADMIN' && (!user.societyId || !(await prisma.society.findFirst({ where: { id: user.societyId, isActive: true } }))))
    throw new AppError(403, 'This account is not assigned to an active society.', 'SOCIETY_INACTIVE');

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const { accessToken, session } = await createSession(user, req, res);
  res.status(200).json({
    accessToken,
    tokenType: 'Bearer',
    expiresIn: config.jwtAccessTtl,
    session: { id: session.id, expiresAt: session.expiresAt },
    user: serializeUser({ ...user, lastLoginAt: new Date() })
  });
}

export async function refresh(req, res) {
  assertRefreshOrigin(req);
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw new AppError(401, 'Your refresh session is missing. Sign in again.', 'REFRESH_REQUIRED');

  const tokenHash = hashToken(token);
  const session = await prisma.session.findFirst({
    where: { refreshHash: tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true }
  });
  if (!session || !session.user.isActive || (session.user.role !== 'SUPER_ADMIN' && !session.user.societyId)) {
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    throw new AppError(401, 'Your refresh session has expired or been revoked. Sign in again.', 'INVALID_REFRESH_SESSION');
  }

  const nextRefreshToken = newRefreshToken();
  const rotated = await prisma.session.updateMany({
    where: { id: session.id, refreshHash: tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { refreshHash: hashToken(nextRefreshToken), lastUsedAt: new Date() }
  });
  if (rotated.count !== 1) {
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    throw new AppError(401, 'This refresh token has already been used. Sign in again.', 'REFRESH_TOKEN_REUSED');
  }
  res.cookie(REFRESH_COOKIE, nextRefreshToken, {
    ...refreshCookieOptions(),
    maxAge: config.refreshTokenDays * 24 * 60 * 60 * 1000
  });
  const user = {
    ...session.user,
    society: session.user.societyId
      ? await prisma.society.findUnique({ where: { id: session.user.societyId }, select: { isActive: true } })
      : null
  };
  if (user.role !== 'SUPER_ADMIN' && !user.society?.isActive)
    throw new AppError(401, 'The society associated with this session is inactive.', 'SOCIETY_INACTIVE');
  res.json({
    accessToken: signAccessToken(user, session.id),
    tokenType: 'Bearer',
    expiresIn: config.jwtAccessTtl,
    user: serializeUser(user)
  });
}

export async function logout(req, res) {
  assertRefreshOrigin(req);
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    await prisma.session.updateMany({
      where: { refreshHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  res.status(204).end();
}

export async function logoutAll(req, res) {
  await prisma.session.updateMany({
    where: { userId: req.user.id, revokedAt: null },
    data: { revokedAt: new Date() }
  });
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  res.status(204).end();
}

export async function getCurrentUser(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { ...userSelect, society: { select: { id: true, name: true, isActive: true } } }
  });
  res.json({ user: serializeUser(user) });
}

export async function listSessions(req, res) {
  const sessions = await prisma.session.findMany({
    where: { userId: req.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, createdAt: true, lastUsedAt: true, expiresAt: true, userAgent: true, ipAddress: true },
    orderBy: { lastUsedAt: 'desc' }
  });
  res.json({ sessions, currentSessionId: req.sessionId });
}

export async function revokeSession(req, res) {
  const result = await prisma.session.updateMany({
    where: { id: req.params.sessionId, userId: req.user.id, revokedAt: null },
    data: { revokedAt: new Date() }
  });
  if (!result.count) throw new AppError(404, 'The active session could not be found.', 'SESSION_NOT_FOUND');
  if (req.params.sessionId === req.sessionId) res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  res.status(204).end();
}

export async function changePassword(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash)))
    throw new AppError(400, 'Current password is incorrect.', 'CURRENT_PASSWORD_INCORRECT');
  if (await bcrypt.compare(req.body.newPassword, user.passwordHash))
    throw new AppError(400, 'Choose a password different from your current password.', 'PASSWORD_UNCHANGED');

  const passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: new Date() } });
    await tx.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  });
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  res.json({ message: 'Password changed. Sign in again with your new password.' });
}
