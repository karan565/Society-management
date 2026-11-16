import { prisma } from '../../db.js';
import { writeAudit } from '../../lib/audit.js';
import { USER_ROLES } from '../../lib/constants.js';
import { AppError, parseId } from '../../lib/http.js';
import { serializeBill } from '../../lib/serializers.js';
import { assertCurrentYear, maintenanceAmountForMonth, recordBillPayment } from '../../services/billing.js';

const methodToDb = { Cash: 'CASH', UPI: 'UPI', Card: 'CARD', Cheque: 'CHEQUE', NEFT: 'NEFT', RTGS: 'RTGS', Other: 'OTHER' };
const methodToUi = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', CHEQUE: 'Cheque', NEFT: 'NEFT', RTGS: 'RTGS', OTHER: 'Other' };
const billInclude = {
  paymentRequest: true,
  resident: { select: { id: true, name: true, email: true, apartment: true, phone: true } }
};
const monthOf = (date) => date.toISOString().slice(0, 7);
const currentMonth = () => monthOf(new Date());
const dueDateFor = (month) => new Date(`${month}-10T00:00:00.000Z`);

async function getResidentMonth(tx, societyId, userId, month) {
  const [society, resident] = await Promise.all([
    tx.society.findUnique({
      where: { id: societyId },
      include: { maintenanceOverrides: true }
    }),
    tx.user.findFirst({
      where: { id: userId, societyId, role: USER_ROLES.RESIDENT }
    })
  ]);
  if (!society) throw new AppError(404, 'The society could not be found.', 'SOCIETY_NOT_FOUND');
  if (!resident) throw new AppError(404, 'The resident could not be found in this society.', 'RESIDENT_NOT_FOUND');

  const startMonth = [monthOf(society.createdAt), monthOf(resident.createdAt)].sort().pop();
  if (month < startMonth || month > currentMonth()) {
    throw new AppError(400, 'This maintenance month is outside the resident’s active billing period.', 'INVALID_BILLING_MONTH');
  }

  return {
    society,
    resident,
    amount: maintenanceAmountForMonth(society, month)
  };
}

export async function listBills(req, res) {
  const where = {
    societyId: req.societyId,
    OR: [{ status: 'PAID' }, { paymentRequest: { is: { status: 'PENDING' } } }]
  };
  if (req.user.role === USER_ROLES.RESIDENT) {
    where.userId = req.user.id;
  }
  const [bills, revertedPayments] = await Promise.all([
    prisma.maintenanceBill.findMany({
      where,
      include: billInclude,
      orderBy: [{ month: 'desc' }, { resident: { apartment: 'asc' } }]
    }),
    prisma.maintenancePayment.findMany({
      where: {
        societyId: req.societyId,
        status: 'REVERTED',
        ...(req.user.role === USER_ROLES.RESIDENT ? { userId: req.user.id } : {})
      },
      orderBy: [{ revertedAt: 'desc' }, { createdAt: 'desc' }]
    })
  ]);
  res.json({
    bills: bills.map(serializeBill),
    revertedPayments: revertedPayments.map((payment) => ({
      id: payment.id,
      userId: payment.userId,
      month: payment.month,
      amount: Number(payment.amount),
      method: methodToUi[payment.method],
      reference: payment.reference || undefined,
      receiptNo: payment.receiptNo,
      paidAt: payment.paidAt.toISOString(),
      revertedAt: payment.revertedAt?.toISOString()
    })),
    currentYear: new Date().getFullYear()
  });
}

export async function getBill(req, res) {
  const bill = await prisma.maintenanceBill.findFirst({
    where: {
      id: parseId(req.params.billId, 'bill id'),
      societyId: req.societyId,
      ...(req.user.role === USER_ROLES.RESIDENT ? { userId: req.user.id } : {})
    },
    include: billInclude
  });
  if (!bill) throw new AppError(404, 'The maintenance bill could not be found.', 'BILL_NOT_FOUND');
  res.json({ bill: serializeBill(bill) });
}

