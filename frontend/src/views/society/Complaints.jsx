import { useMemo, useState } from 'react';

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
import {
  COMPLAINT_STATUS_COLORS,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUSES,
  COMPLAINT_STATUS_OPTIONS,
  COMPLAINT_TYPE_OPTIONS,
  COMPLAINT_TYPES,
  USER_ROLES
} from 'common/constants';
import { useSociety } from 'contexts/SocietyContext';

const emptyRequest = { type: COMPLAINT_TYPES.COMPLAINT, title: '', description: '' };

export default function Complaints() {
  const { currentUser, users, complaints, createComplaint, updateComplaintStatus, closeOwnComplaint } = useSociety();
  const isAdmin = [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN].includes(currentUser.role);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyRequest);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const visibleRequests = useMemo(
    () =>
      (isAdmin ? complaints : complaints.filter((complaint) => complaint.userId === currentUser.id)).sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt)
      ),
    [complaints, currentUser.id, isAdmin]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await createComplaint(form, currentUser);
      setForm(emptyRequest);
      setDialogOpen(false);
      setSuccess('Your request was submitted to the society committee.');
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  const handleStatus = async (complaintId, status) => {
    setError('');
    setSuccess('');
    try {
      await updateComplaintStatus(complaintId, status, currentUser);
      setSuccess('Request status updated.');
    } catch (updateError) {
      setError(updateError.message);
    }
  };

  const handleCloseComplaint = async (complaint) => {
    setError('');
    setSuccess('');
    try {
      await closeOwnComplaint(complaint.id, currentUser);
      setSuccess('Your complaint was closed.');
    } catch (closeError) {
      setError(closeError.message);
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <div>
          <Typography variant="h2">{isAdmin ? 'Resident requests' : 'Complaints & suggestions'}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            {isAdmin ? 'Review resident submissions and update their progress.' : 'Send a complaint or suggestion to your society committee.'}
          </Typography>
        </div>
        {!isAdmin && <Button variant="contained" onClick={() => { setError(''); setDialogOpen(true); }}>New request</Button>}
      </Stack>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}
      <MainCard title={`${isAdmin ? 'All society requests' : 'Your submissions'} · ${visibleRequests.length}`}>
        {visibleRequests.length ? (
          <ResponsiveTable minWidth={isAdmin ? 900 : 700}>
            <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                {isAdmin && <TableCell>Resident</TableCell>}
                <TableCell>Type</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Status</TableCell>
                {isAdmin && <TableCell align="right">Update status</TableCell>}
                {!isAdmin && <TableCell align="right">Action</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleRequests.map((complaint) => {
                const resident = users.find((user) => user.id === complaint.userId);
                return (
                  <TableRow key={complaint.id}>
                    <TableCell>{new Date(complaint.createdAt).toLocaleDateString('en-IN')}</TableCell>
                    {isAdmin && <TableCell>{resident?.name || 'Resident'}{resident?.apartment ? ` · ${resident.apartment}` : ''}</TableCell>}
                    <TableCell>{complaint.type}</TableCell>
                    <TableCell>{complaint.title}</TableCell>
                    <TableCell sx={{ minWidth: 180, maxWidth: 320, whiteSpace: 'normal' }}>{complaint.description}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={COMPLAINT_STATUS_LABELS[complaint.status] || complaint.status}
                        color={COMPLAINT_STATUS_COLORS[complaint.status] || 'default'}
                      />
                    </TableCell>
                    {isAdmin && (
                      <TableCell align="right">
                        <TextField
                          select
                          size="small"
                          value={complaint.status === COMPLAINT_STATUSES.OPEN ? '' : complaint.status}
                          onChange={(event) => void handleStatus(complaint.id, event.target.value)}
                          SelectProps={{ displayEmpty: true }}
                          sx={{ minWidth: 145 }}
                        >
                          <MenuItem value="" disabled>Choose status</MenuItem>
                          {COMPLAINT_STATUS_OPTIONS.filter((status) => status !== COMPLAINT_STATUSES.OPEN).map((status) => (
                            <MenuItem key={status} value={status}>
                              {COMPLAINT_STATUS_LABELS[status] || status}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                    )}
                    {!isAdmin && (
                      <TableCell align="right">
                        {[COMPLAINT_STATUSES.OPEN, COMPLAINT_STATUSES.IN_PROGRESS].includes(complaint.status) && (
                          <Button size="small" onClick={() => void handleCloseComplaint(complaint)}>
                            Close complaint
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
          <Typography color="text.secondary">{isAdmin ? 'No resident requests have been submitted.' : 'You have not submitted any requests yet.'}</Typography>
        )}
      </MainCard>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={handleSubmit}>
          <DialogTitle>Submit a request</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField select label="Request type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                {COMPLAINT_TYPE_OPTIONS.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Subject" required inputProps={{ maxLength: 100 }} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
              <TextField label="Details" required multiline minRows={4} inputProps={{ maxLength: 2000 }} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Submit request</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Stack>
  );
}
