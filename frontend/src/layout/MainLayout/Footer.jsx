import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { APP_NAME } from 'appName';

export default function Footer() {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', pt: 3, mt: 'auto' }}>
      <Typography variant="caption">&copy; {new Date().getFullYear()} {APP_NAME}</Typography>
      <Typography variant="caption" color="text.secondary">
        Community · People · Payments
      </Typography>
    </Stack>
  );
}
