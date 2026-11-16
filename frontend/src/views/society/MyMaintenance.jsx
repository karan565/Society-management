import { useState } from 'react';

import { useSociety } from 'contexts/SocietyContext';
import { downloadMaintenanceReceipt } from 'utils/maintenanceReceipt';
import { PAYMENT_METHODS, PAYMENT_REFERENCE_LABELS } from 'common/constants';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
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

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const monthLabel = (month) => new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const createEmptyPayment = () => ({
  method: 'UPI',
  paymentDate: new Date().toISOString().slice(0, 10),
  reference: '',
  notes: ''
});

export default function MyMaintenance() {
  const { currentUser, currentSociety, currentYear, bills, submitPaymentRequest } = useSociety();
  const [selectedBill, setSelectedBill] = useState(null);
  const [paymentDetails, setPaymentDetails] = useState(createEmptyPayment);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const ownBills = bills.filter((bill) => bill.userId === currentUser.id).sort((a, b) => b.month.localeCompare(a.month));
  const pending = ownBills.filter((bill) => bill.status === 'pending' && bill.month.startsWith(`${currentYear}-`));
  const paid = ownBills.filter((bill) => bill.status === 'paid');

  const openPaymentDialog = (bill) => {
    setError('');
    setPaymentDetails(createEmptyPayment());
    setSelectedBill(bill);
  };

  const closePaymentDialog = () => {
    setSelectedBill(null);
    setError('');
  };

  const handleSubmitPayment = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      await submitPaymentRequest(selectedBill.id, paymentDetails, currentUser);
      setSuccess(`Your payment details for ${monthLabel(selectedBill.month)} have been submitted for review.`);
      closePaymentDialog();
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const paymentReferenceLabel = PAYMENT_REFERENCE_LABELS[paymentDetails.method];

  const renderRows = (items, isPaid) => (
    <ResponsiveTable minWidth={650}>
      <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Month</TableCell>
          <TableCell>Due date</TableCell>
          <TableCell>Amount</TableCell>
          <TableCell>Status</TableCell>
          <TableCell align="right">{isPaid ? 'Receipt' : 'Payment'}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((bill) => (
          <TableRow key={bill.id}>
            <TableCell>{monthLabel(bill.month)}</TableCell>
            <TableCell>{new Date(`${bill.dueDate}T00:00:00`).toLocaleDateString('en-IN')}</TableCell>
            <TableCell>{currency.format(bill.amount)}</TableCell>
            <TableCell>
              <Chip
                size="small"
                label={isPaid ? 'Paid' : bill.paymentRequest ? 'Awaiting review' : 'Pending'}
                color={isPaid ? 'success' : bill.paymentRequest ? 'info' : 'warning'}
              />
            </TableCell>
            <TableCell align="right">
              {isPaid ? (
                <Button size="small" onClick={() => downloadMaintenanceReceipt(bill, currentUser, currentSociety)}>
                  Download receipt
                </Button>
              ) : bill.paymentRequest ? (
                <Typography color="text.secondary" variant="body2">
                  Submitted · {bill.paymentRequest.method}
                </Typography>
              ) : (
                <Button size="small" variant="outlined" onClick={() => openPaymentDialog(bill)}>
                  Submit payment
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      </Table>
    </ResponsiveTable>
  );

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h2">My maintenance</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
          Current-year bills are available to pay across all 12 months. The society committee will review submitted payment details.
        </Typography>
      </div>
      {error && !selectedBill && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}
      <MainCard title={`Pending bills · ${pending.length}`}>
        {pending.length ? (
          renderRows(pending, false)
        ) : (
          <Typography color="text.secondary">You have no pending maintenance bills.</Typography>
        )}
      </MainCard>
      <MainCard title={`Payment history · ${paid.length}`}>
        {paid.length ? (
          renderRows(paid, true)
        ) : (
          <Typography color="text.secondary">Paid receipts will appear here after the cashier records your payment.</Typography>
        )}
      </MainCard>
      <Dialog open={Boolean(selectedBill)} onClose={closePaymentDialog} fullWidth maxWidth="sm">
        <form onSubmit={handleSubmitPayment}>
          <DialogTitle>Submit payment details</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <Typography color="text.secondary">
                Submit payment details for {selectedBill ? monthLabel(selectedBill.month) : ''} (
                {selectedBill ? currency.format(selectedBill.amount) : ''}). This sends a request to your society admins; it does not
                transfer money.
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
                helperText={paymentDetails.method === 'Cash' ? 'Optional' : 'Required for payment verification'}
              />
              <TextField
                label="Additional details"
                multiline
                minRows={2}
                value={paymentDetails.notes}
                onChange={(event) => setPaymentDetails({ ...paymentDetails, notes: event.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closePaymentDialog}>Cancel</Button>
            <Button type="submit" variant="contained">Submit payment</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Stack>
  );
}
