import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { USER_ROLES } from 'common/constants';
import MainCard from 'ui-component/cards/MainCard';
import { useSociety } from 'contexts/SocietyContext';

export default function Account() {
  const { currentUser, changePassword } = useSociety();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Your new password must have at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      navigate('/pages/login', {
        replace: true,
        state: { notice: 'Your password has been changed. Sign in again with your new password.' }
      });
    } catch (changeError) {
      setError(changeError.message);
    }
  };

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h2">My account</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
          Your society profile and sign-in settings.
        </Typography>
      </div>
      <MainCard title="Profile">
        <Stack spacing={1}>
          <Typography>
            <strong>Name:</strong> {currentUser.name}
          </Typography>
          <Typography>
            <strong>Email:</strong> {currentUser.email}
          </Typography>
          <Typography>
            <strong>Access:</strong>{' '}
            {currentUser.role === USER_ROLES.SUPER_ADMIN
              ? 'Super Admin'
              : currentUser.role === USER_ROLES.ADMIN
                ? currentUser.title || 'Admin'
                : 'Resident'}
          </Typography>
          {currentUser.apartment && (
            <Typography>
              <strong>Apartment:</strong> {currentUser.apartment}
            </Typography>
          )}
          {currentUser.phone && (
            <Typography>
              <strong>Phone:</strong> {currentUser.phone}
            </Typography>
          )}
        </Stack>
      </MainCard>
      <MainCard title="Change password">
        <form onSubmit={handleSubmit}>
          <Stack spacing={2} sx={{ maxWidth: 480 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Current password"
              type="password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <TextField
              label="New password"
              type="password"
              required
              inputProps={{ minLength: 8 }}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <TextField
              label="Confirm new password"
              type="password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            <Button type="submit" variant="contained" sx={{ alignSelf: 'flex-start' }}>
              Update password
            </Button>
          </Stack>
        </form>
      </MainCard>
    </Stack>
  );
}
