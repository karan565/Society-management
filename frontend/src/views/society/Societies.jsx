import { useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { USER_ROLES } from 'common/constants';
import { useSociety } from 'contexts/SocietyContext';

const blankForm = { name: '', address: '', chairmanName: '', chairmanEmail: '', chairmanPassword: '' };

export default function Societies() {
  const { currentUser, currentSociety, societies, allUsers, selectSociety, createSociety } = useSociety();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCreate = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await createSociety(form, currentUser);
      setSuccess(`${form.name} was created. Its chairperson can now sign in.`);
      setForm(blankForm);
      setDialogOpen(false);
    } catch (createError) {
      setError(createError.message);
    }
  };

  const handleSelect = async (societyId) => {
    setError('');
    setSuccess('');
    try {
      await selectSociety(societyId, currentUser);
      setSuccess('Society selected. You can now manage its admins, residents, and records.');
    } catch (selectionError) {
      setError(selectionError.message);
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
        <div>
          <Typography variant="h2">Society management</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            Create societies, appoint chairpersons, and switch between society workspaces.
          </Typography>
        </div>
        <Button variant="contained" onClick={() => { setError(''); setDialogOpen(true); }}>Create society</Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}
      <Grid container spacing={2.5}>
        {societies.map((society) => {
          const societyAdmins = allUsers.filter(
            (user) => user.role === USER_ROLES.ADMIN && user.societyId === society.id
          );
          const residentCount = allUsers.filter(
            (user) => user.role === USER_ROLES.RESIDENT && user.societyId === society.id
          ).length;
          const chairperson = societyAdmins.find((user) => user.title === 'Chairperson');
          const active = society.id === currentSociety?.id;
          return (
            <Grid key={society.id} size={{ xs: 12, md: 6, lg: 4 }}>
              <Card sx={{ height: '100%', border: active ? 1 : 0, borderColor: 'primary.main' }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                      <div>
                        <Typography variant="h3">{society.name}</Typography>
                        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
                          {society.address || 'Address not added'}
                        </Typography>
                      </div>
                      {active && <Typography variant="caption" color="primary.main">Your society</Typography>}
                    </Stack>
                    <Typography variant="body2">Chairperson: {chairperson?.name || 'Not appointed'}</Typography>
                    <Typography variant="body2">Committee admins: {societyAdmins.length} · Residents: {residentCount}</Typography>
                    {society.isActive === false && <Alert severity="warning">This society is inactive.</Alert>}
                    <Button
                      variant={active ? 'outlined' : 'contained'}
                      disabled={society.isActive === false}
                      onClick={() => handleSelect(society.id)}
                    >
                      {active ? 'Manage this society' : 'Switch to this society'}
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={handleCreate}>
          <DialogTitle>Create a society</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField label="Society name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <TextField label="Address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
              <Typography variant="subtitle1" sx={{ pt: 1 }}>First chairperson</Typography>
              <TextField label="Chairperson name" required value={form.chairmanName} onChange={(event) => setForm({ ...form, chairmanName: event.target.value })} />
              <TextField label="Chairperson email" type="email" required value={form.chairmanEmail} onChange={(event) => setForm({ ...form, chairmanEmail: event.target.value })} />
              <TextField label="Temporary password" type="password" required inputProps={{ minLength: 8 }} helperText="At least 8 characters." value={form.chairmanPassword} onChange={(event) => setForm({ ...form, chairmanPassword: event.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Create society</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Stack>
  );
}
