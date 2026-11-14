import { z } from 'zod';

import { COMPLAINT_STATUSES, COMPLAINT_TYPES, FINANCIAL_TRANSACTION_TYPES, PAYMENT_METHODS, USER_ROLES } from './constants.js';

export const uuidSchema = z.string().uuid();
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM for the month.');
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((date) => {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  }, 'Enter a valid calendar date.');
export const positiveAmountSchema = z.coerce.number().finite().positive().max(999999999);
export const passwordSchema = z.string().min(8).max(128);
export const emailSchema = z.string().trim().email().max(320).transform((email) => email.toLowerCase());
export const rolesInUi = Object.freeze({
  superadmin: USER_ROLES.SUPER_ADMIN,
  admin: USER_ROLES.ADMIN,
  resident: USER_ROLES.RESIDENT
});
export const paymentMethodsInUi = Object.freeze({
  Cash: 'CASH',
  UPI: 'UPI',
  Card: 'CARD',
  Cheque: 'CHEQUE',
  NEFT: 'NEFT',
  RTGS: 'RTGS',
  Other: 'OTHER'
});
export const transactionTypesInUi = Object.freeze({ income: 'INCOME', expense: 'EXPENSE' });
export const complaintTypesInUi = Object.freeze({ Complaint: 'COMPLAINT', Suggestion: 'SUGGESTION' });
export const complaintStatusesInUi = Object.freeze({
  open: 'OPEN',
  'in progress': 'IN_PROGRESS',
  rejected: 'REJECTED',
  closed: 'CLOSED',
  completed: 'COMPLETED'
});

export const paymentInputSchema = z.object({
  method: z.enum(['Cash', 'UPI', 'Card', 'Cheque', 'NEFT', 'RTGS', 'Other']),
  paymentDate: dateSchema,
  reference: z.string().trim().max(160).default(''),
  notes: z.string().trim().max(1000).default('')
});

export const maintenanceBillInclude = {
  paymentRequest: true,
  resident: { select: { id: true, name: true, email: true, apartment: true, phone: true } }
};

export function parseUiEnum(map, value, label) {
  const parsed = map[value];
  if (!parsed) throw new Error(`Invalid ${label}.`);
  return parsed;
}

export function parseRole(value) {
  const parsed = rolesInUi[value];
  if (!parsed) throw new Error('Choose a valid user role.');
  return parsed;
}

export function mapComplaintStatus(status) {
  const parsed = complaintStatusesInUi[status];
  if (!parsed || !COMPLAINT_STATUSES.includes(parsed)) throw new Error('Choose a valid complaint status.');
  return parsed;
}

export function mapComplaintType(type) {
  const parsed = complaintTypesInUi[type];
  if (!parsed || !COMPLAINT_TYPES.includes(parsed)) throw new Error('Choose a valid request type.');
  return parsed;
}

export function mapPaymentMethod(method) {
  const parsed = paymentMethodsInUi[method];
  if (!parsed || !PAYMENT_METHODS.includes(parsed)) throw new Error('Choose a valid payment method.');
  return parsed;
}

export function mapTransactionType(type) {
  const parsed = transactionTypesInUi[type];
  if (!parsed || !FINANCIAL_TRANSACTION_TYPES.includes(parsed)) throw new Error('Choose a valid transaction type.');
  return parsed;
}
