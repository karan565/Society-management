import crypto from 'node:crypto';

import { AppError } from '../lib/http.js';
import { mapPaymentMethod } from '../lib/validation.js';

const currentYear = () => new Date().getFullYear();
const asDate = (date) => new Date(`${date}T00:00:00.000Z`);

export function maintenanceAmountForMonth(society, month) {
  const override = society.maintenanceOverrides.find((item) => item.month === month);
  if (override) return Number(override.amount);
  if (society.maintenanceEffectiveFrom && month >= society.maintenanceEffectiveFrom) {
    return Number(society.maintenanceAmount);
  }
  return Number(society.initialMaintenanceAmount);
}

function assertPaymentDetails(details) {
  const method = mapPaymentMethod(details.method);
  if (method !== 'CASH' && !details.reference.trim()) {
    throw new AppError(400, `Enter a payment reference for ${details.method}.`, 'PAYMENT_REFERENCE_REQUIRED');
  }
  if (asDate(details.paymentDate) > asDate(new Date().toISOString().slice(0, 10))) {
    throw new AppError(400, 'Payment date cannot be in the future.', 'INVALID_PAYMENT_DATE');
  }
  return { ...details, method };
}

export async function recordBillPayment(tx, bill, details, actor, { fromRequest = false } = {}) {
  if (bill.status !== 'PENDING') throw new AppError(409, 'This bill is already paid.', 'BILL_ALREADY_PAID');
  if (!fromRequest && bill.paymentRequest?.status === 'PENDING') {
    throw new AppError(409, 'Review the resident payment request instead of marking this bill manually.', 'PAYMENT_REQUEST_PENDING');
  }
  const valid = assertPaymentDetails(details);
  const receiptNo = `REC-${bill.month.replace('-', '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const paidAt = new Date(`${valid.paymentDate}T12:00:00.000Z`);

  await tx.maintenancePayment.create({
    data: {
      billId: bill.id,
      societyId: bill.societyId,
      userId: bill.userId,
      month: bill.month,
      recordedById: actor.id,
      amount: bill.amount,
      method: valid.method,
      reference: valid.reference.trim(),
      notes: valid.notes.trim(),
      receiptNo,
      paidAt
    }
  });
  const updated = await tx.maintenanceBill.update({
    where: { id: bill.id },
    data: {
      status: 'PAID',
      paidAt,
      paymentMethod: valid.method,
      paymentReference: valid.reference.trim(),
      paymentNotes: valid.notes.trim(),
      paymentAcceptedById: actor.id,
      paymentAcceptedByName: actor.name,
      paymentRecordedAt: new Date(),
      receiptNo,
      ...(fromRequest
        ? {
            paymentRequest: {
              update: { status: 'ACCEPTED', reviewedById: actor.id, reviewedAt: new Date() }
            }
          }
        : {})
    },
    include: { paymentRequest: true }
  });
  return updated;
}

export function assertCurrentYear(month) {
  const year = Number(month.slice(0, 4));
  if (year !== currentYear()) {
    throw new AppError(400, `Maintenance can only be scheduled for ${currentYear()}.`, 'YEAR_OUT_OF_RANGE');
  }
}
