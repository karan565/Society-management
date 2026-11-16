import bcrypt from 'bcryptjs';

import { prisma } from '../../db.js';
import { writeAudit } from '../../lib/audit.js';
import { USER_ROLES, userSelect } from '../../lib/constants.js';
import { AppError, parseId } from '../../lib/http.js';
import { serializeUser } from '../../lib/serializers.js';

function assertCanManageTarget(actor, target, societyId) {
  if (!target || target.societyId !== societyId || target.role === USER_ROLES.SUPER_ADMIN) {
    throw new AppError(404, 'The society user could not be found.', 'USER_NOT_FOUND');
  }
  if (actor.role === USER_ROLES.ADMIN && target.role !== USER_ROLES.RESIDENT) {
    throw new AppError(403, 'Admins can manage resident accounts only.', 'FORBIDDEN');
  }
}

export async function listUsers(req, res) {
  const selectedSociety = req.get('x-society-id');
  if (req.user.role === USER_ROLES.SUPER_ADMIN && !selectedSociety) {
    const users = await prisma.user.findMany({
      where: { role: { not: USER_ROLES.SUPER_ADMIN } },
      select: { ...userSelect, society: { select: { id: true, name: true } } },
      orderBy: [{ society: { name: 'asc' } }, { name: 'asc' }]
    });
    res.json({ users: users.map(serializeUser) });
    return;
  }

  if (req.user.role === USER_ROLES.SUPER_ADMIN) {
    const society = await prisma.society.findUnique({ where: { id: selectedSociety }, select: { id: true, isActive: true } });
    if (!society) throw new AppError(404, 'The selected society does not exist.', 'SOCIETY_NOT_FOUND');
    if (!society.isActive) throw new AppError(409, 'The selected society is inactive.', 'SOCIETY_INACTIVE');
    req.societyId = society.id;
  } else {
    req.societyId = req.user.societyId;
  }
  const users = await prisma.user.findMany({
    where: { societyId: req.societyId, role: { not: USER_ROLES.SUPER_ADMIN } },
    select: userSelect,
    orderBy: [{ role: 'asc' }, { name: 'asc' }]
  });
  res.json({ users: users.map(serializeUser) });
}

export async function createUser(req, res) {
  const societyId =
    req.user.role === USER_ROLES.SUPER_ADMIN
      ? req.body.societyId || req.get('x-society-id')
      : req.user.societyId;
  if (!societyId) throw new AppError(400, 'Select a society with the X-Society-Id header.', 'SOCIETY_SCOPE_REQUIRED');
  if (req.user.role === USER_ROLES.ADMIN && req.body.role !== 'resident')
    throw new AppError(403, 'Admins can create resident accounts only.', 'FORBIDDEN');
  const society = await prisma.society.findFirst({ where: { id: societyId, isActive: true } });
  if (!society) throw new AppError(404, 'The selected society does not exist or is inactive.', 'SOCIETY_NOT_FOUND');

  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        societyId,
        name: req.body.name,
        email: req.body.email,
        passwordHash,
        role: req.body.role === 'admin' ? USER_ROLES.ADMIN : USER_ROLES.RESIDENT,
        title: req.body.role === 'admin' ? req.body.title : 'Resident',
        apartment: req.body.apartment,
        phone: req.body.phone
      },
      select: userSelect
    });
    await writeAudit(tx, {
      societyId,
      actorId: req.user.id,
      action: 'user.created',
      entityType: 'User',
      entityId: created.id,
      metadata: { role: created.role }
    });
    return created;
  });
  res.status(201).json({ user: serializeUser(user) });
}

export async function getUser(req, res) {
  const userId = parseId(req.params.userId, 'user id');
  const user = await prisma.user.findFirst({
    where: { id: userId, societyId: req.societyId, role: { not: USER_ROLES.SUPER_ADMIN } },
    select: userSelect
  });
  if (!user || (req.user.role === USER_ROLES.ADMIN && user.role !== USER_ROLES.RESIDENT))
    throw new AppError(404, 'The society user could not be found.', 'USER_NOT_FOUND');
  res.json({ user: serializeUser(user) });
}

export async function updateOwnProfile(req, res) {
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: req.body,
    select: userSelect
  });
  res.json({ user: serializeUser(user) });
}

export async function updateUser(req, res) {
  const userId = parseId(req.params.userId, 'user id');
  const target = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  assertCanManageTarget(req.user, target, req.societyId);
  const user = await prisma.user.update({ where: { id: userId }, data: req.body, select: userSelect });
  res.json({ user: serializeUser(user) });
}

export async function updateUserAccess(req, res) {
  const userId = parseId(req.params.userId, 'user id');
  if (userId === req.user.id) throw new AppError(400, 'You cannot change your own account access.', 'SELF_ACCESS_CHANGE');
  const target = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  assertCanManageTarget(req.user, target, req.societyId);
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { isActive: req.body.isActive },
      select: userSelect
    });
    if (!req.body.isActive) {
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await writeAudit(tx, {
      societyId: req.societyId,
      actorId: req.user.id,
      action: req.body.isActive ? 'user.activated' : 'user.deactivated',
      entityType: 'User',
      entityId: userId
    });
    return updated;
  });
  res.json({ user: serializeUser(user) });
}

export async function resetUserPassword(req, res) {
  const userId = parseId(req.params.userId, 'user id');
  if (userId === req.user.id) throw new AppError(400, 'Use the change-password endpoint for your own account.', 'SELF_PASSWORD_RESET');
  const target = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  assertCanManageTarget(req.user, target, req.societyId);
  const passwordHash = await bcrypt.hash(req.body.password, 12);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: new Date() } });
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(tx, {
      societyId: req.societyId,
      actorId: req.user.id,
      action: 'user.password_reset',
      entityType: 'User',
      entityId: userId
    });
  });
  res.status(204).end();
}

export async function deactivateUser(req, res) {
  const userId = parseId(req.params.userId, 'user id');
  if (userId === req.user.id) throw new AppError(400, 'You cannot deactivate your own account.', 'SELF_DEACTIVATION');
  const target = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  assertCanManageTarget(req.user, target, req.societyId);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { isActive: false } });
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await writeAudit(tx, {
      societyId: req.societyId,
      actorId: req.user.id,
      action: 'user.deactivated',
      entityType: 'User',
      entityId: userId
    });
  });
  res.status(204).end();
}
