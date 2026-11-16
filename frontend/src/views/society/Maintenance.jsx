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
import { DEFAULT_MAINTENANCE_AMOUNT, PAYMENT_METHODS, PAYMENT_REFERENCE_LABELS, USER_ROLES } from 'common/constants';
import { useSociety } from 'contexts/SocietyContext';
import { downloadMaintenanceReceipt } from 'utils/maintenanceReceipt';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const monthLabel = (month) => new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const createEmptyPayment = () => ({
  method: 'Cash',
  paymentDate: new Date().toISOString().slice(0, 10),
  reference: '',
  notes: ''
});

export default function Maintenance() {
  const { currentUser, currentSociety, currentYear, users, bills, setMaintenance, markBillPaid, revertBillPayment, acceptPaymentRequest } =
    useSociety();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [amount, setAmount] = useState(String(DEFAULT_MAINTENANCE_AMOUNT));
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [maintenanceScope, setMaintenanceScope] = useState('month');
  const [paymentBill, setPaymentBill] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(createEmptyPayment);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const monthBills = useMemo(
    () => bills.filter((bill) => bill.month === month).sort((a, b) => a.userId.localeCompare(b.userId)),
    [bills, month]
  );
  const residents = users.filter((user) => user.role === USER_ROLES.RESIDENT);

  useEffect(() => {
    const scheduledAmount =
      currentSociety?.maintenanceEffectiveFrom && month >= currentSociety.maintenanceEffectiveFrom
        ? currentSociety.maintenanceAmount
        : null;
    setAmount(monthBills.length ? String(monthBills[0].amount) : String(scheduledAmount ?? DEFAULT_MAINTENANCE_AMOUNT));
  }, [currentSociety?.maintenanceAmount, currentSociety?.maintenanceEffectiveFrom, month, monthBills]);

  useEffect(() => {
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    setMonth(`${currentYear}-${currentMonth}`);
  }, [currentYear]);

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
      await markBillPaid(paymentBill.id, paymentDetails, currentUser);
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
      setSuccess(`Payment for ${monthLabel(bill.month)} was reverted. The bill is pending again.`);
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
          Set a monthly charge for every resident and track receipts.
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
          Bills for all 12 months of {currentYear} are created automatically. Choose a temporary amount for this month only or make
          the rate permanent for upcoming months.
        </Typography>
      </MainCard>

      <MainCard title={`${monthLabel(month)} · ${monthBills.length} bills`}>
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
                This updates existing unpaid bills from the selected month onward and uses this rate for upcoming bills,
                including next year. Paid bills and bills with payment requests are protected.
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
