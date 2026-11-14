import { prisma } from '../../db.js';
import { writeAudit } from '../../lib/audit.js';
import { USER_ROLES } from '../../lib/constants.js';
import { AppError, parseId } from '../../lib/http.js';
import { serializeBill } from '../../lib/serializers.js';
import { assertCurrentYear, ensureAnnualBills, recordBillPayment } from '../../services/billing.js';

const methodToDb = { Cash: 'CASH', UPI: 'UPI', Card: 'CARD', Cheque: 'CHEQUE', NEFT: 'NEFT', RTGS: 'RTGS', Other: 'OTHER' };
const methodToUi = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', CHEQUE: 'Cheque', NEFT: 'NEFT', RTGS: 'RTGS', OTHER: 'Other' };
const billInclude = {
  paymentRequest: true,
  resident: { select: { id: true, name: true, email: true, apartment: true, phone: true } }
};

export async function listBills(req, res) {
  const requestedYear =
    req.user.role === USER_ROLES.RESIDENT
      ? new Date().getFullYear()
      : req.query.year === undefined
        ? new Date().getFullYear()
        : Number(req.query.year);
  if (!Number.isInteger(requestedYear) || requestedYear < 2000 || requestedYear > 9999)
    throw new AppError(400, 'Choose a valid bill year.', 'INVALID_YEAR');
  if (requestedYear !== new Date().getFullYear())
    throw new AppError(400, `Only maintenance bills for ${new Date().getFullYear()} are open in this view.`, 'YEAR_OUT_OF_RANGE');

  await prisma.$transaction((tx) => ensureAnnualBills(tx, req.societyId, requestedYear));
  const where = { societyId: req.societyId };
  if (req.user.role === USER_ROLES.RESIDENT) {
    where.userId = req.user.id;
    where.OR = [{ month: { startsWith: `${new Date().getFullYear()}-` } }, { status: 'PAID' }];
  } else {
    where.month = { startsWith: `${requestedYear}-` };
  }
  const bills = await prisma.maintenanceBill.findMany({
    where,
    include: billInclude,
    orderBy: [{ month: 'desc' }, { resident: { apartment: 'asc' } }]
  });
  res.json({ bills: bills.map(serializeBill), currentYear: new Date().getFullYear() });
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

    const selectedMonthBills = await tx.maintenanceBill.findMany({
      where: { societyId: req.societyId, userId: { in: residents.map((resident) => resident.id) }, month },
      include: { paymentRequest: true }
    });
    const lockedSelectedBill = selectedMonthBills.find(
      (bill) =>
        Number(bill.amount) !== amount &&
        (bill.status === 'PAID' || bill.paymentRequest?.status === 'PENDING')
    );
    if (lockedSelectedBill) {
      const person = await tx.user.findUnique({
        where: { id: lockedSelectedBill.userId },
        select: { name: true, apartment: true }
      });
      throw new AppError(
        409,
        `Maintenance for ${person.apartment || person.name} in ${month} is already paid or has a payment request and cannot be changed.`,
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
    for (const bill of targetBills) {
      if (bill.status === 'PENDING' && bill.paymentRequest?.status !== 'PENDING') {
        await tx.maintenanceBill.update({
          where: { id: bill.id },
          data: { amount, dueDate: new Date(`${bill.month}-10T00:00:00.000Z`) }
        });
      }
    }
    await ensureAnnualBills(tx, req.societyId, new Date().getFullYear());
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

export async function submitPaymentRequest(req, res) {
  const billId = parseId(req.params.billId, 'bill id');
  const method = req.body.method;
  if (new Date(`${req.body.paymentDate}T00:00:00.000Z`) > new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`))
    throw new AppError(400, 'Payment date cannot be in the future.', 'INVALID_PAYMENT_DATE');
  if (method !== 'Cash' && !req.body.reference)
    throw new AppError(400, `Enter the transaction or instrument details for ${method}.`, 'PAYMENT_REFERENCE_REQUIRED');

  const savedRequest = await prisma.$transaction(async (tx) => {
    const bill = await tx.maintenanceBill.findFirst({
      where: { id: billId, societyId: req.societyId, userId: req.user.id },
      include: { paymentRequest: true }
    });
    if (!bill) throw new AppError(404, 'This maintenance bill does not belong to your account.', 'BILL_NOT_FOUND');
    if (!bill.month.startsWith(`${new Date().getFullYear()}-`))
      throw new AppError(400, `Payment requests are only open for ${new Date().getFullYear()}.`, 'YEAR_OUT_OF_RANGE');
    if (bill.status !== 'PENDING') throw new AppError(409, 'Only pending bills can have a payment request.', 'BILL_NOT_PENDING');
    if (bill.paymentRequest?.status === 'PENDING')
      throw new AppError(409, 'A payment request for this bill is already awaiting review.', 'REQUEST_PENDING');

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
  const result = await prisma.$transaction(async (tx) => {
    const bill = await tx.maintenanceBill.findFirst({ where: { id: billId, societyId: req.societyId } });
    if (!bill || bill.status !== 'PAID') throw new AppError(409, 'Only accepted payments can be reverted.', 'PAYMENT_NOT_REVERTIBLE');
    const currentPayment = await tx.maintenancePayment.findFirst({
      where: { billId, status: 'RECORDED' },
      orderBy: { createdAt: 'desc' }
    });
    if (currentPayment) {
      await tx.maintenancePayment.update({
        where: { id: currentPayment.id },
        data: { status: 'REVERTED', revertedAt: new Date() }
      });
    }
    await tx.maintenanceBill.update({
      where: { id: billId },
      data: {
        status: 'PENDING',
        paidAt: null,
        paymentMethod: null,
        paymentReference: '',
        paymentNotes: '',
        paymentAcceptedById: null,
        paymentAcceptedByName: '',
        paymentRecordedAt: null,
        receiptNo: null
      }
    });
    await writeAudit(tx, {
      societyId: req.societyId,
      actorId: req.user.id,
      action: 'maintenance.payment_reverted',
      entityType: 'MaintenanceBill',
      entityId: billId,
      metadata: { receiptNo: bill.receiptNo, amount: Number(bill.amount) }
    });
    return tx.maintenanceBill.findUnique({ where: { id: billId }, include: billInclude });
  }, { isolationLevel: 'Serializable' });
  res.json({ bill: serializeBill(result) });
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