export async function setMaintenanceSchedule(req, res) {
  const { month, amount, applyPermanently } = req.body;
  assertCurrentYear(month);

  const result = await prisma.$transaction(async (tx) => {
    const residents = await tx.user.findMany({
      where: { societyId: req.societyId, role: 'RESIDENT' },
      select: { id: true }
    });
    if (!residents.length) throw new AppError(409, 'Create resident accounts before setting maintenance.', 'NO_RESIDENTS');

    const lastMonth = applyPermanently ? `${new Date().getFullYear()}-12` : month;
    const months = [];
    for (let cursor = month; cursor <= lastMonth; ) {
      months.push(cursor);
      const nextDate = new Date(`${cursor}-01T00:00:00.000Z`);
      nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
      cursor = nextDate.toISOString().slice(0, 7);
    }

    const targetBills = await tx.maintenanceBill.findMany({
      where: { societyId: req.societyId, userId: { in: residents.map((resident) => resident.id) }, month: { in: months } },
      include: { paymentRequest: true }
    });
    const lockedBill = targetBills.find(
      (bill) =>
        Number(bill.amount) !== amount &&
        (bill.status === 'PAID' || bill.paymentRequest?.status === 'PENDING')
    );
    if (lockedBill) {
      const person = await tx.user.findUnique({
        where: { id: lockedBill.userId },
        select: { name: true, apartment: true }
      });
      throw new AppError(
        409,
        `Maintenance for ${person.apartment || person.name} in ${lockedBill.month} is already paid or has a payment request and cannot be changed.`,
        'BILL_LOCKED'
      );
    }

    await tx.society.update({
      where: { id: req.societyId },
      data: applyPermanently
        ? {
            maintenanceAmount: amount,
            maintenanceEffectiveFrom: month,
            maintenanceOverrides: { deleteMany: { month: { gte: month } } }
          }
        : {
            maintenanceOverrides: {
              upsert: {
                where: { societyId_month: { societyId: req.societyId, month } },
                create: { month, amount },
                update: { amount }
              }
            }
          }
    });

    await writeAudit(tx, {
      societyId: req.societyId,
      actorId: req.user.id,
      action: applyPermanently ? 'maintenance.permanent_rate_set' : 'maintenance.monthly_rate_set',
      entityType: 'Society',
      entityId: req.societyId,
      metadata: { month, amount, applyPermanently }
    });
    return tx.maintenanceBill.findMany({
      where: { societyId: req.societyId, month },
      include: billInclude,
      orderBy: [{ resident: { apartment: 'asc' } }]
    });
  }, { isolationLevel: 'Serializable' });

  res.json({ month, amount, applyPermanently, bills: result.map(serializeBill) });
}

async function getOrCreateUnpaidBill(tx, societyId, resident, month, amount) {
  let bill = await tx.maintenanceBill.findUnique({
    where: { societyId_userId_month: { societyId, userId: resident.id, month } },
    include: { paymentRequest: true }
  });

  if (bill?.status === 'PAID') throw new AppError(409, 'This maintenance month is already paid.', 'BILL_ALREADY_PAID');
  if (bill?.paymentRequest?.status === 'PENDING')
    throw new AppError(409, 'A payment request for this month is already awaiting review.', 'REQUEST_PENDING');

  if (!bill) {
    bill = await tx.maintenanceBill.create({
      data: { societyId, userId: resident.id, month, amount, dueDate: dueDateFor(month) },
      include: { paymentRequest: true }
    });
  } else {
    bill = await tx.maintenanceBill.update({
      where: { id: bill.id },
      data: { amount, dueDate: dueDateFor(month) },
      include: { paymentRequest: true }
    });
  }
  return bill;
}

