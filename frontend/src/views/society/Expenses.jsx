import { useMemo, useState } from 'react';

import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableFooter from '@mui/material/TableFooter';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  ADMIN_ROLES,
  FINANCIAL_TRANSACTION_TYPES,
  FINANCIAL_TRANSACTION_TYPE_LABELS
} from 'common/constants';
import { useSociety } from 'contexts/SocietyContext';
import MainCard from 'ui-component/cards/MainCard';
import ResponsiveTable from 'ui-component/ResponsiveTable';

const today = new Date().toISOString().slice(0, 10);
const emptyTransaction = { type: FINANCIAL_TRANSACTION_TYPES.EXPENSE, title: '', amount: '', date: today, notes: '' };
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const monthLabel = (month) => new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const dateLabel = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN');
const transactionType = (transaction) => transaction.type || FINANCIAL_TRANSACTION_TYPES.EXPENSE;
const paymentMonth = (bill) => bill.paidAt?.slice(0, 7) || bill.month;

export default function Expenses() {
  const {
    currentUser,
    currentSociety,
    currentYear,
    bills,
    expenses,
    availableFund,
    addExpense,
    updateExpense,
    setExpensesVisibleToResidents
  } = useSociety();
  const isAdmin = ADMIN_ROLES.includes(currentUser.role);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statementMonth, setStatementMonth] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [form, setForm] = useState(emptyTransaction);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const monthlySummaries = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const month = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
        const maintenanceIncome = bills
          .filter((bill) => bill.status === 'paid' && paymentMonth(bill) === month)
          .reduce((total, bill) => total + Number(bill.amount), 0);
        const monthTransactions = expenses.filter((transaction) => transaction.date.startsWith(month));
        const otherIncome = monthTransactions
          .filter((transaction) => transactionType(transaction) === FINANCIAL_TRANSACTION_TYPES.INCOME)
          .reduce((total, transaction) => total + Number(transaction.amount), 0);
        const expenseTotal = monthTransactions
          .filter((transaction) => transactionType(transaction) === FINANCIAL_TRANSACTION_TYPES.EXPENSE)
          .reduce((total, transaction) => total + Number(transaction.amount), 0);

        return { month, maintenanceIncome, otherIncome, expenseTotal };
      }),
    [bills, currentYear, expenses]
  );
  const yearTotals = useMemo(
    () =>
      monthlySummaries.reduce(
        (totals, summary) => ({
          maintenanceIncome: totals.maintenanceIncome + summary.maintenanceIncome,
          otherIncome: totals.otherIncome + summary.otherIncome,
          expenseTotal: totals.expenseTotal + summary.expenseTotal
        }),
        { maintenanceIncome: 0, otherIncome: 0, expenseTotal: 0 }
      ),
    [monthlySummaries]
  );
  const statement = useMemo(() => {
    if (!statementMonth) return null;

    const paidBills = bills.filter((bill) => bill.status === 'paid');
    const earlierTransactions = expenses.filter((transaction) => transaction.date.slice(0, 7) < statementMonth);
    const openingBalance =
      paidBills
        .filter((bill) => paymentMonth(bill) < statementMonth)
        .reduce((total, bill) => total + Number(bill.amount), 0) +
      earlierTransactions.reduce(
        (total, transaction) =>
          total +
          (transactionType(transaction) === FINANCIAL_TRANSACTION_TYPES.INCOME
            ? Number(transaction.amount)
            : -Number(transaction.amount)),
        0
      );
    const maintenanceIncome = paidBills
      .filter((bill) => paymentMonth(bill) === statementMonth)
      .reduce((total, bill) => total + Number(bill.amount), 0);
    const otherTransactions = expenses
      .filter((transaction) => transaction.date.startsWith(statementMonth))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''));
    let balance = openingBalance + maintenanceIncome;
    const rows = [
      {
        id: 'maintenance-income',
        date: `${statementMonth}-01`,
        dateText: Number(statementMonth.slice(5, 7)) === new Date().getMonth() + 1 &&
          Number(statementMonth.slice(0, 4)) === new Date().getFullYear()
          ? 'Month to date'
          : 'Month total',
        title: `Maintenance received (${paidBills.filter((bill) => paymentMonth(bill) === statementMonth).length} payments)`,
        credit: maintenanceIncome,
        debit: 0,
        balance
      },
      ...otherTransactions.map((transaction) => {
        const isIncome = transactionType(transaction) === FINANCIAL_TRANSACTION_TYPES.INCOME;
        balance += isIncome ? Number(transaction.amount) : -Number(transaction.amount);
        return {
          id: transaction.id,
          date: transaction.date,
          dateText: dateLabel(transaction.date),
          title: transaction.title,
          details: transaction.notes,
          credit: isIncome ? Number(transaction.amount) : 0,
          debit: isIncome ? 0 : Number(transaction.amount),
          balance
        };
      })
    ];

    return { openingBalance, closingBalance: balance, rows };
  }, [bills, expenses, statementMonth]);

  const openCreate = () => {
    setEditingTransaction(null);
    setForm({ ...emptyTransaction, date: new Date().toISOString().slice(0, 10) });
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (transaction) => {
    setEditingTransaction(transaction);
    setForm({
      type: transactionType(transaction),
      title: transaction.title,
      amount: String(transaction.amount),
      date: transaction.date,
      notes: transaction.notes || ''
    });
    setError('');
    setDialogOpen(true);
  };

  const handleVisibilityChange = async (event) => {
    const visible = event.target.checked;
    setError('');
    setSuccess('');
    try {
      await setExpensesVisibleToResidents(visible, currentUser);
      setSuccess(
        visible
          ? 'All society financial transactions are now visible to residents.'
          : 'Society financial transactions are now hidden from residents.'
      );
    } catch (visibilityError) {
      setError(visibilityError.message);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    try {
      if (editingTransaction) await updateExpense(editingTransaction.id, { ...form, amount }, currentUser);
      else await addExpense({ ...form, amount }, currentUser);
      setSuccess(`${FINANCIAL_TRANSACTION_TYPE_LABELS[form.type]} ${editingTransaction ? 'updated' : 'recorded'}.`);
      setDialogOpen(false);
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <div>
          <Typography variant="h2">Society finances</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            {isAdmin
              ? 'Track maintenance collections, other income, and society expenses.'
              : 'Review the available society fund and financial transactions shared by the committee.'}
          </Typography>
        </div>
        {isAdmin && <Button variant="contained" onClick={openCreate}>Add transaction</Button>}
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Grid container spacing={2.5}>
        {isAdmin && (
          <>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MainCard title="Maintenance income · Current year">
                <Typography variant="h3">{currency.format(yearTotals.maintenanceIncome)}</Typography>
              </MainCard>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MainCard title="Other income · Current year">
                <Typography variant="h3">{currency.format(yearTotals.otherIncome)}</Typography>
              </MainCard>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <MainCard title="Expenses · Current year">
                <Typography variant="h3">{currency.format(yearTotals.expenseTotal)}</Typography>
              </MainCard>
            </Grid>
          </>
        )}
        <Grid size={{ xs: 12, sm: 6, md: isAdmin ? 3 : 12 }}>
          <MainCard title="Available fund">
            <Typography variant="h3" color={availableFund < 0 ? 'error.main' : 'success.dark'}>
              {currency.format(availableFund)}
            </Typography>
            <Typography variant="caption" color="text.secondary">Maintenance and other income minus expenses</Typography>
          </MainCard>
        </Grid>
      </Grid>

      {isAdmin ? (
        <MainCard title="Resident visibility">
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(currentSociety.expensesVisibleToResidents)}
                onChange={(event) => void handleVisibilityChange(event)}
              />
            }
            label="Show financial transaction details to residents"
          />
          <Typography display="block" variant="caption" color="text.secondary">
            This single setting controls visibility of other income and expense details. Residents cannot add or edit transactions.
          </Typography>
        </MainCard>
      ) : (
        !currentSociety.expensesVisibleToResidents && (
          <Alert severity="info">The society committee has not made financial transaction details visible to residents.</Alert>
        )
      )}

      {(isAdmin || currentSociety.expensesVisibleToResidents) && (
        <MainCard title={`Monthly statement · ${currentYear}`}>
          <ResponsiveTable minWidth={650}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Month</TableCell>
                  <TableCell align="right">Maintenance income</TableCell>
                  <TableCell align="right">Other income</TableCell>
                  <TableCell align="right">Expenses</TableCell>
                  <TableCell align="center">Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monthlySummaries.map((summary) => (
                  <TableRow key={summary.month} hover>
                    <TableCell>{monthLabel(summary.month)}</TableCell>
                    <TableCell align="right">{currency.format(summary.maintenanceIncome)}</TableCell>
                    <TableCell align="right">{currency.format(summary.otherIncome)}</TableCell>
                    <TableCell align="right">{currency.format(summary.expenseTotal)}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        aria-label={`View ${monthLabel(summary.month)} transaction details`}
                        title={`View ${monthLabel(summary.month)} transactions`}
                        onClick={() => setStatementMonth(summary.month)}
                        size="small"
                      >
                        <VisibilityOutlined fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell><strong>Year total</strong></TableCell>
                  <TableCell align="right"><strong>{currency.format(yearTotals.maintenanceIncome)}</strong></TableCell>
                  <TableCell align="right"><strong>{currency.format(yearTotals.otherIncome)}</strong></TableCell>
                  <TableCell align="right"><strong>{currency.format(yearTotals.expenseTotal)}</strong></TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </ResponsiveTable>
        </MainCard>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={handleSave}>
          <DialogTitle>{editingTransaction ? 'Update transaction' : 'Add financial transaction'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                select
                label="Transaction type"
                required
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value })}
              >
                {Object.values(FINANCIAL_TRANSACTION_TYPES).map((type) => (
                  <MenuItem key={type} value={type}>{FINANCIAL_TRANSACTION_TYPE_LABELS[type]}</MenuItem>
                ))}
              </TextField>
              <TextField
                label={form.type === FINANCIAL_TRANSACTION_TYPES.INCOME ? 'Income source' : 'Expense title'}
                required
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
              <TextField
                label="Amount (INR)"
                type="number"
                required
                inputProps={{ min: 1, step: 1 }}
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
              />
              <TextField
                label="Date"
                type="date"
                required
                slotProps={{ inputLabel: { shrink: true } }}
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
              <TextField
                label="Details"
                multiline
                minRows={2}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
              <Typography variant="caption" color="text.secondary">
                Transaction details follow the society-wide visibility setting. Only admins can add or edit records.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              {editingTransaction ? 'Save changes' : 'Add transaction'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={Boolean(statementMonth)} onClose={() => setStatementMonth(null)} fullWidth maxWidth="md">
        <DialogTitle>Bank statement · {statementMonth && monthLabel(statementMonth)}</DialogTitle>
        <DialogContent>
          {statement && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">Opening balance</Typography>
                  <Typography variant="h4">{currency.format(statement.openingBalance)}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">Closing balance</Typography>
                  <Typography variant="h4" color={statement.closingBalance < 0 ? 'error.main' : 'success.dark'}>
                    {currency.format(statement.closingBalance)}
                  </Typography>
                </Grid>
              </Grid>
              <ResponsiveTable minWidth={700}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Transaction</TableCell>
                      <TableCell align="right">Credit</TableCell>
                      <TableCell align="right">Debit</TableCell>
                      <TableCell align="right">Balance</TableCell>
                      {isAdmin && <TableCell align="right">Action</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {statement.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.dateText}</TableCell>
                        <TableCell>
                          <Typography variant="body2">{row.title}</Typography>
                          {row.details && <Typography variant="caption" color="text.secondary">{row.details}</Typography>}
                        </TableCell>
                        <TableCell align="right">{row.credit ? currency.format(row.credit) : '—'}</TableCell>
                        <TableCell align="right">{row.debit ? currency.format(row.debit) : '—'}</TableCell>
                        <TableCell align="right">{currency.format(row.balance)}</TableCell>
                        {isAdmin && (
                          <TableCell align="right">
                            {row.id !== 'maintenance-income' && (
                              <Button
                                size="small"
                                onClick={() => {
                                  const transaction = expenses.find((item) => item.id === row.id);
                                  setStatementMonth(null);
                                  if (transaction) openEdit(transaction);
                                }}
                              >
                                Edit
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {!expenses.some((transaction) => transaction.date.startsWith(statementMonth)) &&
                      !bills.some((bill) => bill.status === 'paid' && paymentMonth(bill) === statementMonth) && (
                        <TableRow>
                          <TableCell colSpan={isAdmin ? 6 : 5} align="center">No transactions recorded for this month.</TableCell>
                        </TableRow>
                      )}
                  </TableBody>
                </Table>
              </ResponsiveTable>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStatementMonth(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
