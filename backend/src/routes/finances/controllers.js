import { prisma } from '../../db.js';
import { writeAudit } from '../../lib/audit.js';
import { FINANCIAL_TRANSACTION_TYPES, USER_ROLES } from '../../lib/constants.js';
import { AppError, parseId } from '../../lib/http.js';
import { serializeTransaction } from '../../lib/serializers.js';

const amountOf = (amount) => Number(amount);

async function assertVisible(req) {
  if (req.user.role !== USER_ROLES.RESIDENT) return;
  const society = await prisma.society.findUnique({
    where: { id: req.societyId },
    select: { expensesVisibleToResidents: true }
  });
  if (!society?.expensesVisibleToResidents)
    throw new AppError(403, 'The society committee has not made financial transaction details visible.', 'FINANCE_DETAILS_HIDDEN');
}

async function getFundBalance(tx, societyId) {
  const [payments, transactions] = await Promise.all([
    tx.maintenancePayment.aggregate({
      where: { status: 'RECORDED', societyId },
      _sum: { amount: true }
    }),
    tx.financialTransaction.findMany({ where: { societyId }, select: { type: true, amount: true } })
  ]);
  return transactions.reduce(
    (total, transaction) =>
      total + (transaction.type === FINANCIAL_TRANSACTION_TYPES.INCOME ? amountOf(transaction.amount) : -amountOf(transaction.amount)),
    amountOf(payments._sum.amount || 0)
  );
}

function monthParam(value) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value))
    throw new AppError(400, 'Choose a month in YYYY-MM format.', 'INVALID_MONTH');
  return value;
}

export async function getBalance(req, res) {
  const availableFund = await getFundBalance(prisma, req.societyId);
  res.json({ availableFund, currency: 'INR' });
}

