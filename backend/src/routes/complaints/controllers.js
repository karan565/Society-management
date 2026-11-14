import { prisma } from '../../db.js';
import { writeAudit } from '../../lib/audit.js';
import { USER_ROLES } from '../../lib/constants.js';
import { AppError, parseId } from '../../lib/http.js';
import { serializeComplaint } from '../../lib/serializers.js';
import { mapComplaintStatus, mapComplaintType } from '../../lib/validation.js';

export async function listComplaints(req, res) {
  const where = {
    societyId: req.societyId,
    ...(req.user.role === USER_ROLES.RESIDENT ? { userId: req.user.id } : {})
  };
  const complaints = await prisma.complaint.findMany({
    where,
    include: { resident: { select: { id: true, name: true, apartment: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json({
    complaints: complaints.map((complaint) => ({
      ...serializeComplaint(complaint),
      ...(req.user.role !== USER_ROLES.RESIDENT ? { resident: complaint.resident } : {})
    }))
  });
}

export async function getComplaint(req, res) {
  const complaint = await prisma.complaint.findFirst({
    where: {
      id: parseId(req.params.complaintId, 'complaint id'),
      societyId: req.societyId,
      ...(req.user.role === USER_ROLES.RESIDENT ? { userId: req.user.id } : {})
    },
    include: { resident: { select: { id: true, name: true, apartment: true } } }
  });
  if (!complaint) throw new AppError(404, 'The complaint or suggestion could not be found.', 'COMPLAINT_NOT_FOUND');
  res.json({
    complaint: {
      ...serializeComplaint(complaint),
      ...(req.user.role !== USER_ROLES.RESIDENT ? { resident: complaint.resident } : {})
    }
  });
}

export async function createComplaint(req, res) {
  const complaint = await prisma.$transaction(async (tx) => {
    const created = await tx.complaint.create({
      data: {
        societyId: req.societyId,
        userId: req.user.id,
        type: mapComplaintType(req.body.type),
        title: req.body.title,
        description: req.body.description
      }
    });
    await writeAudit(tx, {
      societyId: req.societyId,
      actorId: req.user.id,
      action: 'complaint.created',
      entityType: 'Complaint',
      entityId: created.id,
      metadata: { type: created.type }
    });
    return created;
  });
  res.status(201).json({ complaint: serializeComplaint(complaint) });
}

export async function updateComplaintStatus(req, res) {
  const complaintId = parseId(req.params.complaintId, 'complaint id');
  const complaint = await prisma.$transaction(async (tx) => {
    const existing = await tx.complaint.findFirst({
      where: { id: complaintId, societyId: req.societyId },
      select: { id: true, status: true, userId: true }
    });
    if (!existing) throw new AppError(404, 'The complaint or suggestion could not be found.', 'COMPLAINT_NOT_FOUND');

    let nextStatus;
    if (req.user.role === USER_ROLES.RESIDENT) {
      if (existing.userId !== req.user.id)
        throw new AppError(403, 'You can only close your own complaint or suggestion.', 'FORBIDDEN');
      if (!['OPEN', 'IN_PROGRESS'].includes(existing.status))
        throw new AppError(409, 'Only open or in-progress requests can be closed.', 'STATUS_TRANSITION_NOT_ALLOWED');
      if (req.body.status !== 'closed')
        throw new AppError(403, 'Residents can only close their own requests.', 'FORBIDDEN');
      nextStatus = 'CLOSED';
    } else {
      nextStatus = mapComplaintStatus(req.body.status);
    }

    const updated = await tx.complaint.update({ where: { id: complaintId }, data: { status: nextStatus } });
    await writeAudit(tx, {
      societyId: req.societyId,
      actorId: req.user.id,
      action: 'complaint.status_changed',
      entityType: 'Complaint',
      entityId: complaintId,
      metadata: { from: existing.status, to: nextStatus }
    });
    return updated;
  });
  res.json({ complaint: serializeComplaint(complaint) });
}

export async function deleteComplaint(req, res) {
  const complaintId = parseId(req.params.complaintId, 'complaint id');
  await prisma.$transaction(async (tx) => {
    const complaint = await tx.complaint.findFirst({
      where: { id: complaintId, societyId: req.societyId },
      select: { id: true, userId: true, status: true }
    });
    if (!complaint) throw new AppError(404, 'The complaint or suggestion could not be found.', 'COMPLAINT_NOT_FOUND');
    const canDelete =
      req.user.role === USER_ROLES.SUPER_ADMIN ||
      req.user.role === USER_ROLES.ADMIN ||
      (req.user.role === USER_ROLES.RESIDENT && complaint.userId === req.user.id && complaint.status === 'OPEN');
    if (!canDelete) throw new AppError(403, 'You cannot delete this request.', 'FORBIDDEN');
    await tx.complaint.delete({ where: { id: complaintId } });
    await writeAudit(tx, {
      societyId: req.societyId,
      actorId: req.user.id,
      action: 'complaint.deleted',
      entityType: 'Complaint',
      entityId: complaintId
    });
  });
  res.status(204).end();
}
