export const USER_ROLES = Object.freeze({
  SUPER_ADMIN: 'superadmin',
  ADMIN: 'admin',
  RESIDENT: 'resident'
});

export const USER_ROLE_LABELS = Object.freeze({
  [USER_ROLES.SUPER_ADMIN]: 'Super Admin',
  [USER_ROLES.ADMIN]: 'Admin',
  [USER_ROLES.RESIDENT]: 'Resident'
});

export const ADMIN_ROLES = Object.freeze([USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN]);

export const FINANCIAL_TRANSACTION_TYPES = Object.freeze({
  INCOME: 'income',
  EXPENSE: 'expense'
});

export const FINANCIAL_TRANSACTION_TYPE_LABELS = Object.freeze({
  [FINANCIAL_TRANSACTION_TYPES.INCOME]: 'Other income',
  [FINANCIAL_TRANSACTION_TYPES.EXPENSE]: 'Expense'
});

export const PAYMENT_METHODS = Object.freeze(['Cash', 'UPI', 'Card', 'Cheque', 'NEFT', 'RTGS', 'Other']);

export const PAYMENT_REFERENCE_LABELS = Object.freeze({
  Cash: 'Cash receipt number (optional)',
  UPI: 'UPI transaction number / UTR',
  Card: 'Card transaction / authorization ID',
  Cheque: 'Cheque number',
  NEFT: 'NEFT UTR / transaction number',
  RTGS: 'RTGS UTR / transaction number',
  Other: 'Payment reference / ID'
});

export const COMPLAINT_TYPES = Object.freeze({
  COMPLAINT: 'Complaint',
  SUGGESTION: 'Suggestion'
});

export const COMPLAINT_TYPE_OPTIONS = Object.freeze(Object.values(COMPLAINT_TYPES));

export const COMPLAINT_STATUSES = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in progress',
  REJECTED: 'rejected',
  CLOSED: 'closed',
  COMPLETED: 'completed'
});

export const COMPLAINT_STATUS_OPTIONS = Object.freeze(Object.values(COMPLAINT_STATUSES));

export const COMPLAINT_STATUS_LABELS = Object.freeze({
  [COMPLAINT_STATUSES.OPEN]: 'Open',
  [COMPLAINT_STATUSES.IN_PROGRESS]: 'In progress',
  [COMPLAINT_STATUSES.REJECTED]: 'Rejected',
  [COMPLAINT_STATUSES.CLOSED]: 'Closed',
  [COMPLAINT_STATUSES.COMPLETED]: 'Completed'
});

export const COMPLAINT_STATUS_COLORS = Object.freeze({
  [COMPLAINT_STATUSES.OPEN]: 'warning',
  [COMPLAINT_STATUSES.IN_PROGRESS]: 'info',
  [COMPLAINT_STATUSES.REJECTED]: 'error',
  [COMPLAINT_STATUSES.CLOSED]: 'default',
  [COMPLAINT_STATUSES.COMPLETED]: 'success'
});
