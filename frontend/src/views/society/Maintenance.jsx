import { useEffect, useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import MainCard from 'ui-component/cards/MainCard';
import ResponsiveTable from 'ui-component/ResponsiveTable';
import RevertedPaymentHistory from './RevertedPaymentHistory';
import { PAYMENT_METHODS, PAYMENT_REFERENCE_LABELS, USER_ROLES } from 'common/constants';
import { useSociety } from 'contexts/SocietyContext';
import { maintenanceAmountForMonth } from 'utils/maintenanceEntries';
import { downloadMaintenanceReceipt } from 'utils/maintenanceReceipt';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const monthLabel = (month) => new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const homeCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const createEmptyPayment = () => ({
  method: 'Cash',
  paymentDate: new Date().toISOString().slice(0, 10),
  reference: '',
  notes: ''
});

export default function Maintenance() {
  const {
    currentUser,
    currentSociety,
    currentYear,
    users,
    bills,
    revertedPayments,
    setMaintenance,
    markBillPaid,
    revertBillPayment,
    acceptPaymentRequest
  } = useSociety();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [amount, setAmount] = useState('');
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [maintenanceScope, setMaintenanceScope] = useState('month');
  const [paymentBill, setPaymentBill] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(createEmptyPayment);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const monthBills = useMemo(
    () =>
      bills
        .filter((bill) => bill.month === `${filterYear}-${filterMonth}`)
        .sort((a, b) => {
          const homeA = users.find((user) => user.id === a.userId)?.apartment || '';
          const homeB = users.find((user) => user.id === b.userId)?.apartment || '';
          return homeCollator.compare(homeA, homeB);
        }),
    [bills, filterMonth, filterYear, users]
  );
  const residents = users.filter((user) => user.role === USER_ROLES.RESIDENT);
  const creationMonth = currentSociety?.createdAt?.slice(0, 7) || `${currentYear}-01`;
  const creationYear = Number(creationMonth.slice(0, 4));
  const currentMonthNumber = new Date().getMonth() + 1;
  const minimumFilterMonth = filterYear === creationYear ? Number(creationMonth.slice(5, 7)) : 1;
  const maximumFilterMonth = filterYear === currentYear ? currentMonthNumber : 12;
  const minimumYear = Math.min(creationYear, 2000);
  const years = Array.from({ length: currentYear - minimumYear + 1 }, (_, index) => currentYear - index);

  const handleFilterYearChange = (event) => {
    const nextYear = Number(event.target.value);
    setFilterYear(nextYear);
    const selectedMonth = Number(filterMonth);
    const minMonth = nextYear === creationYear ? Number(creationMonth.slice(5, 7)) : 1;
    const maxMonth = nextYear === currentYear ? currentMonthNumber : 12;
    if (selectedMonth < minMonth) setFilterMonth(String(minMonth).padStart(2, '0'));
    else if (selectedMonth > maxMonth) setFilterMonth(String(maxMonth).padStart(2, '0'));
  };

  useEffect(() => {
    const scheduledAmount = maintenanceAmountForMonth(currentSociety, month);
    setAmount(monthBills.length ? String(monthBills[0].amount) : String(scheduledAmount ?? ''));
  }, [currentSociety, month, monthBills]);

  useEffect(() => {
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    setMonth(`${currentYear}-${currentMonth}`);
  }, [currentYear]);

  useEffect(() => {
    setFilterYear(currentYear);
    setFilterMonth(String(currentMonthNumber).padStart(2, '0'));
  }, [currentSociety?.id, currentYear]);

  const handleSetMaintenance = (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a maintenance amount greater than zero.');
      return;
    }
    setMaintenanceScope('month');
    setScopeDialogOpen(true);
  };

  const confirmSetMaintenance = async (applyPermanently) => {
    setError('');
    setSuccess('');
    try {
      await setMaintenance(month, Number(amount), currentUser, applyPermanently);
      setSuccess(
        applyPermanently
          ? `Maintenance of ${currency.format(Number(amount))} is now set permanently from ${monthLabel(month)} onward.`
          : `Maintenance for ${monthLabel(month)} has been set for all ${residents.length} residents.`
      );
      setScopeDialogOpen(false);
    } catch (maintenanceError) {
      setError(maintenanceError.message);
    }
  };

  const openPaymentDialog = (bill) => {
    setError('');
    setPaymentDetails(createEmptyPayment());
    setPaymentBill(bill);
  };

  const closePaymentDialog = () => {
    setPaymentBill(null);
    setError('');
  };

  const handleMarkPaid = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      await markBillPaid(paymentBill, paymentDetails);
      setSuccess('Payment recorded and the resident receipt is ready to download.');
      closePaymentDialog();
    } catch (paymentError) {
      setError(paymentError.message);
    }
  };

  const handleRevertPayment = async (bill) => {
    setError('');
    setSuccess('');
    try {
      await revertBillPayment(bill.id, currentUser);
      setSuccess(`Payment for ${monthLabel(bill.month)} was reverted. The month is now unpaid.`);
    } catch (revertError) {
      setError(revertError.message);
    }
  };

  const handleAcceptPaymentRequest = async (bill) => {
    setError('');
    setSuccess('');
    try {
      await acceptPaymentRequest(bill.id, currentUser);
      setSuccess(`Payment request for ${monthLabel(bill.month)} was accepted and the receipt is ready.`);
    } catch (acceptError) {
      setError(acceptError.message);
    }
  };

  const paymentReferenceLabel = PAYMENT_REFERENCE_LABELS[paymentDetails.method];

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h2">Maintenance & payments</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
          Set monthly charges and track payment receipts. Unpaid months are shown automatically; database bills are created when a payment
          is requested or recorded.
        </Typography>
      </div>
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
      <MainCard title="Set monthly maintenance">
        <form onSubmit={handleSetMaintenance}>
          <Grid container spacing={2} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                type="month"
                label="Billing month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                inputProps={{ min: `${currentYear}-01`, max: `${currentYear}-12` }}
                slotProps={{ inputLabel: { shrink: true } }}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                type="number"
                label="Amount per home (INR)"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputProps={{ min: 1, step: 1 }}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Button type="submit" fullWidth variant="contained" size="large">
                Set for all residents
              </Button>
            </Grid>
          </Grid>
        </form>
        <Typography color="text.secondary" variant="caption" sx={{ display: 'block', mt: 2 }}>
          Unpaid entries are generated from each apartment’s creation month. Choose a temporary amount for this month only or make the
          rate permanent for upcoming months.
        </Typography>
      </MainCard>

      <MainCard
        title={`${monthLabel(`${filterYear}-${filterMonth}`)} · ${monthBills.length} entries`}
        headerSX={{
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexWrap: { xs: 'wrap', sm: 'nowrap' },
          '& .MuiCardHeader-content': { flexBasis: { xs: '100%', sm: 'auto' } },
          '& .MuiCardHeader-title': { whiteSpace: 'nowrap' },
          '& .MuiCardHeader-action': {
            alignSelf: { xs: 'stretch', sm: 'center' },
            width: { xs: '100%', sm: 'auto' },
            margin: { xs: '16px 0 0', sm: '-8px 0 -8px auto' }
          }
        }}
        secondary={
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ flexWrap: 'wrap', justifyContent: 'flex-end', width: { xs: '100%', sm: 'auto' } }}
          >
              <TextField
                select
                size="small"
                label="Month"
                value={filterMonth}
                onChange={(event) => setFilterMonth(event.target.value)}
                sx={{ width: 132 }}
              >
                {Array.from({ length: 12 }, (_, index) => {
                  const value = String(index + 1).padStart(2, '0');
                  const label = new Date(2026, index, 1).toLocaleDateString('en-IN', { month: 'long' });
                  return (
                    <MenuItem
                      key={value}
                      value={value}
                      disabled={index + 1 < minimumFilterMonth || index + 1 > maximumFilterMonth}
                    >
                      {label}
                    </MenuItem>
                  );
                })}
              </TextField>
              <TextField
                select
                size="small"
                label="Year"
                value={filterYear}
                onChange={handleFilterYearChange}
                sx={{ width: 90 }}
              >
                {years.map((year) => (
                  <MenuItem key={year} value={year} disabled={year < creationYear}>
                    {year}
                  </MenuItem>
                ))}
              </TextField>
          </Stack>
        }
      >
        {monthBills.length ? (
          <ResponsiveTable minWidth={900}>
            <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Resident</TableCell>
                <TableCell>Home</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Payment details</TableCell>
                <TableCell>Receipt</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {monthBills.map((bill) => {
                const resident = users.find((user) => user.id === bill.userId);
                return (
                  <TableRow key={bill.id}>
                    <TableCell>{resident?.name || 'Resident'}</TableCell>
                    <TableCell>{resident?.apartment || '—'}</TableCell>
                    <TableCell>{currency.format(bill.amount)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={bill.status === 'paid' ? 'Paid' : bill.paymentRequest ? 'Payment requested' : 'Pending'}
                        color={bill.status === 'paid' ? 'success' : bill.paymentRequest ? 'info' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>
                      {bill.paymentRequest && bill.status === 'pending' ? (
                        <Stack spacing={0.25}>
                          <Typography variant="body2">
                            Request · {bill.paymentRequest.method} · {bill.paymentRequest.paymentDate}
                          </Typography>
                          {bill.paymentRequest.reference && (
                            <Typography variant="caption" color="text.secondary">
                              {bill.paymentRequest.reference}
                            </Typography>
                          )}
                          {bill.paymentRequest.notes && (
                            <Typography variant="caption" color="text.secondary">
                              {bill.paymentRequest.notes}
                            </Typography>
                          )}
                        </Stack>
                      ) : bill.status === 'paid' ? (
                        <Stack spacing={0.25}>
                          <Typography variant="body2">{bill.paymentMethod || 'Method not recorded'}</Typography>
                          {bill.paymentReference && (
                            <Typography variant="caption" color="text.secondary">
                              {bill.paymentReference}
                            </Typography>
                          )}
                        </Stack>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {bill.status === 'paid' && bill.receiptNo ? (
                        <Button
                          size="small"
                          sx={{ minWidth: 0, p: 0, textTransform: 'none' }}
                          onClick={() => downloadMaintenanceReceipt(bill, resident, currentSociety)}
                        >
                          {bill.receiptNo}
                        </Button>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {bill.status === 'paid' ? (
                        <Button size="small" color="error" onClick={() => handleRevertPayment(bill)}>
                          Revert payment
                        </Button>
                      ) : bill.paymentRequest ? (
                        <Button size="small" variant="contained" onClick={() => handleAcceptPaymentRequest(bill)}>
                          Accept payment
                        </Button>
                      ) : (
                        <Button size="small" variant="outlined" onClick={() => openPaymentDialog(bill)}>
                          Mark payment
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            </Table>
          </ResponsiveTable>
        ) : residents.length === 0 ? (
          <Typography color="text.secondary">Add resident accounts to create maintenance bills.</Typography>
        ) : null}
      </MainCard>
      <RevertedPaymentHistory payments={revertedPayments} users={users} isAdmin />

      <Dialog open={scopeDialogOpen} onClose={() => setScopeDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Apply maintenance amount</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Typography color="text.secondary">
              How should {currency.format(Number(amount))} be applied starting {monthLabel(month)}?
            </Typography>
            <RadioGroup value={maintenanceScope} onChange={(event) => setMaintenanceScope(event.target.value)}>
              <FormControlLabel value="month" control={<Radio />} label="Selected month only" />
              <FormControlLabel
                value="permanent"
                control={<Radio />}
                label="Permanently from this month onward"
              />
            </RadioGroup>
            {maintenanceScope === 'permanent' && (
              <Typography variant="caption" color="text.secondary">
                This rate applies to unpaid months from the selected month onward, including future months. Paid months and months with
                a pending payment request are protected.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setScopeDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void confirmSetMaintenance(maintenanceScope === 'permanent')}
          >
            Apply amount
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(paymentBill)} onClose={closePaymentDialog} fullWidth maxWidth="sm">
        <form onSubmit={handleMarkPaid}>
          <DialogTitle>Mark maintenance payment</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <Typography color="text.secondary">
                Record payment for {users.find((user) => user.id === paymentBill?.userId)?.name || 'resident'} —{' '}
                {paymentBill ? monthLabel(paymentBill.month) : ''} ({paymentBill ? currency.format(paymentBill.amount) : ''}).
              </Typography>
              <TextField
                select
                label="Payment method"
                required
                value={paymentDetails.method}
                onChange={(event) => setPaymentDetails({ ...paymentDetails, method: event.target.value, reference: '' })}
              >
                {PAYMENT_METHODS.map((method) => (
                  <MenuItem key={method} value={method}>
                    {method}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                type="date"
                label="Payment date"
                required
                value={paymentDetails.paymentDate}
                onChange={(event) => setPaymentDetails({ ...paymentDetails, paymentDate: event.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label={paymentReferenceLabel}
                required={paymentDetails.method !== 'Cash'}
                value={paymentDetails.reference}
                onChange={(event) => setPaymentDetails({ ...paymentDetails, reference: event.target.value })}
                helperText={paymentDetails.method === 'Cash' ? 'Optional' : 'Required to identify the payment'}
              />
              <TextField
                label="Additional notes"
                multiline
                minRows={2}
                value={paymentDetails.notes}
                onChange={(event) => setPaymentDetails({ ...paymentDetails, notes: event.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closePaymentDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              Mark payment
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Stack>
  );
}
