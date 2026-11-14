export function writeAudit(tx, { societyId = null, actorId = null, action, entityType, entityId = null, metadata = {} }) {
  return tx.auditLog.create({
    data: { societyId, actorId, action, entityType, entityId, metadata }
  });
}
