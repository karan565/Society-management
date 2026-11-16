import MainCard from 'ui-component/cards/MainCard';
import ResponsiveTable from 'ui-component/ResponsiveTable';

import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const displayDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : '—');

export default function RevertedPaymentHistory({ payments, users, isAdmin }) {
  return (
    <MainCard title={`Reverted payment history · ${payments.length}`}>
      {payments.length ? (
        <ResponsiveTable minWidth={isAdmin ? 850 : 700}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {isAdmin && <TableCell>Resident / home</TableCell>}
                <TableCell>Month</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Method / reference</TableCell>
                <TableCell>Receipt</TableCell>
                <TableCell>Paid on</TableCell>
                <TableCell>Reverted on</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((payment) => {
                const resident = users.find((user) => user.id === payment.userId);
                return (
                  <TableRow key={payment.id}>
                    {isAdmin && (
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Typography variant="body2">{resident?.name || 'Resident'}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {resident?.apartment || '—'}
                          </Typography>
                        </Stack>
                      </TableCell>
                    )}
                    <TableCell>{payment.month}</TableCell>
                    <TableCell>{currency.format(payment.amount)}</TableCell>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography variant="body2">{payment.method}</Typography>
                        {payment.reference && (
                          <Typography variant="caption" color="text.secondary">
                            {payment.reference}
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>{payment.receiptNo}</TableCell>
                    <TableCell>{displayDate(payment.paidAt)}</TableCell>
                    <TableCell>{displayDate(payment.revertedAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ResponsiveTable>
      ) : (
        <Typography color="text.secondary">Reverted payments will remain listed here for reference.</Typography>
      )}
    </MainCard>
  );
}
