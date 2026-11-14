export const USER_ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  RESIDENT: 'RESIDENT'
});

export const PAYMENT_METHODS = Object.freeze(['CASH', 'UPI', 'CARD', 'CHEQUE', 'NEFT', 'RTGS', 'OTHER']);
export const COMPLAINT_TYPES = Object.freeze(['COMPLAINT', 'SUGGESTION']);
export const COMPLAINT_STATUSES = Object.freeze(['OPEN', 'IN_PROGRESS', 'REJECTED', 'CLOSED', 'COMPLETED']);
export const FINANCIAL_TRANSACTION_TYPES = Object.freeze(['INCOME', 'EXPENSE']);

export const userSelect = {
  id: true,
  societyId: true,
  name: true,
  email: true,
  role: true,
  title: true,
  apartment: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
};

export const societySelect = {
  id: true,
  name: true,
  address: true,
  isActive: true,
  expensesVisibleToResidents: true,
  maintenanceAmount: true,
  maintenanceEffectiveFrom: true,
  createdAt: true,
  updatedAt: true
};

export const paymentMethodSchemaValues = PAYMENT_METHODS;
