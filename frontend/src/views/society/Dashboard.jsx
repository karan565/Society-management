import { Link } from 'react-router-dom';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { IconBuildingCommunity, IconCash, IconHome, IconMessageReport, IconUsers } from '@tabler/icons-react';

import MainCard from 'ui-component/cards/MainCard';
import ResponsiveTable from 'ui-component/ResponsiveTable';
import { COMPLAINT_STATUSES, USER_ROLES } from 'common/constants';
import { useSociety } from 'contexts/SocietyContext';
import { downloadMaintenanceReceipt } from 'utils/maintenanceReceipt';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const monthLabel = (month) => new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

function SummaryCard({ label, value, caption, icon, color = 'primary' }) {
  return (
    <MainCard content={false}>
      <Stack direction="row" sx={{ alignItems: 'stretch', justifyContent: 'space-between', height: '100%', p: 2.5 }}>
        <Box sx={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, mr: 2 }}>
          <Typography color="text.secondary" variant="body2" sx={{ minHeight: 40 }}>
            {label}
          </Typography>
          <Typography variant="h2" sx={{ mt: 1 }}>
            {value}
          </Typography>
          <Typography color="text.secondary" variant="caption" sx={{ minHeight: 40 }}>
            {caption}
          </Typography>
        </Box>
        <Avatar
          sx={{ alignSelf: 'center', bgcolor: `${color}.light`, color: `${color}.dark`, flexShrink: 0, width: 52, height: 52 }}
        >
          {icon}
        </Avatar>
      </Stack>
    </MainCard>
  );
}

SummaryCard.propTypes = {};

export default function SocietyDashboard() {
  const { currentUser, users, bills, availableFund, complaints, currentSociety, societies } = useSociety();
  if (!currentSociety) {
    return (
      <Stack spacing={2}>
        <Typography variant="h2">Set up your first society</Typography>
        <Typography color="text.secondary">
          Create a society and appoint its first chairperson to get started.
        </Typography>
        <Button component={Link} to="/societies" variant="contained" sx={{ alignSelf: 'flex-start' }}>
          Create a society
        </Button>
      </Stack>
    );
  }

  const isResident = currentUser.role === USER_ROLES.RESIDENT;
  const month = new Date().toISOString().slice(0, 7);
  const residents = users.filter((user) => user.role === USER_ROLES.RESIDENT);
  const currentBills = bills.filter((bill) => bill.month === month);
  const pendingBills = currentBills.filter((bill) => bill.status === 'pending');
  const openRequests = complaints.filter(
    (complaint) =>
      complaint.status === COMPLAINT_STATUSES.OPEN || complaint.status === COMPLAINT_STATUSES.IN_PROGRESS
  );
  const myBills = bills.filter((bill) => bill.userId === currentUser.id).sort((a, b) => b.month.localeCompare(a.month));
  const myPending = myBills.filter((bill) => bill.status === 'pending');
  const latestBills = isResident ? myBills.slice(0, 5) : currentBills.slice(0, 6);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h2">Good morning, {currentUser.name.split(' ')[0]}</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
          {isResident
            ? `Here is your home and maintenance account at ${currentSociety.name}.`
            : currentUser.role === USER_ROLES.SUPER_ADMIN
              ? `You are viewing ${currentSociety.name} · ${societies.length} societies managed.`
              : `Here is what is happening at ${currentSociety.name} today.`}
        </Typography>
      </Box>

      <Grid container spacing={2.5}>
        {isResident ? (
          <>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <SummaryCard
                label="Pending maintenance"
                value={currency.format(myPending.reduce((total, bill) => total + bill.amount, 0))}
                caption={`${myPending.length} bill${myPending.length === 1 ? '' : 's'} to review`}
                color="warning"
                icon={<IconCash size={26} />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <SummaryCard
                label="Apartment"
                value={currentUser.apartment || '—'}
                caption="Your registered home"
                icon={<IconHome size={26} />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <SummaryCard
                label="Paid receipts"
                value={myBills.filter((bill) => bill.status === 'paid').length}
                caption="Available to download"
                color="success"
                icon={<IconCash size={26} />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <SummaryCard
                label="Available society fund"
                value={currency.format(availableFund)}
                caption="Maintenance collected less expenses"
                color={availableFund < 0 ? 'error' : 'success'}
                icon={<IconBuildingCommunity size={26} />}
              />
            </Grid>
          </>
        ) : (
          <>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <SummaryCard
                label="Total residents"
                value={residents.length}
                caption="Registered households"
                icon={<IconUsers size={26} />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <SummaryCard
                label="Collected this month"
                value={currency.format(
                  currentBills.filter((bill) => bill.status === 'paid').reduce((total, bill) => total + bill.amount, 0)
                )}
                caption={monthLabel(month)}
                color="success"
                icon={<IconCash size={26} />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <SummaryCard
                label="Pending payments"
                value={pendingBills.length}
                caption={`of ${currentBills.length} monthly bills`}
                color="warning"
                icon={<IconCash size={26} />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <SummaryCard
                label="Management team"
                value={users.filter((user) => user.role === USER_ROLES.ADMIN).length}
                caption="Chairperson, secretary, cashier…"
                color="secondary"
                icon={<IconBuildingCommunity size={26} />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <SummaryCard
                label="Available fund"
                value={currency.format(availableFund)}
                caption="Maintenance collected less expenses"
                color={availableFund < 0 ? 'error' : 'success'}
                icon={<IconCash size={26} />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <SummaryCard
                label="Open resident requests"
                value={openRequests.length}
                caption="Complaints and suggestions"
                color="warning"
                icon={<IconMessageReport size={26} />}
              />
            </Grid>
          </>
        )}
      </Grid>

      {isResident && myPending.length > 0 && (
        <Alert
          severity="warning"
          action={
            <Button component={Link} to="/my-maintenance" color="inherit" size="small">
              View bills
            </Button>
          }
        >
          You have {myPending.length} pending maintenance bill{myPending.length === 1 ? '' : 's'}.
        </Alert>
      )}

      <MainCard title={isResident ? 'Your recent maintenance' : 'This month’s maintenance'}>
        {latestBills.length ? (
          <ResponsiveTable minWidth={560}>
            <Table size="small">
            <TableHead>
              <TableRow>
                {!isResident && <TableCell>Resident</TableCell>}
                <TableCell>Month</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Status</TableCell>
                {isResident && <TableCell align="right">Receipt</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {latestBills.map((bill) => {
                const resident = users.find((user) => user.id === bill.userId);
                return (
                  <TableRow key={bill.id}>
                    {!isResident && (
                      <TableCell>
                        {resident?.name || 'Resident'} · {resident?.apartment}
                      </TableCell>
                    )}
                    <TableCell>{monthLabel(bill.month)}</TableCell>
                    <TableCell>{currency.format(bill.amount)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={bill.status === 'paid' ? 'Paid' : 'Pending'}
                        color={bill.status === 'paid' ? 'success' : 'warning'}
                      />
                    </TableCell>
                    {isResident && (
                      <TableCell align="right">
                        {bill.status === 'paid' && (
                          <Button size="small" onClick={() => downloadMaintenanceReceipt(bill, currentUser, currentSociety)}>
                            Download
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
            </Table>
          </ResponsiveTable>
        ) : (
          <Typography color="text.secondary">No maintenance bills have been set for this month yet.</Typography>
        )}
      </MainCard>
    </Stack>
  );
}
