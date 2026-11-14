import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { IconBuildingCommunity } from '@tabler/icons-react';
import { useSociety } from 'contexts/SocietyContext';
import { APP_NAME } from 'appName';

export default function Login() {
  const { currentUser, login, isInitializing, initializationError, retryInitialization } = useSociety();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.title = `Sign in · ${APP_NAME}`;
  }, []);

  if (currentUser) return <Navigate to="/dashboard/default" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/dashboard/default', { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, bgcolor: 'grey.50' }}>
      <Card sx={{ width: '100%', maxWidth: 460, borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          <Stack spacing={3}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', justifyContent: 'center' }}>
              <Avatar variant="rounded" sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 44, height: 44 }}>
                <IconBuildingCommunity size={24} />
              </Avatar>
              <Typography
                component="h1"
                variant="h2"
                sx={{ color: 'text.primary', fontWeight: 700, letterSpacing: '-0.04em' }}
                noWrap
              >
                {APP_NAME}
              </Typography>
            </Stack>
            <Box>
              {/* <Typography color="text.secondary" sx={{ mt: 1 }}>
                Sign in with an account created by your society administrator.
              </Typography> */}
            </Box>
            {location.state?.notice && <Alert severity="success">{location.state.notice}</Alert>}
            {location.state?.error && <Alert severity="error">{location.state.error}</Alert>}
            {isInitializing && <Alert severity="info">Connecting to the society service…</Alert>}
            {initializationError && (
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={retryInitialization}>
                    Retry
                  </Button>
                }
              >
                {initializationError}
              </Alert>
            )}
            {error && <Alert severity="error">{error}</Alert>}
            <form className="login-form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="Email address"
                  type="email"
                  autoComplete="username"
                  required
                  fullWidth
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <TextField
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  required
                  fullWidth
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <Button type="submit" variant="contained" size="large" disabled={isSubmitting || isInitializing}>
                  Sign in
                </Button>
              </Stack>
            </form>
            <Alert severity="info">
              {/* The first Super Admin account is created by the backend seed command. Society users can then be added from the portal. */}
              Sign in with an account created by your society administrator.
            </Alert>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
