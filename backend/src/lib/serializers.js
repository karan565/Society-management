const roleToUi = { SUPER_ADMIN: 'superadmin', ADMIN: 'admin', RESIDENT: 'resident' };
const methodToUi = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', CHEQUE: 'Cheque', NEFT: 'NEFT', RTGS: 'RTGS', OTHER: 'Other' };
const typeToUi = { COMPLAINT: 'Complaint', SUGGESTION: 'Suggestion' };
const statusToUi = {
  OPEN: 'open',
  IN_PROGRESS: 'in progress',
  REJECTED: 'rejected',
  CLOSED: 'closed',
  COMPLETED: 'completed'
};

const dateOnly = (value) => (value ? value.toISOString().slice(0, 10) : null);

export function serializeUser(user) {
  return {
    id: user.id,
    societyId: user.societyId,
    name: user.name,
    email: user.email,
    role: roleToUi[user.role] || user.role.toLowerCase(),
    title: user.title,
    apartment: user.apartment,
    phone: user.phone,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    ...(user.society ? { society: serializeSociety(user.society) } : {})
  };
}

export function serializeSociety(society) {
  return {
    ...society,
    maintenanceAmount: Number(society.maintenanceAmount)
  };
}

export function serializeBill(bill) {
  return {
    id: bill.id,
    societyId: bill.societyId,
    userId: bill.userId,
    month: bill.month,
    amount: Number(bill.amount),
    status: bill.status.toLowerCase(),
    dueDate: dateOnly(bill.dueDate),
    paidAt: bill.paidAt?.toISOString(),
    paymentMethod: bill.paymentMethod ? methodToUi[bill.paymentMethod] : undefined,
    paymentReference: bill.paymentReference || undefined,
    paymentNotes: bill.paymentNotes || undefined,
    paymentAcceptedBy: bill.paymentAcceptedByName || undefined,
    paymentRecordedAt: bill.paymentRecordedAt?.toISOString(),
    receiptNo: bill.receiptNo || undefined,
    ...(bill.paymentRequest?.status === 'PENDING'
      ? {
          paymentRequest: {
            method: methodToUi[bill.paymentRequest.method],
            paymentDate: dateOnly(bill.paymentRequest.paymentDate),
            reference: bill.paymentRequest.reference,
            notes: bill.paymentRequest.notes,
            submittedAt: bill.paymentRequest.submittedAt.toISOString(),
            submittedBy: bill.paymentRequest.submittedById
          }
        }
      : {})
  };
}

export function serializeTransaction(transaction) {
  return {
    id: transaction.id,
    societyId: transaction.societyId,
    type: transaction.type.toLowerCase(),
    title: transaction.title,
    amount: Number(transaction.amount),
    date: dateOnly(transaction.date),
    notes: transaction.notes,
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString()
  };
}

export function serializeComplaint(complaint) {
  return {
    id: complaint.id,
    societyId: complaint.societyId,
    userId: complaint.userId,
    type: typeToUi[complaint.type],
    title: complaint.title,
    description: complaint.description,
    status: statusToUi[complaint.status],
    createdAt: complaint.createdAt.toISOString(),
    updatedAt: complaint.updatedAt.toISOString()
  };
}
