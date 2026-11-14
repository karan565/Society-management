import bcrypt from 'bcryptjs';

import { prisma } from '../../db.js';
import { writeAudit } from '../../lib/audit.js';
import { societySelect, USER_ROLES } from '../../lib/constants.js';
import { AppError, parseId } from '../../lib/http.js';
import { serializeSociety, serializeUser } from '../../lib/serializers.js';

export async function getCurrentSociety(req, res) {
  const society = await prisma.society.findUnique({ where: { id: req.societyId }, select: societySelect });
  res.json({ society: serializeSociety(society) });
}

export async function setFinanceVisibility(req, res) {
  const society = await prisma.$transaction(async (tx) => {
    const updated = await tx.society.update({
      where: { id: req.societyId },
      data: { expensesVisibleToResidents: req.body.visible },
      select: societySelect
    });
    await writeAudit(tx, {
      societyId: req.societyId,
      actorId: req.user.id,
      action: 'society.finance_visibility_changed',
      entityType: 'Society',
      entityId: req.societyId,
      metadata: { visible: req.body.visible }
    });
    return updated;
  });
  res.json({ society: serializeSociety(society) });
}

export async function listSocieties(_req, res) {
  const societies = await prisma.society.findMany({ orderBy: { createdAt: 'asc' }, select: societySelect });
  res.json({ societies: societies.map(serializeSociety) });
}

export async function createSociety(req, res) {
  const passwordHash = await bcrypt.hash(req.body.chairmanPassword, 12);
  const result = await prisma.$transaction(async (tx) => {
    const society = await tx.society.create({
      data: { name: req.body.name, address: req.body.address },
      select: societySelect
    });
    const chairman = await tx.user.create({
      data: {
        societyId: society.id,
        name: req.body.chairmanName,
        email: req.body.chairmanEmail,
        passwordHash,
        role: USER_ROLES.ADMIN,
        title: 'Chairperson'
      }
    });
    await writeAudit(tx, {
      societyId: society.id,
      actorId: req.user.id,
      action: 'society.created',
      entityType: 'Society',
      entityId: society.id,
      metadata: { chairmanId: chairman.id }
    });
    return { society, chairman };
  });
  res.status(201).json({
    society: serializeSociety(result.society),
    chairman: serializeUser(result.chairman)
  });
}

export async function getSociety(req, res) {
  const societyId = parseId(req.params.societyId, 'society id');
  const society = await prisma.society.findUnique({ where: { id: societyId }, select: societySelect });
  if (!society) throw new AppError(404, 'The society could not be found.', 'SOCIETY_NOT_FOUND');
  if (req.user.role !== USER_ROLES.SUPER_ADMIN && req.user.societyId !== society.id)
    throw new AppError(403, 'You cannot view another society.', 'FORBIDDEN');
  res.json({ society: serializeSociety(society) });
}

export async function updateSociety(req, res) {
  const societyId = parseId(req.params.societyId, 'society id');
  const society = await prisma.$transaction(async (tx) => {
    const updated = await tx.society.update({
      where: { id: societyId },
      data: req.body,
      select: societySelect
    });
    if (req.body.isActive === false) {
      await tx.session.updateMany({
        where: { user: { is: { societyId } }, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }
    await writeAudit(tx, {
      societyId,
      actorId: req.user.id,
      action:
        req.body.isActive === false
          ? 'society.deactivated'
          : req.body.isActive === true
            ? 'society.activated'
            : 'society.updated',
      entityType: 'Society',
      entityId: societyId,
      metadata: req.body
    });
    return updated;
  });
  res.json({ society: serializeSociety(society) });
}

export async function deactivateSociety(req, res) {
  const societyId = parseId(req.params.societyId, 'society id');
  const society = await prisma.$transaction(async (tx) => {
    const updated = await tx.society.update({
      where: { id: societyId },
      data: { isActive: false },
      select: societySelect
    });
    await tx.session.updateMany({
      where: { user: { is: { societyId } }, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    await writeAudit(tx, {
      societyId,
      actorId: req.user.id,
      action: 'society.deactivated',
      entityType: 'Society',
      entityId: societyId
    });
    return updated;
  });
  res.json({ society: serializeSociety(society) });
}
