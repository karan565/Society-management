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
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import MainCard from 'ui-component/cards/MainCard';
import { USER_ROLE_LABELS, USER_ROLES } from 'common/constants';
import { useSociety } from 'contexts/SocietyContext';

const emptyMember = { name: '', email: '', role: USER_ROLES.RESIDENT, title: '', apartment: '', phone: '', password: '' };
const apartmentCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const roleLabel = (user) =>
  user.role === USER_ROLES.ADMIN && user.title ? user.title : USER_ROLE_LABELS[user.role] || USER_ROLE_LABELS[USER_ROLES.RESIDENT];

export default function Members() {
  const { currentUser, users, createUser, resetUserPassword, setUserActive } = useSociety();
  const isSuperAdmin = currentUser.role === USER_ROLES.SUPER_ADMIN;
  const [dialog, setDialog] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm] = useState(emptyMember);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const members = useMemo(
    () =>
      users
        .filter((user) => user.role !== USER_ROLES.SUPER_ADMIN)
        .sort((first, second) => {
          const firstIsResident = first.role === USER_ROLES.RESIDENT;
          const secondIsResident = second.role === USER_ROLES.RESIDENT;

          if (firstIsResident !== secondIsResident) return firstIsResident ? 1 : -1;
          if (!firstIsResident) return first.name.localeCompare(second.name);

          return (
            apartmentCollator.compare(first.apartment || '', second.apartment || '') ||
            first.name.localeCompare(second.name)
          );
        }),
    [users]
  );

  const closeDialog = () => {
    setDialog('');
    setError('');
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      await createUser(form, currentUser);
      setSuccess(`${form.name} was added. Share the email and password with them securely.`);
      setForm(emptyMember);
      closeDialog();
    } catch (createError) {
      setError(createError.message);
    }
  };

  const handleReset = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await resetUserPassword(selectedUser.id, newPassword, currentUser);
      setSuccess(`Password updated for ${selectedUser.name}.`);
      setNewPassword('');
      closeDialog();
    } catch (resetError) {
      setError(resetError.message);
    }
  };

  const handleToggleActive = async (user) => {
    setError('');
    setSuccess('');
    try {
      const isActive = user.isActive === false;
      await setUserActive(user.id, isActive, currentUser);
      setSuccess(`${user.name}'s account is now ${isActive ? 'active' : 'inactive'}.`);
    } catch (toggleError) {
      setError(toggleError.message);
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <BoxIntro />
        <Button
          variant="contained"
          onClick={() => {
            setError('');
            setForm(emptyMember);
            setDialog('create');
          }}
        >
          {isSuperAdmin ? 'Add a User' : 'Add Resident'}
        </Button>
      </Stack>
      {success && (
        <Alert severity="success" onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}
      {error && !dialog && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <MainCard
        title="Society accounts"
        secondary={
          <Typography color="text.secondary" variant="body2">
            {members.length} people
          </Typography>
        }
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Apartment</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Status</TableCell>
              <TableCell> &nbsp;Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.name}</TableCell>
                <TableCell>
                  <Chip size="small" label={roleLabel(user)} color={user.role === USER_ROLES.ADMIN ? 'primary' : 'default'} />
                </TableCell>
                <TableCell>{user.apartment || '—'}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      size="small"
                      label={user.isActive === false ? 'Inactive' : 'Active'}
                      color={user.isActive === false ? 'default' : 'success'}
                    />
                    {(currentUser.role === USER_ROLES.SUPER_ADMIN ||
                      (currentUser.role === USER_ROLES.ADMIN && user.role === USER_ROLES.RESIDENT)) && (
                      <Switch
                        checked={user.isActive !== false}
                        onChange={() => handleToggleActive(user)}
                        color="success"
                        inputProps={{ 'aria-label': `Set ${user.name} account ${user.isActive === false ? 'active' : 'inactive'}` }}
                      />
                    )}
                  </Stack>
                </TableCell>
                <TableCell>
                  {(currentUser.role === USER_ROLES.SUPER_ADMIN || user.role === USER_ROLES.RESIDENT) && (
                    <Button
                      size="small"
                      onClick={() => {
                        setSelectedUser(user);
                        setNewPassword('');
                        setError('');
                        setDialog('password');
                      }}
                    >
                      Reset password
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </MainCard>

      <Dialog open={dialog === 'create'} onClose={closeDialog} fullWidth maxWidth="sm">
        <form onSubmit={handleCreate}>
          <DialogTitle>{isSuperAdmin ? 'Add a Society User' : 'Add Resident'}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                label="Full name"
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
              <TextField
                label="Email address"
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
              {currentUser.role === USER_ROLES.SUPER_ADMIN && (
                <TextField
                  select
                  label="Access panel"
                  value={form.role}
                  onChange={(event) => setForm({ ...form, role: event.target.value })}
                >
                  <MenuItem value={USER_ROLES.RESIDENT}>Resident</MenuItem>
                  <MenuItem value={USER_ROLES.ADMIN}>Admin / committee member</MenuItem>
                </TextField>
              )}
              {form.role === USER_ROLES.ADMIN && (
                <TextField
                  label="Committee position"
                  placeholder="Secretary, Cashier…"
                  required
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              )}
              {form.role === USER_ROLES.RESIDENT && (
                <TextField
                  label="Apartment / unit"
                  required
                  value={form.apartment}
                  onChange={(event) => setForm({ ...form, apartment: event.target.value })}
                />
              )}
              <TextField label="Phone number" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
              <TextField
                label="Temporary password"
                type="password"
                required
                inputProps={{ minLength: 8 }}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                helperText="At least 8 characters. The user can change it after signing in."
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {isSuperAdmin ? 'Create account' : 'Add Resident'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={dialog === 'password'} onClose={closeDialog} fullWidth maxWidth="xs">
        <form onSubmit={handleReset}>
          <DialogTitle>Reset password</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <Typography color="text.secondary">Set a temporary password for {selectedUser?.name}.</Typography>
              <TextField
                label="New password"
                type="password"
                required
                inputProps={{ minLength: 8 }}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              Save password
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Stack>
  );
}

function BoxIntro() {
  return (
    <div>
      <Typography variant="h2">People & access</Typography>
      <Typography color="text.secondary" sx={{ mt: 0.75 }}>
        Manage residents and your society committee.
      </Typography>
    </div>
  );
}
