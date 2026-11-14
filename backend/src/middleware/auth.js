import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';

import { config } from '../config.js';
import { prisma } from '../db.js';
import { userSelect } from '../lib/constants.js';
import { AppError, asyncHandler } from '../lib/http.js';

export const REFRESH_COOKIE = 'society_refresh';

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(user, sessionId) {
  return jwt.sign({ sid: sessionId }, config.jwtAccessSecret, {
    algorithm: 'HS256',
    subject: user.id,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    expiresIn: config.jwtAccessTtl
  });
}

export function newRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: '/api/auth',
    ...(config.cookieDomain ? { domain: config.cookieDomain } : {})
  };
}

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'Sign in to continue.', 'AUTHENTICATION_REQUIRED');

  let claims;
  try {
    claims = jwt.verify(token, config.jwtAccessSecret, {
      algorithms: ['HS256'],
      issuer: config.jwtIssuer,
      audience: config.jwtAudience
    });
  } catch {
    throw new AppError(401, 'Your access token is invalid or expired.', 'INVALID_ACCESS_TOKEN');
  }
  if (typeof claims === 'string' || !claims.sid || !claims.sub)
    throw new AppError(401, 'Your access token is invalid.', 'INVALID_ACCESS_TOKEN');

  const session = await prisma.session.findFirst({
    where: { id: claims.sid, userId: claims.sub, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { select: { ...userSelect, passwordChangedAt: true, society: { select: { isActive: true } } } } }
  });
  if (!session || !session.user.isActive || (session.user.role !== 'SUPER_ADMIN' && !session.user.society?.isActive))
    throw new AppError(401, 'Your session is no longer active. Sign in again.', 'SESSION_REVOKED');

  req.user = session.user;
  req.sessionId = session.id;
  next();
});