export async function submitPaymentRequest(req, res) {
  const { month } = req.body;
  const method = req.body.method;
  if (new Date(`${req.body.paymentDate}T00:00:00.000Z`) > new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`))
    throw new AppError(400, 'Payment date cannot be in the future.', 'INVALID_PAYMENT_DATE');
  if (method !== 'Cash' && !req.body.reference)
    throw new AppError(400, `Enter the transaction or instrument details for ${method}.`, 'PAYMENT_REFERENCE_REQUIRED');

  const savedRequest = await prisma.$transaction(async (tx) => {
    const { resident, amount } = await getResidentMonth(tx, req.societyId, req.user.id, month);
    const bill = await getOrCreateUnpaidBill(tx, req.societyId, resident, month, amount);

    const data = {
      method: methodToDb[method],
      paymentDate: new Date(`${req.body.paymentDate}T00:00:00.000Z`),
      reference: req.body.reference,
      notes: req.body.notes,
      status: 'PENDING',
      submittedById: req.user.id,
      submittedAt: new Date(),
      reviewedById: null,
      reviewedAt: null
    };
    return tx.paymentRequest.upsert({
      where: { billId: bill.id },
      create: { billId: bill.id, ...data },
      update: data
    });
  }, { isolationLevel: 'Serializable' });

  res.status(201).json({
    paymentRequest: {
      method,
      paymentDate: req.body.paymentDate,
      reference: savedRequest.reference,
      notes: savedRequest.notes,
      submittedAt: savedRequest.submittedAt.toISOString(),
      submittedBy: req.user.id
    }
  });
}

export async function markGeneratedBillPaid(req, res) {
  const { userId, month, ...details } = req.body;
  const result = await prisma.$transaction(async (tx) => {
    const { resident, amount } = await getResidentMonth(tx, req.societyId, userId, month);
    const bill = await getOrCreateUnpaidBill(tx, req.societyId, resident, month, amount);
    const paid = await recordBillPayment(tx, bill, details, req.user);
    await writeAudit(tx, {
      societyId: req.societyId,
      actorId: req.user.id,
      action: 'maintenance.payment_recorded',
      entityType: 'MaintenanceBill',
      entityId: bill.id,
      metadata: { amount: Number(bill.amount), method: details.method, receiptNo: paid.receiptNo }
    });
    return tx.maintenanceBill.findUnique({ where: { id: bill.id }, include: billInclude });
  }, { isolationLevel: 'Serializable' });
  res.json({ bill: serializeBill(result) });
}

export async function markBillPaid(req, res) {
  const billId = parseId(req.params.billId, 'bill id');
  const result = await prisma.$transaction(async (tx) => {
    const bill = await tx.maintenanceBill.findFirst({
      where: { id: billId, societyId: req.societyId },
      include: { paymentRequest: true }
    });
    if (!bill) throw new AppError(404, 'The maintenance bill could not be found.', 'BILL_NOT_FOUND');
    const paid = await recordBillPayment(tx, bill, req.body, req.user);
    await writeAudit(tx, {
      societyId: req.societyId,
      actorId: req.user.id,
      action: 'maintenance.payment_recorded',
      entityType: 'MaintenanceBill',
      entityId: bill.id,
      metadata: { amount: Number(bill.amount), method: req.body.method, receiptNo: paid.receiptNo }
    });
    return tx.maintenanceBill.findUnique({ where: { id: bill.id }, include: billInclude });
  }, { isolationLevel: 'Serializable' });
  res.json({ bill: serializeBill(result) });
}

export async function acceptPaymentRequest(req, res) {
  const billId = parseId(req.params.billId, 'bill id');
  const result = await prisma.$transaction(async (tx) => {
    const bill = await tx.maintenanceBill.findFirst({
      where: { id: billId, societyId: req.societyId },
      include: { paymentRequest: true }
    });
    if (!bill || bill.status !== 'PENDING' || bill.paymentRequest?.status !== 'PENDING')
      throw new AppError(409, 'There is no pending payment request for this bill.', 'REQUEST_NOT_PENDING');
    const request = bill.paymentRequest;
    const payment = await recordBillPayment(
      tx,
      bill,
      {
        method: methodToUi[request.method],
        paymentDate: request.paymentDate.toISOString().slice(0, 10),
        reference: request.reference,
        notes: request.notes
      },
      req.user,
      { fromRequest: true }
    );
    await writeAudit(tx, {
      societyId: req.societyId,
      actorId: req.user.id,
      action: 'maintenance.payment_request_accepted',
      entityType: 'MaintenanceBill',
      entityId: bill.id,
      metadata: { amount: Number(bill.amount), receiptNo: payment.receiptNo }
    });
    return tx.maintenanceBill.findUnique({ where: { id: bill.id }, include: billInclude });
  }, { isolationLevel: 'Serializable' });
  res.json({ bill: serializeBill(result) });
}

export async function revertBillPayment(req, res) {
  const billId = parseId(req.params.billId, 'bill id');
  await prisma.$transaction(async (tx) => {
    const bill = await tx.maintenanceBill.findFirst({ where: { id: billId, societyId: req.societyId } });
    if (!bill || bill.status !== 'PAID') throw new AppError(409, 'Only accepted payments can be reverted.', 'PAYMENT_NOT_REVERTIBLE');
    const currentPayment = await tx.maintenancePayment.findFirst({
      where: { billId, status: 'RECORDED' },
      orderBy: { createdAt: 'desc' }
    });
    if (currentPayment) {
      await tx.maintenancePayment.update({
        where: { id: currentPayment.id },
        data: { status: 'REVERTED', revertedAt: new Date(), billId: null }
      });
    }
    await tx.maintenanceBill.delete({ where: { id: billId } });
    await writeAudit(tx, {
      societyId: req.societyId,
      actorId: req.user.id,
      action: 'maintenance.payment_reverted',
      entityType: 'MaintenanceBill',
      entityId: billId,
      metadata: {
        receiptNo: bill.receiptNo,
        amount: Number(bill.amount),
        month: bill.month,
        payment: currentPayment
          ? {
              method: currentPayment.method,
              reference: currentPayment.reference,
              notes: currentPayment.notes,
              paidAt: currentPayment.paidAt.toISOString()
            }
          : null
      }
    });
  }, { isolationLevel: 'Serializable' });
  res.json({ reverted: true });
}

export async function listBillPayments(req, res) {
  const billId = parseId(req.params.billId, 'bill id');
  const bill = await prisma.maintenanceBill.findFirst({
    where: {
      id: billId,
      societyId: req.societyId,
      ...(req.user.role === USER_ROLES.RESIDENT ? { userId: req.user.id } : {})
    }
  });
  if (!bill) throw new AppError(404, 'The maintenance bill could not be found.', 'BILL_NOT_FOUND');
  const payments = await prisma.maintenancePayment.findMany({
    where: { billId },
    orderBy: { createdAt: 'desc' }
  });
  res.json({
    payments: payments.map((payment) => ({
      ...payment,
      amount: Number(payment.amount),
      method: methodToUi[payment.method],
      paidAt: payment.paidAt.toISOString(),
      revertedAt: payment.revertedAt?.toISOString()
    }))
  });
}