export async function getMonthlySummary(req, res) {
  await assertVisible(req);
  const year = req.query.year === undefined ? new Date().getFullYear() : Number(req.query.year);
  if (!Number.isInteger(year) || year < 2000 || year > 9999)
    throw new AppError(400, 'Choose a valid year.', 'INVALID_YEAR');
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const [payments, transactions] = await Promise.all([
    prisma.maintenancePayment.findMany({
      where: { status: 'RECORDED', societyId: req.societyId, paidAt: { gte: start, lt: end } },
      select: { amount: true, paidAt: true }
    }),
    prisma.financialTransaction.findMany({
      where: { societyId: req.societyId, date: { gte: start, lt: end } },
      select: { type: true, amount: true, date: true }
    })
  ]);
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, '0')}`;
    const maintenanceIncome = payments
      .filter((payment) => payment.paidAt.toISOString().slice(0, 7) === month)
      .reduce((sum, payment) => sum + amountOf(payment.amount), 0);
    const monthTransactions = transactions.filter((transaction) => transaction.date.toISOString().slice(0, 7) === month);
    return {
      month,
      maintenanceIncome,
      otherIncome: monthTransactions
        .filter((transaction) => transaction.type === 'INCOME')
        .reduce((sum, transaction) => sum + amountOf(transaction.amount), 0),
      expenses: monthTransactions
        .filter((transaction) => transaction.type === 'EXPENSE')
        .reduce((sum, transaction) => sum + amountOf(transaction.amount), 0)
    };
  });
  res.json({
    year,
    totals: months.reduce(
      (sum, month) => ({
        maintenanceIncome: sum.maintenanceIncome + month.maintenanceIncome,
        otherIncome: sum.otherIncome + month.otherIncome,
        expenses: sum.expenses + month.expenses
      }),
      { maintenanceIncome: 0, otherIncome: 0, expenses: 0 }
    ),
    months
  });
}

export async function getStatement(req, res) {
  await assertVisible(req);
  const month = monthParam(req.query.month);
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const [yearText, monthText] = month.split('-');
  const end = new Date(Date.UTC(Number(yearText), Number(monthText), 1));
  const [priorPayments, priorTransactions, payments, transactions] = await Promise.all([
    prisma.maintenancePayment.aggregate({
      where: { status: 'RECORDED', societyId: req.societyId, paidAt: { lt: start } },
      _sum: { amount: true }
    }),
    prisma.financialTransaction.findMany({
      where: { societyId: req.societyId, date: { lt: start } },
      select: { type: true, amount: true }
    }),
    prisma.maintenancePayment.findMany({
      where: { status: 'RECORDED', societyId: req.societyId, paidAt: { gte: start, lt: end } },
      select: { amount: true }
    }),
    prisma.financialTransaction.findMany({
      where: { societyId: req.societyId, date: { gte: start, lt: end } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }]
    })
  ]);
  const openingBalance = priorTransactions.reduce(
    (sum, transaction) =>
      sum + (transaction.type === 'INCOME' ? amountOf(transaction.amount) : -amountOf(transaction.amount)),
    amountOf(priorPayments._sum.amount || 0)
  );
  const maintenanceIncome = payments.reduce((sum, payment) => sum + amountOf(payment.amount), 0);
  let balance = openingBalance + maintenanceIncome;
  const rows = [
    {
      id: `maintenance-${month}`,
      date: month,
      title: `Maintenance received (${payments.length} payments)`,
      type: 'maintenance',
      credit: maintenanceIncome,
      debit: 0,
      balance
    },
    ...transactions.map((transaction) => {
      const isIncome = transaction.type === 'INCOME';
      const amount = amountOf(transaction.amount);
      balance += isIncome ? amount : -amount;
      return {
        ...serializeTransaction(transaction),
        type: transaction.type.toLowerCase(),
        credit: isIncome ? amount : 0,
        debit: isIncome ? 0 : amount,
        balance
      };
    })
  ];
  res.json({ month, openingBalance, closingBalance: balance, rows });
}

export async function listTransactions(req, res) {
  await assertVisible(req);
  const where = { societyId: req.societyId };
  if (req.query.month) {
    const month = monthParam(req.query.month);
    const [year, monthNumber] = month.split('-').map(Number);
    where.date = {
      gte: new Date(Date.UTC(year, monthNumber - 1, 1)),
      lt: new Date(Date.UTC(year, monthNumber, 1))
    };
  }
  const transactions = await prisma.financialTransaction.findMany({
    where,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
  });
  res.json({ transactions: transactions.map(serializeTransaction) });
}

export async function getTransaction(req, res) {
  await assertVisible(req);
  const transaction = await prisma.financialTransaction.findFirst({
    where: { id: parseId(req.params.transactionId, 'transaction id'), societyId: req.societyId }
  });
  if (!transaction) throw new AppError(404, 'The financial transaction could not be found.', 'TRANSACTION_NOT_FOUND');
  res.json({ transaction: serializeTransaction(transaction) });
}

export async function createTransaction(req, res) {
  const transaction = await prisma.$transaction(async (tx) => {
    const created = await tx.financialTransaction.create({
      data: {
        societyId: req.societyId,
        type: req.body.type.toUpperCase(),
        title: req.body.title,
        amount: req.body.amount,
        date: new Date(`${req.body.date}T00:00:00.000Z`),
        notes: req.body.notes,
        createdById: req.user.id,
        updatedById: req.user.id
      }
    });
    await writeAudit(tx, {
      societyId: req.societyId,
      actorId: req.user.id,
      action: 'finance.transaction_created',
      entityType: 'FinancialTransaction',
      entityId: created.id,
      metadata: { type: created.type, amount: amountOf(created.amount) }
    });
    return created;
  });
  res.status(201).json({ transaction: serializeTransaction(transaction) });
}

export async function updateTransaction(req, res) {
  const transactionId = parseId(req.params.transactionId, 'transaction id');
  const transaction = await prisma.$transaction(async (tx) => {
    const existing = await tx.financialTransaction.findFirst({ where: { id: transactionId, societyId: req.societyId } });
    if (!existing) throw new AppError(404, 'The financial transaction could not be found.', 'TRANSACTION_NOT_FOUND');
    const updated = await tx.financialTransaction.update({
      where: { id: transactionId },
      data: {
        type: req.body.type.toUpperCase(),
        title: req.body.title,
        amount: req.body.amount,
        date: new Date(`${req.body.date}T00:00:00.000Z`),
        notes: req.body.notes,
        updatedById: req.user.id
      }
    });
    await writeAudit(tx, {
      societyId: req.societyId,
      actorId: req.user.id,
      action: 'finance.transaction_updated',
      entityType: 'FinancialTransaction',
      entityId: transactionId,
      metadata: { type: updated.type, amount: amountOf(updated.amount) }
    });
    return updated;
  });
  res.json({ transaction: serializeTransaction(transaction) });
}

export async function deleteTransaction(req, res) {
  const transactionId = parseId(req.params.transactionId, 'transaction id');
  await prisma.$transaction(async (tx) => {
    const existing = await tx.financialTransaction.findFirst({ where: { id: transactionId, societyId: req.societyId } });
    if (!existing) throw new AppError(404, 'The financial transaction could not be found.', 'TRANSACTION_NOT_FOUND');
    await tx.financialTransaction.delete({ where: { id: transactionId } });
    await writeAudit(tx, {
      societyId: req.societyId,
      actorId: req.user.id,
      action: 'finance.transaction_deleted',
      entityType: 'FinancialTransaction',
      entityId: transactionId,
      metadata: { type: existing.type, amount: amountOf(existing.amount) }
    });
  });
  res.status(204).end();
}
